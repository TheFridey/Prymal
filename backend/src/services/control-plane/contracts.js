import { z } from 'zod';
import { validateSchemaShape } from './schema-validator.js';

export const STRICT_NODE_TYPES = ['agent', 'tool', 'validator', 'decision'];
export const RETRY_STRATEGIES = ['none', 'fixed', 'linear', 'exponential'];

const jsonSchemaObject = z.record(z.any()).superRefine((value, ctx) => {
  try {
    validateSchemaShape(value);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error.message,
    });
  }
});

const inputBindingSchema = z.record(
  z.string().regex(/^\$(workflow|nodes|context)(\.[A-Za-z0-9_-]+|\[[0-9]+\])*$/, {
    message: 'Input bindings must use $workflow, $nodes, or $context paths.',
  }),
);

export const strictRetryPolicySchema = z.object({
  attempts: z.number().int().min(1).max(5).default(1),
  strategy: z.enum(RETRY_STRATEGIES).default('none'),
  delay_ms: z.number().int().min(0).max(60_000).default(0),
});

export const strictWorkflowNodeSchema = z.object({
  id: z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(STRICT_NODE_TYPES),
  input_schema: jsonSchemaObject,
  output_schema: jsonSchemaObject,
  allowed_tools: z.array(z.string().min(1).max(120)).max(50).default([]),
  retry_policy: strictRetryPolicySchema.default({ attempts: 1, strategy: 'none', delay_ms: 0 }),
  fallback_node: z.string().min(1).max(120).nullable().optional(),
  timeout_ms: z.number().int().min(100).max(15 * 60_000),
  cost_limit: z.number().min(0).max(10_000),
  input_bindings: inputBindingSchema.default({}),
  config: z.record(z.any()).default({}),
  label: z.string().min(1).max(160).optional(),
});

export const strictWorkflowEdgeSchema = z.object({
  from: z.string().min(1).max(120),
  to: z.string().min(1).max(120),
  condition: z
    .object({
      path: z.string().min(1),
      equals: z.any().optional(),
      exists: z.boolean().optional(),
    })
    .optional(),
});

export const strictWorkflowDefinitionSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(80).default('1.0.0'),
  workflow_type: z.string().min(1).max(120).default('general'),
  state_schema: jsonSchemaObject.optional(),
  nodes: z.array(strictWorkflowNodeSchema).min(1).max(100),
  edges: z.array(strictWorkflowEdgeSchema).max(500).default([]),
  metadata: z.record(z.any()).default({}),
});

export function validateStrictWorkflowDefinition(input) {
  const workflow = strictWorkflowDefinitionSchema.parse(input);
  const nodeIds = new Set();

  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      throw workflowDefinitionError(`Duplicate node id "${node.id}".`);
    }
    nodeIds.add(node.id);

    if (node.type === 'tool') {
      const toolName = node.config?.tool_name;
      if (!toolName) {
        throw workflowDefinitionError(`Tool node "${node.id}" must define config.tool_name.`);
      }
      if (!node.allowed_tools.includes(toolName)) {
        throw workflowDefinitionError(`Tool node "${node.id}" must whitelist config.tool_name in allowed_tools.`);
      }
    }
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw workflowDefinitionError(`Edge "${edge.from}" -> "${edge.to}" must reference existing nodes.`);
    }
    if (edge.from === edge.to) {
      throw workflowDefinitionError(`Node "${edge.from}" cannot point to itself.`);
    }
  }

  for (const node of workflow.nodes) {
    if (node.fallback_node && !nodeIds.has(node.fallback_node)) {
      throw workflowDefinitionError(`Fallback node "${node.fallback_node}" for "${node.id}" does not exist.`);
    }
    if (node.fallback_node === node.id) {
      throw workflowDefinitionError(`Node "${node.id}" cannot use itself as a fallback.`);
    }
  }

  if (hasCycle(workflow.nodes, workflow.edges)) {
    throw workflowDefinitionError('Strict workflows must be DAGs and cannot contain cycles.');
  }

  enforceExplicitStateBindings(workflow);

  return workflow;
}

export function topologicalSortStrict(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const graph = new Map(nodes.map((node) => [node.id, []]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    graph.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort();
  const sorted = [];

  while (queue.length) {
    const current = queue.shift();
    const node = byId.get(current);
    if (node) sorted.push(node);

    for (const next of graph.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if (indegree.get(next) === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  return sorted;
}

function enforceExplicitStateBindings(workflow) {
  const incoming = new Map(workflow.nodes.map((node) => [node.id, 0]));
  for (const edge of workflow.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  for (const node of workflow.nodes) {
    const hasStaticInput = node.config?.static_input && Object.keys(node.config.static_input).length > 0;
    const hasBindings = Object.keys(node.input_bindings ?? {}).length > 0;
    const isRoot = (incoming.get(node.id) ?? 0) === 0;

    if (!isRoot && !hasBindings && !hasStaticInput) {
      throw workflowDefinitionError(
        `Node "${node.id}" has upstream dependencies but no explicit input_bindings or config.static_input.`,
      );
    }
  }
}

function hasCycle(nodes, edges) {
  return topologicalSortStrict(nodes, edges).length !== nodes.length;
}

function workflowDefinitionError(message) {
  const error = new Error(message);
  error.code = 'INVALID_STRICT_WORKFLOW';
  error.status = 400;
  return error;
}
