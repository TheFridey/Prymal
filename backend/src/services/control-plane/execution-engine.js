import { validateStrictWorkflowDefinition, topologicalSortStrict } from './contracts.js';
import { assertJsonSchema } from './schema-validator.js';
import { LoreContextProvider } from './lore-context.js';
import { DeclarativePolicyEngine, POLICY_ACTIONS } from './policy-engine.js';
import { WorkflowTraceRecorder } from './observability.js';
import { RUNTIME_TYPES, createDefaultRuntimeRegistry } from './runtime-adapters.js';

export class DeterministicExecutionEngine {
  constructor({
    policyEngine = new DeclarativePolicyEngine(),
    loreProvider = new LoreContextProvider(),
    traceRecorder = new WorkflowTraceRecorder(),
    runtimeRegistry = createDefaultRuntimeRegistry(),
    clock = () => new Date(),
    sleep = defaultSleep,
  } = {}) {
    this.policyEngine = policyEngine;
    this.loreProvider = loreProvider;
    this.traceRecorder = traceRecorder;
    this.runtimeRegistry = runtimeRegistry;
    this.clock = clock;
    this.sleep = sleep;
  }

  async executeWorkflow({ workflow: rawWorkflow, input = {}, context = {}, simulation = false }) {
    const workflow = validateStrictWorkflowDefinition(rawWorkflow);
    const sortedNodes = topologicalSortStrict(workflow.nodes, workflow.edges);
    const trace = this.traceRecorder.startWorkflow({
      workflowId: workflow.id,
      orgId: context.orgId ?? null,
      userId: context.userId ?? null,
      metadata: {
        workflowType: workflow.workflow_type,
        simulation,
      },
    });
    const state = {
      workflowInput: input,
      nodes: {},
      cumulativeRisk: 0,
      degraded: false,
    };

    for (const node of sortedNodes) {
      if (state.nodes[node.id]?.status === 'completed') {
        continue;
      }

      if (!edgeConditionsPass({ workflow, node, state })) {
        state.nodes[node.id] = { status: 'skipped', output: null };
        this.traceRecorder.appendNodeLog(trace, {
          nodeId: node.id,
          nodeType: node.type,
          status: 'skipped',
          retries: 0,
          metadata: { reason: 'edge_condition_not_met' },
        });
        continue;
      }

      const nodeResult = await this.executeNode({
        workflow,
        node,
        state,
        context,
        trace,
        simulation,
      });

      state.nodes[node.id] = nodeResult.stateEntry;
      if (nodeResult.stateEntry.status !== 'completed' && nodeResult.stateEntry.status !== 'simulated') {
        state.degraded = true;
      }
    }

    const finalStatus = simulation ? 'simulated' : state.degraded ? 'degraded' : 'completed';
    const finishedTrace = await this.traceRecorder.finishWorkflow(trace, {
      status: finalStatus,
      metadata: {
        cumulativeRisk: state.cumulativeRisk,
      },
    });

    return {
      status: finalStatus,
      workflow_id: workflow.id,
      execution_id: finishedTrace.execution_id,
      outputs: Object.fromEntries(
        Object.entries(state.nodes).map(([nodeId, entry]) => [nodeId, entry.output ?? null]),
      ),
      node_statuses: Object.fromEntries(
        Object.entries(state.nodes).map(([nodeId, entry]) => [nodeId, entry.status]),
      ),
      trace: finishedTrace,
    };
  }

