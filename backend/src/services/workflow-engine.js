import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { AGENT_IDS } from '../agents/config.js';
import { db } from '../db/index.js';
import { workflowRuns, workflows } from '../db/schema.js';
import { assertCreditsAvailable, consumeCredits } from './entitlements.js';
import { evaluateAgentOutput } from './evals.js';
import { classifyLLMFailure, recordLLMExecutionTrace } from './llm-observability.js';
import { deliverWorkflowWebhook } from './webhook-delivery.js';
import { runAgentNode } from './llm.js';

const WORKFLOW_NODE_TIMEOUT_MS = Number(process.env.WORKFLOW_NODE_TIMEOUT_MS ?? 90_000);
const WORKFLOW_RUN_TIMEOUT_MS = Number(process.env.WORKFLOW_RUN_TIMEOUT_MS ?? 15 * 60_000);
const DEFAULT_MAX_WORKFLOW_ATTEMPTS = Number(process.env.WORKFLOW_MAX_ATTEMPTS ?? 3);

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['contains', 'equals', 'gt', 'lt', 'not_empty']),
  value: z.string().optional().default(''),
});

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  agentId: z.enum(AGENT_IDS),
  prompt: z.string().min(1).max(8000),
  outputVar: z.string().min(1).max(120),
  label: z.string().max(120).optional(),
  conditions: z.array(conditionSchema).max(10).optional(),
});

export const workflowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  condition: z.string().max(120).optional(),
});

export const workflowSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  triggerType: z.enum(['manual', 'schedule', 'webhook', 'event']),
  triggerConfig: z
    .object({
      cron: z.string().max(120).optional(),
      webhookSecret: z.string().min(8).max(128).optional(),
      eventType: z.string().max(120).optional(),
    })
    .default({}),
  nodes: z.array(workflowNodeSchema).min(1).max(20),
  edges: z.array(workflowEdgeSchema).max(100),
});

export function validateWorkflowDefinition(input) {
  const workflow = workflowSchema.parse(input);
  const nodeIds = new Set();
  const outputVars = new Set();

  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      throw workflowValidationError(`Duplicate node id "${node.id}".`);
    }
    if (outputVars.has(node.outputVar)) {
      throw workflowValidationError(`Duplicate output variable "${node.outputVar}".`);
    }
    nodeIds.add(node.id);
    outputVars.add(node.outputVar);
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw workflowValidationError('Every edge must point to existing nodes.');
    }
  }

  if (hasCycle(workflow.nodes, workflow.edges)) {
    throw workflowValidationError('Workflows cannot contain cycles.');
  }

  if (workflow.triggerType === 'schedule' && !workflow.triggerConfig.cron) {
    throw workflowValidationError('Scheduled workflows require a cron expression.');
  }

  if (workflow.triggerType === 'webhook' && !workflow.triggerConfig.webhookSecret) {
    throw workflowValidationError('Webhook workflows require a webhook secret.');
  }

  if (workflow.triggerType === 'event' && !workflow.triggerConfig.eventType) {
    throw workflowValidationError('Event workflows require an event type.');
  }

  return workflow;
}

