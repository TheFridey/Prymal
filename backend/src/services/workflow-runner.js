// ─────────────────────────────────────────────────────────────────
// axiom/backend/src/services/workflow-runner.js
// Thin orchestration wrapper over workflow-engine.js that adds:
//   - Output schema validation per agent contract
//   - Trigger.dev dispatch vs inline execution routing
// ─────────────────────────────────────────────────────────────────

import { getAgentContract } from '../agents/contracts.js';
import { evaluateStructuredOutput } from './evals.js';
import { executeWorkflowRun } from './workflow-engine.js';
import { dispatchWorkflowRun } from '../queue/trigger.js';
import { db } from '../db/index.js';
import { workflowRuns, workflows } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';

/**
 * Run a workflow by ID.
 *
 * If TRIGGER_API_KEY is configured, dispatches via Trigger.dev.
 * Otherwise executes inline (queueMicrotask, same process).
 *
 * @param {object} options
 * @param {string} options.workflowId
 * @param {string} options.orgId
 * @param {object} options.orgContext  - { orgId, orgPlan, userId, credits }
 * @param {string} options.runId       - Pre-created workflowRun row ID
 * @param {object} [options.inputPayload]  - Optional seed data injected into first node's context
 * @returns {Promise<{ runId, status, executionMode }>}
 */
export async function startWorkflowRun({ workflowId, orgId, orgContext, runId, inputPayload = {} }) {
  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, workflowId), eq(workflows.orgId, orgId)),
  });

  if (!workflow) {
    throw Object.assign(new Error('Workflow not found.'), { status: 404, code: 'WORKFLOW_NOT_FOUND' });
  }

  // If inputPayload has values, inject as the first-node context override
  const enrichedWorkflow = inputPayload && Object.keys(inputPayload).length > 0
    ? injectPayloadIntoWorkflow(workflow, inputPayload)
    : workflow;

  const dispatch = await dispatchWorkflowRun({
    runId,
    workflow: enrichedWorkflow,
    orgContext,
  });

  await db
    .update(workflowRuns)
    .set({ executionMode: dispatch.mode })
    .where(eq(workflowRuns.id, runId));

  return {
    runId,
    status: 'queued',
    executionMode: dispatch.mode,
  };
}

/**
 * Execute a workflow run inline (used by the inline runner and Trigger.dev worker).
 * Adds output schema validation per node between workflow-engine node completions.
 *
 * @param {object} options
 * @param {string} options.runId
 * @param {object} options.workflow      - Full workflow definition from DB
 * @param {object} options.orgContext
 * @returns {Promise<{ nodeOutputs, creditsUsed, validationWarnings }>}
 */
export async function executeWorkflowRunWithValidation({ runId, workflow, orgContext }) {
  const validationWarnings = [];

  // Run the core engine — it handles node execution, retries, and trace recording
  const result = await executeWorkflowRun({ runId, workflow, orgContext });

  // Post-execution: validate each node's output against the agent contract outputSchema
  for (const [nodeId, nodeOutput] of Object.entries(result.nodeOutputs ?? {})) {
    if (nodeOutput.skipped || !nodeOutput.text) {
      continue;
    }

    const workflowNode = workflow.nodes?.find((n) => n.id === nodeId);
    if (!workflowNode?.agentId) {
      continue;
    }

    const contract = getAgentContract(workflowNode.agentId);
    if (!contract?.structuredOutput) {
      continue;
    }

    const pass = evaluateStructuredOutput({
      text: nodeOutput.text,
      structuredOutput: contract.structuredOutput,
    });

    if (pass === false) {
      const warning = {
        nodeId,
        agentId: workflowNode.agentId,
        outputVar: nodeOutput.outputVar,
        expectedSchema: contract.outputSchema ?? contract.structuredOutput,
        message: `Node '${nodeId}' (${workflowNode.agentId}) output did not match the expected structured output schema '${contract.structuredOutput}'.`,
      };
      validationWarnings.push(warning);
      console.warn('[WORKFLOW-RUNNER]', warning.message);
    }
  }

  return {
    ...result,
    validationWarnings,
  };
}

/**
 * Inject an external input payload into the first node of a workflow definition
 * by merging it into the node's prompt context block.
 * Returns a shallow copy of the workflow — does not mutate the original.
 */
function injectPayloadIntoWorkflow(workflow, inputPayload) {
  if (!workflow.nodes?.length || !inputPayload) {
    return workflow;
  }

  const payloadBlock = Object.entries(inputPayload)
    .map(([key, value]) => `[${key}]\n${String(value)}`)
    .join('\n\n');

  const [firstNode, ...rest] = workflow.nodes;
  const enrichedFirstNode = {
    ...firstNode,
    prompt: `${firstNode.prompt}\n\nINPUT PAYLOAD\n\n${payloadBlock}`,
  };

  return {
    ...workflow,
    nodes: [enrichedFirstNode, ...rest],
  };
}