  async executeNode({ workflow, node, state, context, trace, simulation, inputOverride = null }) {
    const startedAt = this.clock();
    const policyDecisions = [];
    const errors = [];
    let resolvedInput;
    let loreContext = [];

    try {
      resolvedInput = inputOverride ?? resolveNodeInput({ workflow, node, state, context });
      assertJsonSchema(node.input_schema, resolvedInput, {
        code: 'NODE_INPUT_SCHEMA_VALIDATION_FAILED',
        schemaName: `${node.id}.input_schema`,
      });
    } catch (error) {
      errors.push(formatError(error));
      this.traceRecorder.appendFailure(trace, {
        nodeId: node.id,
        code: error.code ?? 'NODE_INPUT_SCHEMA_VALIDATION_FAILED',
        message: error.message,
        recoverable: true,
      });
      this.traceRecorder.appendNodeLog(trace, {
        nodeId: node.id,
        nodeType: node.type,
        status: 'degraded',
        input: resolvedInput ?? null,
        retries: 0,
        errors,
        startedAt: startedAt.toISOString(),
      });

      return {
        stateEntry: {
          status: 'degraded',
          output: null,
          error: error.message,
        },
      };
    }

    loreContext = await this.loreProvider.buildContext({
      orgId: context.orgId,
      userId: context.userId ?? null,
      workflowId: workflow.id,
      workflowType: workflow.workflow_type,
      nodeId: node.id,
      nodeType: node.type,
      input: resolvedInput,
      topK: node.config?.lore_top_k ?? 5,
    });

    const policyDecision = await this.evaluateNodePolicy({
      workflow,
      node,
      input: resolvedInput,
      context,
      cumulativeRisk: state.cumulativeRisk,
      simulation,
    });
    policyDecisions.push(policyDecision);
    state.cumulativeRisk = policyDecision.cumulativeRisk;

    if (policyDecision.action !== POLICY_ACTIONS.ALLOW) {
      this.traceRecorder.appendPolicyIntervention(trace, {
        nodeId: node.id,
        action: policyDecision.action,
        riskScore: policyDecision.riskScore,
        cumulativeRisk: policyDecision.cumulativeRisk,
        matchedPolicies: policyDecision.matchedPolicies,
      });
    }

    if (policyDecision.blocked || (policyDecision.requiresApproval && !isApproved(node, context))) {
      const message = policyDecision.blocked
        ? 'Node blocked by WARDEN policy.'
        : 'Node requires approval before execution.';
      this.traceRecorder.appendFailure(trace, {
        nodeId: node.id,
        code: policyDecision.blocked ? 'WARDEN_POLICY_BLOCKED' : 'WARDEN_APPROVAL_REQUIRED',
        message,
        recoverable: true,
      });
      this.traceRecorder.appendNodeLog(trace, {
        nodeId: node.id,
        nodeType: node.type,
        status: 'degraded',
        input: resolvedInput,
        retries: 0,
        policyDecisions,
        loreContext,
        errors: [{ code: policyDecision.blocked ? 'WARDEN_POLICY_BLOCKED' : 'WARDEN_APPROVAL_REQUIRED', message }],
        startedAt: startedAt.toISOString(),
      });

      return {
        stateEntry: {
          status: 'degraded',
          output: null,
          error: message,
        },
      };
    }

    const runtimeInput = applyPolicyModifications(resolvedInput, policyDecision.modifications);

    if (simulation) {
      this.traceRecorder.appendNodeLog(trace, {
        nodeId: node.id,
        nodeType: node.type,
        status: 'simulated',
        input: runtimeInput,
        retries: 0,
        policyDecisions,
        loreContext,
        startedAt: startedAt.toISOString(),
      });

      return {
        stateEntry: {
          status: 'simulated',
          output: null,
        },
      };
    }

    const execution = await this.executeNodeWithAttempts({
      workflow,
      node,
      input: runtimeInput,
      loreContext,
      context,
      trace,
      policyDecisions,
      startedAt,
    });

    if (execution.status === 'completed') {
      await this.loreProvider.recordExecutionOutcome({
        orgId: context.orgId,
        workflowId: workflow.id,
        nodeId: node.id,
        status: 'completed',
        output: execution.output,
        metadata: execution.metadata ?? {},
      });
      return { stateEntry: { status: 'completed', output: execution.output } };
    }

    if (node.fallback_node) {
      const fallback = await this.executeFallbackNode({
        workflow,
        failedNode: node,
        fallbackNodeId: node.fallback_node,
        failedInput: runtimeInput,
        state,
        context,
        trace,
        simulation,
      });

      if (fallback.status === 'completed') {
        await this.loreProvider.recordExecutionOutcome({
          orgId: context.orgId,
          workflowId: workflow.id,
          nodeId: node.id,
          status: 'fallback_completed',
          output: fallback.output,
          metadata: { fallbackNode: node.fallback_node },
        });
        return { stateEntry: { status: 'completed', output: fallback.output, fallbackNode: node.fallback_node } };
      }
    }

    await this.loreProvider.recordExecutionOutcome({
      orgId: context.orgId,
      workflowId: workflow.id,
      nodeId: node.id,
      status: 'degraded',
      error: execution.error,
    });

    return {
      stateEntry: {
        status: 'degraded',
        output: null,
        error: execution.error,
      },
    };
  }

