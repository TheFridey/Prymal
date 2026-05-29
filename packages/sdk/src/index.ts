// ─────────────────────────────────────────────────────────────────────────────
// @prymal/sdk — TypeScript client for the Prymal multi-agent AI API
// Agency plan API key required. Get yours at https://prymal.io/app/settings
// ─────────────────────────────────────────────────────────────────────────────

export type AgentId =
  | 'CIPHER' | 'HERALD' | 'LORE'   | 'FORGE' | 'ATLAS'
  | 'ECHO'   | 'ORACLE' | 'VANCE'  | 'WREN'  | 'LEDGER'
  | 'NEXUS'  | 'SCOUT'  | 'SAGE'   | 'PIXEL';

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  default_policy: string;
}

export interface ChatParams {
  agent_id: AgentId;
  message: string;
  conversation_id?: string;
  stream?: boolean;
  use_lore?: boolean;
  preferences?: {
    response_length?: 'short' | 'medium' | 'long';
    tone?: string;
    custom_instructions?: string;
  };
}

export interface ChatResponse {
  content: string;
  conversation_id: string;
  tokens_used: number;
  model: string;
  provider: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'manual' | 'schedule' | 'webhook' | 'event';
  is_active: boolean;
  created_at: string;
}

export interface CreateWorkflowParams {
  name: string;
  description?: string;
  trigger_type: 'manual' | 'schedule' | 'webhook' | 'event';
  trigger_config?: Record<string, unknown>;
  nodes: unknown[];
  edges: unknown[];
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  triggered_by: string;
  credits_used: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface LoreDocument {
  id: string;
  title: string;
  source_type: 'text' | 'file' | 'url';
  chunk_count: number;
  created_at: string;
}

export interface LoreSearchResult {
  id: string;
  document_id: string;
  document_title: string | null;
  content: string;
  similarity: number;
  source_url: string | null;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  scope: 'org' | 'user' | 'agent_private' | 'restricted';
  agent_id: AgentId | null;
  created_at: string;
  expires_at: string | null;
}

export interface WriteMemoryParams {
  key: string;
  value: string;
  scope: 'org' | 'user' | 'agent_private';
  agent_id?: AgentId;
  expires_at?: string;
}

export interface UsageSummary {
  execution: {
    available: number;
    used: number;
    limit: number;
    percent_used: number;
  };
  video: {
    available: number;
    used: number;
  };
}

export interface PrymalClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class PrymalError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(message: string, status: number, code?: string | null, requestId?: string | null) {
    super(message);
    this.name = 'PrymalError';
    this.status = status;
    this.code = code ?? null;
    this.requestId = requestId ?? null;
  }
}

export class PrymalClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(options: PrymalClientOptions) {
    if (!options.apiKey) throw new Error('PrymalClient: apiKey is required.');
    this.#apiKey = options.apiKey;
    this.#baseUrl = (options.baseUrl ?? 'https://prymal.io/api').replace(/\/$/, '');
  }

  async #request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as {
        error?: string; code?: string; request_id?: string;
      };
      throw new PrymalError(
        body.error ?? res.statusText,
        res.status,
        body.code,
        body.request_id,
      );
    }

    return res.json() as Promise<T>;
  }

  readonly agents = {
    list: (): Promise<Agent[]> =>
      this.#request('/agents'),

    chat: (params: ChatParams): Promise<ChatResponse> =>
      this.#request('/agents/chat', {
        method: 'POST',
        body: JSON.stringify({ ...params, stream: false }),
      }),

    listConversations: (params?: { agent_id?: AgentId; limit?: number; offset?: number }) =>
      this.#request(`/agents/conversations${toQuery(params)}`),

    getMessages: (conversationId: string) =>
      this.#request(`/agents/conversations/${conversationId}/messages`),

    deleteConversation: (conversationId: string) =>
      this.#request(`/agents/conversations/${conversationId}`, { method: 'DELETE' }),
  };

  readonly workflows = {
    list: (params?: { limit?: number; offset?: number }) =>
      this.#request<Workflow[]>(`/workflows${toQuery(params)}`),

    get: (id: string): Promise<Workflow> =>
      this.#request(`/workflows/${id}`),

    create: (data: CreateWorkflowParams): Promise<Workflow> =>
      this.#request('/workflows', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: Partial<CreateWorkflowParams>): Promise<Workflow> =>
      this.#request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
      this.#request(`/workflows/${id}`, { method: 'DELETE' }),

    run: (id: string): Promise<WorkflowRun> =>
      this.#request(`/workflows/${id}/run`, { method: 'POST' }),

    listRuns: (id: string, params?: { limit?: number }): Promise<WorkflowRun[]> =>
      this.#request(`/workflows/${id}/runs${toQuery(params)}`),
  };

  readonly lore = {
    list: (params?: { limit?: number; offset?: number }): Promise<LoreDocument[]> =>
      this.#request(`/lore${toQuery(params)}`),

    search: (query: string, params?: { limit?: number }): Promise<LoreSearchResult[]> =>
      this.#request(`/lore/search${toQuery({ q: query, ...params })}`),

    ingestText: (text: string, title?: string): Promise<LoreDocument> =>
      this.#request('/lore/text', { method: 'POST', body: JSON.stringify({ text, title }) }),

    crawlUrl: (url: string) =>
      this.#request('/lore/crawl', { method: 'POST', body: JSON.stringify({ url }) }),

    delete: (id: string) =>
      this.#request(`/lore/${id}`, { method: 'DELETE' }),
  };

  readonly memory = {
    list: (params?: { scope?: MemoryEntry['scope']; agent_id?: AgentId; limit?: number }): Promise<MemoryEntry[]> =>
      this.#request(`/memory${toQuery(params)}`),

    get: (id: string): Promise<MemoryEntry> =>
      this.#request(`/memory/${id}`),

    write: (data: WriteMemoryParams): Promise<MemoryEntry> =>
      this.#request('/memory', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: { value?: string; expires_at?: string | null }): Promise<MemoryEntry> =>
      this.#request(`/memory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id: string) =>
      this.#request(`/memory/${id}`, { method: 'DELETE' }),
  };

  readonly usage = {
    summary: (): Promise<UsageSummary> =>
      this.#request('/usage/summary'),

    breakdown: (params?: { from?: string; to?: string }) =>
      this.#request(`/usage/breakdown${toQuery(params)}`),
  };
}

function toQuery(params?: Record<string, unknown> | null): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}
