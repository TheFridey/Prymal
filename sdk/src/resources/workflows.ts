import type { HttpClient } from '../http.js';
import type { PaginationParams, Workflow, WorkflowRun } from '../types.js';

export class WorkflowsResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: PaginationParams): Promise<Workflow[]> {
    const qs = params ? `?page=${params.page ?? 1}&limit=${params.limit ?? 20}` : '';
    return this.http.get<Workflow[]>(`/api/workflows${qs}`);
  }

  get(workflowId: string): Promise<Workflow> {
    return this.http.get<Workflow>(`/api/workflows/${encodeURIComponent(workflowId)}`);
  }

  run(workflowId: string, input: Record<string, unknown>): Promise<WorkflowRun> {
    return this.http.post<WorkflowRun>(
      `/api/workflows/${encodeURIComponent(workflowId)}/run`,
      input,
    );
  }

  getRun(workflowId: string, runId: string): Promise<WorkflowRun> {
    return this.http.get<WorkflowRun>(
      `/api/workflows/${encodeURIComponent(workflowId)}/runs/${encodeURIComponent(runId)}`,
    );
  }
}
