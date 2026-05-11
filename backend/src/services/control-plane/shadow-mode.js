import * as Sentry from '@sentry/node';
import { recordProductEvent } from '../telemetry.js';
import {
  DeclarativePolicyEngine,
  InMemoryTraceSink,
  WorkflowTraceRecorder,
  validateJsonSchema,
  validateStrictWorkflowDefinition,
} from './index.js';

const LEGACY_NODE_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    upstreamContext: { type: 'object' },
  },
  additionalProperties: true,
};

const LEGACY_NODE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
  },
  additionalProperties: true,
};

export async function runControlPlaneShadow({
  workflow,
  input = {},
  userId = null,
  orgId,
  runId = null,
  policyEngine = new DeclarativePolicyEngine(),
  traceRecorder = new WorkflowTraceRecorder({ sink: new InMemoryTraceSink() }),
} = {}) {
  const violations = [];
  const trace = traceRecorder.startWorkflow({
    workflowId: workflow?.id ?? 'unknown',
    orgId,
    userId,
    metadata: {
      mode: 'shadow',
      runId,
    },
  });
  const mapped = mapLegacyWorkflowToStrictContract(workflow, violations);
  let contractValid = false;
  let schemaValid = true;
  const policySimulation = [];

  if (mapped) {
    try {
      validateStrictWorkflowDefinition(mapped);
      contractValid = true;
    } catch (error) {
      violations.push(buildViolation('contract', error.message, { code: error.code ?? null }));
    }

    for (const node of mapped.nodes) {
      const inputPayload = {
        prompt: node.config?.legacyPrompt ?? '',
        upstreamContext: input && typeof input === 'object' ? input : { value: input },
      };
      const inputCheck = validateJsonSchema(node.input_schema, inputPayload);
      if (!inputCheck.ok) {
        schemaValid = false;
        violations.push(buildViolation('schema_input', `Shadow input schema mismatch for node "${node.id}".`, {
          nodeId: node.id,
          errors: inputCheck.errors,
        }));
      }

      const decision = await policyEngine.evaluate({
        userRole: 'member',
        workflowType: mapped.workflow_type,
        nodeType: node.type,
        tool: node.config?.selected_tool ?? null,
        dataSensitivity: workflow?.metadata?.data_sensitivity ?? 'internal',
        cumulativeRisk: policySimulation.at(-1)?.cumulativeRisk ?? 0,
        simulation: true,
      });
      policySimulation.push({ nodeId: node.id, ...decision });
      traceRecorder.appendNodeLog(trace, {
        nodeId: node.id,
        nodeType: node.type,
        status: 'simulated',
        input: inputPayload,
        retries: 0,
        policyDecisions: [decision],
      });

      if (decision.blocked || decision.requiresApproval) {
        violations.push(buildViolation('policy', `Shadow policy flagged node "${node.id}".`, {
          nodeId: node.id,
          action: decision.action,
          matchedPolicies: decision.matchedPolicies,
        }));
      }
    }
  } else {
    contractValid = false;
    schemaValid = false;
  }

  const finishedTrace = await traceRecorder.finishWorkflow(trace, {
    status: violations.length ? 'degraded' : 'simulated',
    metadata: { violationCount: violations.length },
  });

  return {
    contractValid,
    schemaValid,
    policySimulation,
    violations,
    traceId: finishedTrace.execution_id,
  };
}

export async function runControlPlaneShadowSafely(payload, options = {}) {
  try {
    const result = await runControlPlaneShadow({
      ...payload,
      ...(options.shadowOverrides ?? {}),
    });

    if (result.violations.length > 0) {
      await logControlPlaneShadowViolations({
        orgId: payload.orgId,
        userId: payload.userId,
        runId: payload.runId,
        workflowId: payload.workflow?.id ?? null,
        result,
      });
    }

    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'control_plane_shadow' },
      extra: {
        orgId: payload?.orgId ?? null,
        userId: payload?.userId ?? null,
        runId: payload?.runId ?? null,
        workflowId: payload?.workflow?.id ?? null,
      },
    });
    return {
      contractValid: false,
      schemaValid: false,
      policySimulation: [],
      violations: [buildViolation('shadow_exception', error.message, { code: error.code ?? null })],
      traceId: null,
    };
  }
}

export async function logControlPlaneShadowViolations({ orgId, userId = null, runId = null, workflowId = null, result }) {
  return recordProductEvent({
    orgId,
    userId,
    eventName: 'cp_shadow_violation',
    metadata: {
      workflowId,
      runId,
      traceId: result.traceId,
      contractValid: result.contractValid,
      schemaValid: result.schemaValid,
      violationCount: result.violations.length,
      violations: result.violations.slice(0, 10),
    },
  });
}

export function mapLegacyWorkflowToStrictContract(workflow, violations = []) {
  if (!workflow || typeof workflow !== 'object') {
    violations.push(buildViolation('mapping', 'Workflow payload is missing or invalid.'));
    return null;
  }

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
  const incomingByNodeId = new Map(nodes.map((node) => [String(node.id ?? ''), []]));

  for (const edge of edges) {
    const targetId = String(edge.to ?? '');
    if (!incomingByNodeId.has(targetId)) {
      continue;
    }
    incomingByNodeId.get(targetId).push(edge);
  }

  if (nodes.length === 0) {
    violations.push(buildViolation('mapping', 'Workflow has no nodes to map.'));
  }

  return {
    id: String(workflow.id ?? 'legacy-workflow'),
    name: String(workflow.name ?? workflow.id ?? 'Legacy workflow'),
    version: 'legacy-shadow',
    workflow_type: String(workflow.triggerType ?? 'legacy_workflow'),
    nodes: nodes.map((node) => {
      const nodeId = String(node.id ?? '');
      const legacyPrompt = node.prompt ?? '';
      const incomingEdges = incomingByNodeId.get(nodeId) ?? [];
      const inputBindings = Object.fromEntries(
        incomingEdges.map((edge, index) => [
          `upstream_${index + 1}`,
          `$nodes.${String(edge.from ?? '')}.text`,
        ]),
      );

      return {
        id: nodeId,
        type: 'agent',
        input_schema: LEGACY_NODE_INPUT_SCHEMA,
        output_schema: LEGACY_NODE_OUTPUT_SCHEMA,
        allowed_tools: Array.isArray(node.allowedTools) ? node.allowedTools : [],
        retry_policy: {
          attempts: Number(node.retryPolicy?.attempts ?? 1),
          strategy: node.retryPolicy?.strategy ?? 'none',
          delay_ms: Number(node.retryPolicy?.delayMs ?? 0),
        },
        fallback_node: node.fallbackNode ?? null,
        timeout_ms: Number(node.timeoutMs ?? 90_000),
        cost_limit: Number(node.costLimit ?? 100),
        input_bindings: inputBindings,
        config: {
          legacyAgentId: node.agentId ?? null,
          legacyPrompt,
          static_input: legacyPrompt ? { prompt: legacyPrompt } : {},
        },
      };
    }),
    edges: edges.map((edge) => ({
      from: String(edge.from ?? ''),
      to: String(edge.to ?? ''),
    })),
    metadata: {
      shadowMappedFrom: 'legacy_workflow',
    },
  };
}

function buildViolation(type, message, metadata = {}) {
  return {
    type,
    message,
    metadata,
  };
}