export async function executeWorkflowRun({ runId, workflow, orgContext }) {
  const existingRun = await db.query.workflowRuns.findFirst({
    where: eq(workflowRuns.id, runId),
  });

  if (!existingRun) {
    throw Object.assign(new Error('Workflow run not found.'), { code: 'WORKFLOW_RUN_NOT_FOUND', status: 404 });
  }

  if (existingRun.status === 'completed' || existingRun.status === 'cancelled') {
    return {
      nodeOutputs: existingRun.nodeOutputs ?? {},
      creditsUsed: existingRun.creditsUsed ?? 0,
    };
  }

  const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);
  const nodeOutputs = { ...(existingRun.nodeOutputs ?? {}) };
  const runLog = [...(existingRun.runLog ?? [])];
  let totalCredits = existingRun.creditsUsed ?? 0;
  let activeNode = null;
  const attemptCount = (existingRun.attemptCount ?? 0) + 1;
  const maxAttempts = existingRun.maxAttempts ?? DEFAULT_MAX_WORKFLOW_ATTEMPTS;
  const timeoutAt = new Date(Date.now() + WORKFLOW_RUN_TIMEOUT_MS);

  assertCreditsAvailable(orgContext, 1);

  appendRunLog(
    runLog,
    'system',
    `Workflow queued for execution. ${sortedNodes.length} node${sortedNodes.length === 1 ? '' : 's'} in plan.`,
    { attemptCount, maxAttempts },
  );

  await db
    .update(workflowRuns)
    .set({
      status: 'running',
      startedAt: existingRun.startedAt ?? new Date(),
      attemptCount,
      maxAttempts,
      failureClass: null,
      lastHeartbeatAt: new Date(),
      timeoutAt,
      runLog,
    })
    .where(sql`${workflowRuns.id} = ${runId}`);

  try {
    for (const node of sortedNodes) {
      activeNode = node;
      assertRunNotTimedOut(timeoutAt);
      const upstreamContext = buildUpstreamContext(node.id, workflow.nodes, workflow.edges, nodeOutputs);
      appendRunLog(runLog, 'node', `Preparing ${node.label ?? node.id}.`, {
        nodeId: node.id,
        agentId: node.agentId,
        outputVar: node.outputVar,
        attemptCount,
      });

      if (!shouldRunNode(node, upstreamContext)) {
        nodeOutputs[node.id] = {
          skipped: true,
          outputVar: node.outputVar,
        };
        appendRunLog(runLog, 'node', `${node.label ?? node.id} skipped because its conditions were not met.`, {
          nodeId: node.id,
          agentId: node.agentId,
          skipped: true,
        });
        continue;
      }

      const nodeStartedAt = Date.now();
      const result = await runWithTimeout(
        runAgentNode({
          agentId: node.agentId,
          orgId: workflow.orgId,
          orgPlan: orgContext.orgPlan,
          prompt: node.prompt,
          context: {
            ...upstreamContext,
            __workflowRunId: runId,
            __workflowNodeCount: sortedNodes.length,
          },
        }),
        WORKFLOW_NODE_TIMEOUT_MS,
        `${node.label ?? node.id} exceeded the node timeout.`,
      );

      const nodeCreditCost = Math.max(Math.ceil((result.totalTokens ?? 0) / 1000), 1);
      totalCredits += nodeCreditCost;

      nodeOutputs[node.id] = {
        outputVar: node.outputVar,
        text: result.text,
        model: result.model,
        totalTokens: result.totalTokens,
        sourceCount: result.sources.length,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - nodeStartedAt,
      };
      appendRunLog(runLog, 'node', `${node.label ?? node.id} completed successfully.`, {
        nodeId: node.id,
        agentId: node.agentId,
        totalTokens: result.totalTokens ?? 0,
        creditsUsed: nodeCreditCost,
        durationMs: Date.now() - nodeStartedAt,
      });

      const evaluation = evaluateAgentOutput({
        agentId: node.agentId,
        text: result.text,
        sources: result.sources ?? [],
        usedTools: result.trace?.toolsUsed ?? [],
        structuredOutput: null,
      });

      await recordLLMExecutionTrace({
        orgId: workflow.orgId,
        userId: orgContext.userId ?? null,
        workflowRunId: runId,
        agentId: node.agentId,
        provider: result.provider,
        model: result.model,
        policyKey: result.trace?.policyKey ?? 'workflow_automation',
        route: result.route,
        routeReason: result.routeReason ?? null,
        fallbackUsed: result.trace?.fallbackUsed ?? false,
        latencyMs: Date.now() - nodeStartedAt,
        promptTokens: result.inputTokens ?? null,
        completionTokens: result.outputTokens ?? null,
        totalTokens: result.totalTokens ?? null,
        toolsUsed: result.trace?.toolsUsed ?? [],
        loreChunkIds: result.trace?.loreChunkIds ?? [],
        loreDocumentIds: result.trace?.loreDocumentIds ?? [],
        memoryReadIds: result.trace?.memoryReadIds ?? [],
        memoryWriteKeys: [],
        outcomeStatus: 'succeeded',
        metadata: {
          mode: 'workflow',
          workflowId: workflow.id,
          nodeId: node.id,
          outputVar: node.outputVar,
          sourceCount: result.sources?.length ?? 0,
          sources: result.sources ?? [],
          evaluation,
          contract: result.trace?.selectionDetails?.contract ?? null,
          policyClass: result.trace?.selectionDetails?.policyClass ?? result.trace?.policyKey ?? null,
          fallbackModel: result.trace?.selectionDetails?.fallbackModelUsed ?? null,
          schemaValidation: result.trace?.schemaValidation ?? null,
          routing: result.trace?.selectionDetails ?? {},
        },
      });

      await db
        .update(workflowRuns)
        .set({
          nodeOutputs,
          runLog,
          creditsUsed: totalCredits,
          lastHeartbeatAt: new Date(),
        })
        .where(sql`${workflowRuns.id} = ${runId}`);

      await deliverWorkflowWebhook({
        orgId: orgContext.orgId,
        workflowId: workflow.id,
        event: 'workflow.node.completed',
        payload: {
          runId,
          status: 'running',
          creditsUsed: totalCredits,
          nodeId: node.id,
          agentId: node.agentId,
          outputVar: node.outputVar,
          nodeOutput: nodeOutputs[node.id],
        },
      }).catch((err) => console.error('[WEBHOOK] Delivery error:', err.message));

      activeNode = null;
    }

    await consumeCredits(workflow.orgId, totalCredits);
    appendRunLog(runLog, 'system', `Workflow completed. ${totalCredits} credit${totalCredits === 1 ? '' : 's'} consumed.`);

    await db
      .update(workflowRuns)
      .set({
        status: 'completed',
        completedAt: new Date(),
        nodeOutputs,
        runLog,
        creditsUsed: totalCredits,
        lastHeartbeatAt: new Date(),
      })
      .where(sql`${workflowRuns.id} = ${runId}`);

    await deliverWorkflowWebhook({
      orgId: orgContext.orgId,
      workflowId: workflow.id,
      event: 'workflow.completed',
      payload: {
        runId,
        status: 'completed',
        creditsUsed: totalCredits,
        nodeOutputs,
      },
    }).catch((err) => console.error('[WEBHOOK] Delivery error:', err.message));

    await db
      .update(workflows)
      .set({
        runCount: sql`${workflows.runCount} + 1`,
        lastRunAt: new Date(),
      })
      .where(sql`${workflows.id} = ${workflow.id}`);

    return {
      nodeOutputs,
      creditsUsed: totalCredits,
    };
  } catch (error) {
    const failureClass = classifyWorkflowFailure(error);
    appendRunLog(runLog, 'error', error.message, {
      code: error.code ?? 'WORKFLOW_RUN_FAILED',
      failureClass,
      attemptCount,
    });

    if (shouldRetryWorkflowRun({ failureClass, attemptCount, maxAttempts })) {
      if (activeNode?.id) {
        await deliverWorkflowWebhook({
          orgId: orgContext.orgId,
          workflowId: workflow.id,
          event: 'workflow.node.failed',
          payload: {
            runId,
            status: 'queued',
            creditsUsed: totalCredits,
            nodeId: activeNode.id,
            agentId: activeNode.agentId,
            outputVar: activeNode.outputVar,
            error: error.message,
            failureClass,
          },
        }).catch((err) => console.error('[WEBHOOK] Delivery error:', err.message));
      }

      await db
        .update(workflowRuns)
        .set({
          status: 'queued',
          failureClass,
          errorLog: error.message,
          nodeOutputs,
          runLog,
          creditsUsed: totalCredits,
          lastHeartbeatAt: new Date(),
        })
        .where(sql`${workflowRuns.id} = ${runId}`);

      queueWorkflowRetry({ runId, workflow, orgContext });

      return {
        nodeOutputs,
        creditsUsed: totalCredits,
        retried: true,
      };
    }

    await db
      .update(workflowRuns)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorLog: error.message,
        failureClass,
        nodeOutputs,
        runLog,
        creditsUsed: totalCredits,
        lastHeartbeatAt: new Date(),
      })
      .where(sql`${workflowRuns.id} = ${runId}`);

    if (activeNode?.id) {
      await deliverWorkflowWebhook({
        orgId: orgContext.orgId,
        workflowId: workflow.id,
        event: 'workflow.node.failed',
        payload: {
          runId,
          status: 'failed',
          creditsUsed: totalCredits,
          nodeId: activeNode.id,
          agentId: activeNode.agentId,
          outputVar: activeNode.outputVar,
          error: error.message,
          failureClass,
        },
      }).catch((err) => console.error('[WEBHOOK] Delivery error:', err.message));
    }

    await deliverWorkflowWebhook({
      orgId: orgContext.orgId,
      workflowId: workflow.id,
      event: 'workflow.failed',
      payload: {
        runId,
        status: 'failed',
        creditsUsed: totalCredits,
        nodeOutputs,
        error: error.message,
        failureClass,
      },
    }).catch((err) => console.error('[WEBHOOK] Delivery error:', err.message));

    if (error.llmMeta) {
      await recordLLMExecutionTrace({
        ...error.llmMeta,
        workflowRunId: runId,
        latencyMs: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        memoryWriteKeys: [],
        outcomeStatus: 'failed',
        failureClass,
        metadata: {
          mode: 'workflow',
          workflowId: workflow.id,
          contract: error.llmMeta?.selectionDetails?.contract ?? null,
          policyClass: error.llmMeta?.selectionDetails?.policyClass ?? error.llmMeta?.policyKey ?? null,
          fallbackModel: error.llmMeta?.selectionDetails?.fallbackModelUsed ?? null,
          sources: error.llmMeta?.sources ?? [],
          routing: error.llmMeta?.selectionDetails ?? {},
          ...(error.llmMeta.metadata ?? {}),
        },
      });
    }

    throw error;
  }
}

