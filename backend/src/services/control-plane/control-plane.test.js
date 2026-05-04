import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DeclarativePolicyEngine,
  DeterministicExecutionEngine,
  InMemoryTraceSink,
  LoreContextProvider,
  NativeRuntimeAdapter,
  POLICY_ACTIONS,
  RuntimeRegistry,
  WorkflowTraceRecorder,
  validateStrictWorkflowDefinition,
} from './index.js';

const objectSchema = {
  type: 'object',
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
};

const outputSchema = {
  type: 'object',
  required: ['answer'],
  properties: {
    answer: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
};

function buildWorkflow(overrides = {}) {
  return {
    id: 'strict-workflow',
    name: 'Strict workflow',
    version: '1.0.0',
    workflow_type: 'research',
    nodes: [
      {
        id: 'extract',
        type: 'agent',
        input_schema: objectSchema,
        output_schema: outputSchema,
        allowed_tools: ['lore_search'],
        retry_policy: { attempts: 1, strategy: 'none', delay_ms: 0 },
        timeout_ms: 5000,
        cost_limit: 1,
        input_bindings: {},
        config: { lore_top_k: 2 },
      },
    ],
    edges: [],
    metadata: {},
    ...overrides,
  };
}

test('strict workflow definitions reject cycles and implicit upstream state', () => {
  assert.throws(
    () => validateStrictWorkflowDefinition(buildWorkflow({
      nodes: [
        buildWorkflow().nodes[0],
        {
          ...buildWorkflow().nodes[0],
          id: 'summarise',
        },
      ],
      edges: [{ from: 'extract', to: 'summarise' }],
    })),
    /no explicit input_bindings/,
  );

  assert.throws(
    () => validateStrictWorkflowDefinition(buildWorkflow({
      nodes: [
        {
          ...buildWorkflow().nodes[0],
          input_bindings: { query: '$nodes.summarise.output.answer' },
        },
        {
          ...buildWorkflow().nodes[0],
          id: 'summarise',
          input_bindings: { query: '$nodes.extract.output.answer' },
        },
      ],
      edges: [
        { from: 'extract', to: 'summarise' },
        { from: 'summarise', to: 'extract' },
      ],
    })),
    /DAGs/,
  );
});

test('deterministic engine injects top-k LORE context and records a complete trace', async () => {
  const sink = new InMemoryTraceSink();
  const native = new NativeRuntimeAdapter({
    executors: {
      agent: async ({ input, loreContext }) => ({
        output: { answer: `${input.query}:${loreContext.map((item) => item.id).join(',')}` },
        tokenUsage: { prompt: 12, completion: 4, total: 16 },
        cost: 0.01,
        metadata: { toolsUsed: ['lore_search'] },
      }),
    },
  });
  const engine = new DeterministicExecutionEngine({
    loreProvider: new LoreContextProvider({
      defaultTopK: 2,
      vectorMemory: {
        search: async () => [
          { id: 'old', content: 'Old context', score: 0.9, updatedAt: '2025-01-01T00:00:00.000Z' },
          { id: 'fresh', content: 'Fresh context', score: 0.85, updatedAt: '2026-05-03T00:00:00.000Z' },
        ],
      },
      knowledgeGraph: {
        query: async () => [
          { id: 'entity', content: 'Entity link', score: 0.8, updatedAt: '2026-05-04T00:00:00.000Z' },
        ],
      },
      executionMemory: { findRelevant: async () => [] },
      clock: () => new Date('2026-05-04T12:00:00.000Z'),
    }),
    runtimeRegistry: new RuntimeRegistry({ adapters: { native } }),
    traceRecorder: new WorkflowTraceRecorder({ sink }),
    sleep: async () => {},
  });

  const result = await engine.executeWorkflow({
    workflow: buildWorkflow(),
    input: { query: 'launch risk' },
    context: { orgId: 'org_1', userId: 'user_1', userRole: 'member' },
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.trace.node_logs.length, 1);
  assert.equal(result.trace.node_logs[0].lore_context.length, 2);
  assert.equal(result.trace.node_logs[0].status, 'completed');
  assert.equal(result.trace.node_logs[0].token_usage.total, 16);
  assert.equal(sink.latest().execution_id, result.execution_id);
});

test('WARDEN policy is evaluated before runtime execution', async () => {
  let executed = false;
  const native = new NativeRuntimeAdapter({
    executors: {
      tool: async () => {
        executed = true;
        return { output: { answer: 'sent' }, cost: 0 };
      },
    },
  });
  const policyEngine = new DeclarativePolicyEngine({
    policyProvider: () => ({
      version: '1',
      default_action: POLICY_ACTIONS.ALLOW,
      cumulative_risk_limit: 0.85,
      policies: [
        {
          id: 'block-email',
          action: POLICY_ACTIONS.BLOCK,
          priority: 1000,
          risk_score: 0.9,
          reason: 'Email sending disabled in this environment.',
          conditions: { tools: ['email_send'] },
        },
      ],
    }),
  });
  const workflow = buildWorkflow({
    nodes: [
      {
        ...buildWorkflow().nodes[0],
        type: 'tool',
        allowed_tools: ['email_send'],
        config: { tool_name: 'email_send' },
      },
    ],
  });
  const engine = new DeterministicExecutionEngine({
    policyEngine,
    runtimeRegistry: new RuntimeRegistry({ adapters: { native } }),
    sleep: async () => {},
  });

  const result = await engine.executeWorkflow({
    workflow,
    input: { query: 'send update' },
    context: { orgId: 'org_1', userRole: 'member' },
  });

  assert.equal(executed, false);
  assert.equal(result.status, 'degraded');
  assert.equal(result.trace.policy_interventions[0].action, POLICY_ACTIONS.BLOCK);
  assert.equal(result.trace.failure_points[0].code, 'WARDEN_POLICY_BLOCKED');
});

test('invalid outputs retry, use fallback, and keep the workflow recoverable', async () => {
  let primaryAttempts = 0;
  const native = new NativeRuntimeAdapter({
    executors: {
      agent: async ({ node }) => {
        if (node.id === 'fallback') {
          return { output: { answer: 'fallback answer' }, cost: 0.01 };
        }
        primaryAttempts += 1;
        return { output: { notAnswer: 'bad shape' }, cost: 0.01 };
      },
    },
  });
  const workflow = buildWorkflow({
    nodes: [
      {
        ...buildWorkflow().nodes[0],
        retry_policy: { attempts: 2, strategy: 'fixed', delay_ms: 0 },
        fallback_node: 'fallback',
      },
      {
        ...buildWorkflow().nodes[0],
        id: 'fallback',
      },
    ],
  });
  const engine = new DeterministicExecutionEngine({
    runtimeRegistry: new RuntimeRegistry({ adapters: { native } }),
    sleep: async () => {},
  });

  const result = await engine.executeWorkflow({
    workflow,
    input: { query: 'recover' },
    context: { orgId: 'org_1', userRole: 'member' },
  });

  assert.equal(primaryAttempts, 2);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.outputs.extract, { answer: 'fallback answer' });
  assert.equal(result.node_statuses.fallback, 'completed');
  assert.equal(result.trace.failure_points[0].code, 'NODE_OUTPUT_SCHEMA_VALIDATION_FAILED');
});

test('tool usage outside allowed_tools degrades the node without silent success', async () => {
  const native = new NativeRuntimeAdapter({
    executors: {
      agent: async () => ({
        output: { answer: 'used tool' },
        cost: 0,
        metadata: { toolsUsed: ['email_send'] },
      }),
    },
  });
  const engine = new DeterministicExecutionEngine({
    runtimeRegistry: new RuntimeRegistry({ adapters: { native } }),
    sleep: async () => {},
  });

  const result = await engine.executeWorkflow({
    workflow: buildWorkflow(),
    input: { query: 'unsafe tool' },
    context: { orgId: 'org_1', userRole: 'member' },
  });

  assert.equal(result.status, 'degraded');
  assert.equal(result.trace.failure_points[0].code, 'NODE_TOOL_WHITELIST_VIOLATION');
});
