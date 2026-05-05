import type { HttpClient } from '../http.js';
import type { Agent, AgentRunOptions, AgentRunResult, PaginationParams } from '../types.js';

export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: PaginationParams): Promise<Agent[]> {
    const qs = params ? `?page=${params.page ?? 1}&limit=${params.limit ?? 20}` : '';
    return this.http.get<Agent[]>(`/api/agents${qs}`);
  }

  get(agentId: string): Promise<Agent> {
    return this.http.get<Agent>(`/api/agents/${encodeURIComponent(agentId)}`);
  }

  run(options: AgentRunOptions): Promise<AgentRunResult> {
    const { agentId, ...payload } = options;
    return this.http.post<AgentRunResult>(
      `/api/agents/${encodeURIComponent(agentId)}/run`,
      payload,
    );
  }
}