function appendRunLog(runLog, level, message, metadata = {}) {
  runLog.push({
    at: new Date().toISOString(),
    level,
    message,
    metadata,
  });
}

export function topologicalSort(nodes, edges) {
  const graph = new Map(nodes.map((node) => [node.id, []]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const sorted = [];

  while (queue.length) {
    const currentId = queue.shift();
    const node = nodes.find((entry) => entry.id === currentId);

    if (node) {
      sorted.push(node);
    }

    for (const nextId of graph.get(currentId) ?? []) {
      indegree.set(nextId, (indegree.get(nextId) ?? 1) - 1);
      if (indegree.get(nextId) === 0) {
        queue.push(nextId);
      }
    }
  }

  return sorted;
}

function hasCycle(nodes, edges) {
  return topologicalSort(nodes, edges).length !== nodes.length;
}

function buildUpstreamContext(nodeId, nodes, edges, nodeOutputs) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const context = {};

  for (const edge of edges.filter((entry) => entry.to === nodeId)) {
    const output = nodeOutputs[edge.from];
    if (!output) {
      continue;
    }

    const upstreamNode = nodeById.get(edge.from);
    const value = output.text ?? '';

    context[edge.from] = value;
    if (upstreamNode?.outputVar) {
      context[upstreamNode.outputVar] = value;
    }
  }

  return context;
}

function shouldRunNode(node, context) {
  if (!node.conditions?.length) {
    return true;
  }

  return node.conditions.every((condition) => {
    const value = String(context[condition.field] ?? '');

    switch (condition.operator) {
      case 'contains':
        return value.toLowerCase().includes(String(condition.value ?? '').toLowerCase());
      case 'equals':
        return value === String(condition.value ?? '');
      case 'not_empty':
        return value.trim().length > 0;
      case 'gt':
        return Number(value) > Number(condition.value ?? 0);
      case 'lt':
        return Number(value) < Number(condition.value ?? 0);
      default:
        return true;
    }
  });
}

function workflowValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_WORKFLOW';
  return error;
}

