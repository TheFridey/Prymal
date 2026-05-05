import * as Sentry from '@sentry/node';
import { validateJsonSchema } from './control-plane/schema-validator.js';
import { reviewAgentOutputWithSentinel } from './sentinel-review.js';

const MAX_REPAIR_ATTEMPTS = 2;
const TEMPERATURE_REDUCTION = 0.2;

export async function reviewWorkflowNodeOutputWithSentinel({
  node,
  workflow,
  orgContext,
  result,
  evaluation,
  repairOutput,
  reviewer = reviewAgentOutputWithSentinel,
}) {
  try {
    const schemaValidation = buildWorkflowSchemaValidation({
      outputSchema: getNodeOutputSchema(node),
      result,
    });
    const firstReview = reviewer({
      agentId: node.agentId,
      orgPlan: orgContext.orgPlan,
      assistantText: result.text ?? '',
      evaluation,
      schemaValidation,
      sources: result.sources ?? [],
      context: {
        workflowId: workflow.id,
        nodeId: node.id,
        orgId: orgContext.orgId,
        userId: orgContext.userId ?? null,
      },
    });

    if (!firstReview || firstReview.verdict === 'PASS') {
      return {
        verdict: firstReview?.verdict ?? 'PASS',
        review: firstReview,
        result,
        schemaValidation,
        repairAttempted: false,
        sentinelRepairAttempts: 0,
      };
    }

    // Attempt repair for both REPAIR and HOLD verdicts — HOLD may still recover
    // after repair. Only skip repair if no repairOutput function is provided.
    if (typeof repairOutput !== 'function') {
      return buildHoldResult({ review: firstReview, result, schemaValidation, repairAttempted: false, repairAttempts: 0 });
    }

    // ── Attempt 1: standard repair ───────────────────────────────────────────
    const repairedResult = await repairOutput({ review: firstReview, schemaValidation, attemptNumber: 1 });
    const repairedSchemaValidation = buildWorkflowSchemaValidation({
      outputSchema: getNodeOutputSchema(node),
      result: repairedResult,
    });
    const repairedReview = reviewer({
      agentId: node.agentId,
      orgPlan: orgContext.orgPlan,
      assistantText: repairedResult.text ?? '',
      evaluation,
      schemaValidation: repairedSchemaValidation,
      sources: repairedResult.sources ?? [],
      context: {
        workflowId: workflow.id,
        nodeId: node.id,
        orgId: orgContext.orgId,
        userId: orgContext.userId ?? null,
      },
    });

    if (repairedReview?.verdict === 'PASS') {
      return {
        verdict: 'PASS',
        review: repairedReview,
        result: repairedResult,
        schemaValidation: repairedSchemaValidation,
        repairAttempted: true,
        sentinelRepairAttempts: 1,
      };
    }

    // ── Attempt 2: temperature reduction or provider fallback ────────────────
    // repairOutput receives a temperature hint and a flag indicating this is the
    // final attempt before HOLD. Callers that support temperature override will
    // reduce temperature by TEMPERATURE_REDUCTION; others will use their
    // provider fallback chain.
    const secondRepairedResult = await repairOutput({
      review: repairedReview ?? firstReview,
      schemaValidation: repairedSchemaValidation,
      attemptNumber: 2,
      temperatureReduction: TEMPERATURE_REDUCTION,
      useProviderFallback: true,
    });
    const secondSchemaValidation = buildWorkflowSchemaValidation({
      outputSchema: getNodeOutputSchema(node),
      result: secondRepairedResult,
    });
    const secondReview = reviewer({
      agentId: node.agentId,
      orgPlan: orgContext.orgPlan,
      assistantText: secondRepairedResult.text ?? '',
      evaluation,
      schemaValidation: secondSchemaValidation,
      sources: secondRepairedResult.sources ?? [],
      context: {
        workflowId: workflow.id,
        nodeId: node.id,
        orgId: orgContext.orgId,
        userId: orgContext.userId ?? null,
      },
    });

    const providerFallbackUsed = Boolean(secondRepairedResult?.providerFallbackUsed ?? secondRepairedResult?.fallbackUsed);

    if (secondReview?.verdict === 'PASS') {
      return {
        verdict: 'PASS',
        review: secondReview,
        result: secondRepairedResult,
        schemaValidation: secondSchemaValidation,
        repairAttempted: true,
        sentinelRepairAttempts: MAX_REPAIR_ATTEMPTS,
        sentinelProviderFallback: providerFallbackUsed,
      };
    }

    return buildHoldResult({
      review: secondReview ?? repairedReview ?? firstReview,
      result: secondRepairedResult,
      schemaValidation: secondSchemaValidation,
      repairAttempted: true,
      repairAttempts: MAX_REPAIR_ATTEMPTS,
      sentinelFinalVerdict: 'HOLD',
      sentinelProviderFallback: providerFallbackUsed,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'workflow_sentinel' },
      extra: {
        workflowId: workflow?.id ?? null,
        nodeId: node?.id ?? null,
        orgId: orgContext?.orgId ?? null,
      },
    });
    return {
      verdict: 'HOLD',
      review: {
        verdict: 'HOLD',
        riskScore: 1,
        reviewedAgentId: node?.agentId ?? null,
        concerns: ['SENTINEL review failed in workflow context.'],
        repair_actions: [],
        hold_reason: 'sentinel_review_error',
        suggested_next_action: 'Route this node output to review before continuing the workflow.',
      },
      result,
      schemaValidation: null,
      repairAttempted: false,
      sentinelRepairAttempts: 0,
      error,
    };
  }
}

export function buildWorkflowSchemaValidation({ outputSchema, result }) {
  if (result?.trace?.schemaValidation) {
    return result.trace.schemaValidation;
  }

  if (!outputSchema) {
    return null;
  }

  let value = result?.text ?? '';
  if (['object', 'array'].includes(outputSchema.type)) {
    try {
      value = JSON.parse(value);
    } catch {
      return {
        verdict: 'failed',
        errors: [{ path: '$', message: 'Workflow node output was not valid JSON.' }],
      };
    }
  }

  const validation = validateJsonSchema(outputSchema, value, {
    schemaName: 'workflow node output_schema',
  });

  return validation.ok
    ? { verdict: 'pass', errors: [] }
    : { verdict: 'failed', errors: validation.errors };
}

function buildHoldResult({ review, result, schemaValidation, repairAttempted, repairAttempts = 0, sentinelFinalVerdict, sentinelProviderFallback }) {
  return {
    verdict: 'HOLD',
    review: {
      ...(review ?? {}),
      verdict: 'HOLD',
      hold_reason: review?.hold_reason ?? 'sentinel_hold_after_repair',
    },
    result,
    schemaValidation,
    repairAttempted,
    sentinelRepairAttempts: repairAttempts,
    ...(sentinelFinalVerdict ? { sentinelFinalVerdict } : {}),
    ...(sentinelProviderFallback != null ? { sentinelProviderFallback } : {}),
  };
}

function getNodeOutputSchema(node) {
  return node?.output_schema ?? node?.outputSchema ?? node?.outputContract?.output_schema ?? null;
}