  async executeNodeWithAttempts({
    workflow,
    node,
    input,
    loreContext,
    context,
    trace,
    policyDecisions,
    startedAt,
  }) {
    const attempts = node.retry_policy.attempts;
    const errors = [];
    let lastResult = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        lastResult = await runWithTimeout(
          this.runtimeRegistry.execute({
            workflow,
            node,
            input,
            loreContext,
            context,
            trace,
          }, node.config?.runtime_type ?? RUNTIME_TYPES.NATIVE),
          node.timeout_ms,
          `Node "${node.id}" exceeded timeout_ms.`,
        );

        const output = lastResult?.output ?? null;
        assertJsonSchema(node.output_schema, output, {
          code: 'NODE_OUTPUT_SCHEMA_VALIDATION_FAILED',
          schemaName: `${node.id}.output_schema`,
        });
        enforceToolUsage(node, lastResult?.metadata?.toolsUsed ?? []);
        enforceCostLimit(node, lastResult?.cost ?? 0);

        const completedAt = this.clock();
        this.traceRecorder.appendNodeLog(trace, {
          nodeId: node.id,
          nodeType: node.type,
          status: 'completed',
          input,
          output,
          latencyMs: completedAt.getTime() - startedAt.getTime(),
          tokenUsage: lastResult?.tokenUsage ?? null,
          cost: lastResult?.cost ?? null,
          retries: attempt - 1,
          policyDecisions,
          loreContext,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          metadata: lastResult?.metadata ?? {},
        });

        return {
          status: 'completed',
          output,
          metadata: lastResult?.metadata ?? {},
        };
      } catch (error) {
        errors.push(formatError(error));
        if (attempt < attempts) {
          await this.sleep(calculateRetryDelay(node.retry_policy, attempt));
        }
      }
    }

    const message = errors.at(-1)?.message ?? `Node "${node.id}" failed.`;
    this.traceRecorder.appendFailure(trace, {
      nodeId: node.id,
      code: errors.at(-1)?.code ?? 'NODE_EXECUTION_FAILED',
      message,
      recoverable: true,
    });
    this.traceRecorder.appendNodeLog(trace, {
      nodeId: node.id,
      nodeType: node.type,
      status: 'degraded',
      input,
      output: lastResult?.output ?? null,
      retries: attempts - 1,
      policyDecisions,
      loreContext,
      errors,
      startedAt: startedAt.toISOString(),
    });

    return {
      status: 'degraded',
      output: null,
      error: message,
    };
  }

  async executeFallbackNode({ workflow, failedNode, fallbackNodeId, failedInput, state, context, trace, simulation }) {
    const fallbackNode = workflow.nodes.find((entry) => entry.id === fallbackNodeId);
    if (!fallbackNode) {
      return { status: 'degraded', output: null, error: `Fallback node "${fallbackNodeId}" not found.` };
    }

    const fallbackInput = Object.keys(fallbackNode.input_bindings ?? {}).length || fallbackNode.config?.static_input
      ? resolveNodeInput({ workflow, node: fallbackNode, state, context })
      : failedInput;
    const result = await this.executeNode({
      workflow,
      node: fallbackNode,
      state,
      context: {
        ...context,
        fallbackFor: failedNode.id,
      },
      trace,
      simulation,
      inputOverride: fallbackInput,
    });

    if (result.stateEntry.status !== 'completed') {
      return { status: 'degraded', output: null, error: result.stateEntry.error };
    }

    assertJsonSchema(failedNode.output_schema, result.stateEntry.output, {
      code: 'FALLBACK_OUTPUT_SCHEMA_VALIDATION_FAILED',
      schemaName: `${failedNode.id}.fallback_output_schema`,
    });
    state.nodes[fallbackNode.id] = result.stateEntry;

    return {
      status: 'completed',
      output: result.stateEntry.output,
    };
  }

  async evaluateNodePolicy({ workflow, node, input: _input, context, cumulativeRisk, simulation }) {
    const tool = node.type === 'tool'
      ? node.config?.tool_name
      : node.config?.selected_tool ?? null;
    return this.policyEngine.evaluate({
      userRole: context.userRole,
      workflowType: workflow.workflow_type,
      tool,
      dataSensitivity: node.config?.data_sensitivity ?? workflow.metadata?.data_sensitivity ?? 'internal',
      runtimeType: node.config?.runtime_type ?? RUNTIME_TYPES.NATIVE,
      nodeType: node.type,
      baseRisk: node.config?.risk_score ?? 0,
      cumulativeRisk,
      simulation,
      context: {
        orgId: context.orgId ?? null,
        workflowId: workflow.id,
        nodeId: node.id,
      },
    });
  }
}

