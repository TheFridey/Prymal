// Core Prymal API types

export interface PrymalClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ── Agents ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  policyClass: string;
  capabilities: string[];
  createdAt: string;
}

export interface AgentRunOptions {
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  stream?: boolean;
}

export interface AgentRunResult {
  runId: string;
  agentId: string;
  verdict: 'PASS' | 'REPAIR' | 'HOLD';
  output: string;
  sources: AgentSource[];
  sentinelRepairAttempts: number;
  audioResponse?: AudioResponse | null;
}

export interface AgentSource {
  title: string;
  url?: string;
  score?: number;
}

export interface AudioResponse {
  audioBase64: string;
  format: 'mp3';
  durationMs: number | null;
}

// ── Workflows ─────────────────────────────────────────────────────────────────

export interface Workflow {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  contractEnforced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  label?: string;
  outputSchema?: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'held';
  nodeResults: WorkflowNodeResult[];
  startedAt: string;
  completedAt?: string;
}

export interface WorkflowNodeResult {
  nodeId: string;
  agentId: string;
  verdict: 'PASS' | 'REPAIR' | 'HOLD';
  output: string;
  sentinelRepairAttempts: number;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type ActionType =
  | 'email.send'
  | 'drive.write'
  | 'drive.append'
  | 'drive.folder'
  | 'slack.post'
  | 'slack.reply';

export interface ActionPayload {
  type: ActionType;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  type: ActionType;
  result: Record<string, unknown>;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'agent.run.completed'
  | 'agent.run.held'
  | 'workflow.run.completed'
  | 'workflow.run.held'
  | 'action.executed';

export interface WebhookEvent<T = unknown> {
  id: string;
  type: WebhookEventType;
  orgId: string;
  createdAt: string;
  data: T;
}

export interface PrymalWebhookOptions {
  secret: string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export interface PrymalApiErrorBody {
  error: string;
  code?: string;
  status?: number;
}