function assertRunNotTimedOut(timeoutAt) {
  if (timeoutAt && timeoutAt.getTime() < Date.now()) {
    const error = new Error('Workflow run exceeded the maximum execution window.');
    error.code = 'WORKFLOW_RUN_TIMEOUT';
    error.status = 504;
    throw error;
  }
}

function runWithTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(message);
        error.code = 'WORKFLOW_NODE_TIMEOUT';
        error.status = 504;
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

function classifyWorkflowFailure(error) {
  if (!error) {
    return 'runtime';
  }

  if (/WORKFLOW_(RUN|NODE)_TIMEOUT/.test(error.code ?? '')) {
    return 'timeout';
  }

  if (/CREDITS_EXHAUSTED/.test(error.code ?? '')) {
    return 'credits';
  }

  if (/INVALID_WORKFLOW|VALIDATION/.test(error.code ?? '')) {
    return 'validation';
  }

  if (error.llmMeta) {
    return classifyLLMFailure(error);
  }

  return 'runtime';
}

function shouldRetryWorkflowRun({ failureClass, attemptCount, maxAttempts }) {
  if (attemptCount >= maxAttempts) {
    return false;
  }

  return ['timeout', 'rate_limit', 'provider_unavailable', 'runtime'].includes(failureClass);
}

function queueWorkflowRetry({ runId, workflow, orgContext }) {
  queueMicrotask(async () => {
    try {
      // Import via trigger.js so Trigger.dev dispatch path is respected on retry
      const { dispatchWorkflowRun } = await import('../queue/trigger.js');
      await dispatchWorkflowRun({ runId, workflow, orgContext });
    } catch (error) {
      console.error('[WORKFLOW] Retry dispatch failed:', error.message);
    }
  });
}