export function resolveNodeInput({ node, state, context }) {
  const staticInput = node.config?.static_input ?? {};
  const input = {
    ...((Object.keys(node.input_bindings ?? {}).length === 0 && !node.config?.static_input)
      ? state.workflowInput
      : staticInput),
  };

  for (const [targetKey, sourcePath] of Object.entries(node.input_bindings ?? {})) {
    input[targetKey] = resolveStatePath(sourcePath, state, context);
  }

  return input;
}

export function resolveStatePath(sourcePath, state, context) {
  if (sourcePath === '$workflow') {
    return state.workflowInput;
  }
  if (sourcePath === '$nodes') {
    return state.nodes;
  }
  if (sourcePath === '$context') {
    return context;
  }

  const [root, ...parts] = sourcePath.slice(1).split('.');
  let value;

  if (root === 'workflow') value = state.workflowInput;
  if (root === 'nodes') value = state.nodes;
  if (root === 'context') value = context;

  for (const part of parts) {
    value = value?.[part];
  }

  return value;
}

function edgeConditionsPass({ workflow, node, state }) {
  const incoming = workflow.edges.filter((edge) => edge.to === node.id && edge.condition);
  return incoming.every((edge) => {
    const sourceOutput = state.nodes[edge.from]?.output;
    if (!sourceOutput) {
      return false;
    }
    const value = resolveObjectPath(sourceOutput, edge.condition.path);
    if (edge.condition.exists !== undefined) {
      return edge.condition.exists ? value !== undefined : value === undefined;
    }
    if (edge.condition.equals !== undefined) {
      return value === edge.condition.equals;
    }
    return true;
  });
}

function applyPolicyModifications(input, modifications = {}) {
  if (!modifications || Object.keys(modifications).length === 0) {
    return input;
  }

  return {
    ...input,
    ...modifications,
  };
}

function isApproved(node, context) {
  const approvals = context.approvals ?? {};
  return approvals[node.id] === true || approvals[node.config?.tool_name] === true;
}

function enforceToolUsage(node, toolsUsed) {
  for (const tool of toolsUsed) {
    if (!node.allowed_tools.includes(tool)) {
      const error = new Error(`Node "${node.id}" used non-whitelisted tool "${tool}".`);
      error.code = 'NODE_TOOL_WHITELIST_VIOLATION';
      error.status = 403;
      throw error;
    }
  }
}

function enforceCostLimit(node, cost) {
  if (Number(cost ?? 0) > node.cost_limit) {
    const error = new Error(`Node "${node.id}" exceeded cost_limit.`);
    error.code = 'NODE_COST_LIMIT_EXCEEDED';
    error.status = 402;
    throw error;
  }
}

function calculateRetryDelay(policy, attempt) {
  if (!policy.delay_ms || policy.strategy === 'none') {
    return 0;
  }

  if (policy.strategy === 'linear') {
    return policy.delay_ms * attempt;
  }

  if (policy.strategy === 'exponential') {
    return policy.delay_ms * 2 ** (attempt - 1);
  }

  return policy.delay_ms;
}

function runWithTimeout(promise, timeoutMs, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.code = 'NODE_TIMEOUT';
      error.status = 504;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function resolveObjectPath(input, path) {
  return String(path ?? '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], input);
}

function formatError(error) {
  return {
    code: error.code ?? 'ERROR',
    message: error.message ?? String(error),
    validationErrors: error.validationErrors ?? undefined,
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
