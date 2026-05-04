export const RUNTIME_TYPES = {
  NATIVE: 'native',
  EXTERNAL: 'external',
};

export class RuntimeRegistry {
  constructor({ adapters = {} } = {}) {
    this.adapters = new Map(Object.entries(adapters));
  }

  register(runtimeType, adapter) {
    this.adapters.set(runtimeType, adapter);
  }

  async execute(task, runtimeType = RUNTIME_TYPES.NATIVE) {
    const adapter = this.adapters.get(runtimeType);
    if (!adapter) {
      const error = new Error(`No runtime adapter registered for "${runtimeType}".`);
      error.code = 'RUNTIME_NOT_REGISTERED';
      error.status = 500;
      throw error;
    }

    return adapter.execute(task);
  }
}

export class NativeRuntimeAdapter {
  constructor({ executors = {} } = {}) {
    this.executors = new Map(Object.entries(executors));
  }

  register(nodeType, executor) {
    this.executors.set(nodeType, executor);
  }

  async execute(task) {
    const executor = this.executors.get(task.node.type);
    if (!executor) {
      const error = new Error(`No native executor registered for node type "${task.node.type}".`);
      error.code = 'NATIVE_EXECUTOR_NOT_REGISTERED';
      error.status = 500;
      throw error;
    }

    return executor(task);
  }
}

export class ExternalRuntimeAdapter {
  constructor({ executeExternal }) {
    if (typeof executeExternal !== 'function') {
      throw new Error('ExternalRuntimeAdapter requires an executeExternal function.');
    }
    this.executeExternal = executeExternal;
  }

  async execute(task) {
    const result = await this.executeExternal({
      task,
      sandbox: {
        allowedTools: task.node.allowed_tools,
        timeoutMs: task.node.timeout_ms,
        costLimit: task.node.cost_limit,
        orgId: task.context.orgId,
        workflowId: task.workflow.id,
        executionId: task.trace.execution_id,
      },
    });

    return {
      output: result?.output ?? result,
      tokenUsage: result?.tokenUsage ?? null,
      cost: result?.cost ?? null,
      metadata: {
        runtime: RUNTIME_TYPES.EXTERNAL,
        ...(result?.metadata ?? {}),
      },
    };
  }
}

export function createDefaultRuntimeRegistry({ executors = {}, executeExternal } = {}) {
  const native = new NativeRuntimeAdapter({ executors });
  const registry = new RuntimeRegistry({
    adapters: {
      [RUNTIME_TYPES.NATIVE]: native,
    },
  });

  if (executeExternal) {
    registry.register(RUNTIME_TYPES.EXTERNAL, new ExternalRuntimeAdapter({ executeExternal }));
  }

  return registry;
}
