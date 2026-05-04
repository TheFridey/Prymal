import { randomUUID } from 'node:crypto';

export class InMemoryTraceSink {
  constructor() {
    this.traces = [];
  }

  async write(trace) {
    this.traces.push(structuredCloneSafe(trace));
    return trace;
  }

  latest() {
    return this.traces.at(-1) ?? null;
  }
}

export class WorkflowTraceRecorder {
  constructor({ sink = new InMemoryTraceSink(), clock = () => new Date() } = {}) {
    this.sink = sink;
    this.clock = clock;
  }

  startWorkflow({ workflowId, orgId = null, userId = null, metadata = {} }) {
    const now = this.clock().toISOString();
    return {
      workflow_id: workflowId,
      execution_id: randomUUID(),
      org_id: orgId,
      user_id: userId,
      started_at: now,
      completed_at: null,
      status: 'running',
      node_logs: [],
      failure_points: [],
      policy_interventions: [],
      metadata,
    };
  }

  appendNodeLog(trace, log) {
    trace.node_logs.push({
      node_id: log.nodeId,
      node_type: log.nodeType,
      status: log.status,
      input: structuredCloneSafe(log.input ?? null),
      output: structuredCloneSafe(log.output ?? null),
      latency_ms: log.latencyMs ?? null,
      token_usage: log.tokenUsage ?? null,
      cost: log.cost ?? null,
      retries: log.retries ?? 0,
      policy_decisions: log.policyDecisions ?? [],
      lore_context: log.loreContext ?? [],
      errors: log.errors ?? [],
      started_at: log.startedAt ?? null,
      completed_at: log.completedAt ?? this.clock().toISOString(),
      metadata: log.metadata ?? {},
    });
  }

  appendFailure(trace, failure) {
    trace.failure_points.push({
      node_id: failure.nodeId ?? null,
      code: failure.code ?? 'EXECUTION_FAILURE',
      message: failure.message,
      recoverable: failure.recoverable ?? true,
      at: this.clock().toISOString(),
      metadata: failure.metadata ?? {},
    });
  }

  appendPolicyIntervention(trace, intervention) {
    trace.policy_interventions.push({
      node_id: intervention.nodeId ?? null,
      action: intervention.action,
      risk_score: intervention.riskScore ?? null,
      cumulative_risk: intervention.cumulativeRisk ?? null,
      matched_policies: intervention.matchedPolicies ?? [],
      at: this.clock().toISOString(),
      metadata: intervention.metadata ?? {},
    });
  }

  async finishWorkflow(trace, { status, metadata = {} } = {}) {
    trace.status = status;
    trace.completed_at = this.clock().toISOString();
    trace.metadata = { ...(trace.metadata ?? {}), ...metadata };
    await this.sink.write(trace);
    return trace;
  }
}

export function structuredCloneSafe(value) {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
}
