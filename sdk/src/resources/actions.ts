import type { HttpClient } from '../http.js';
import type { ActionPayload, ActionResult, ActionType } from '../types.js';

export class ActionsResource {
  constructor(private readonly http: HttpClient) {}

  getSupportedTypes(): Promise<ActionType[]> {
    return this.http.get<ActionType[]>('/api/actions/types');
  }

  execute(payload: ActionPayload): Promise<ActionResult> {
    return this.http.post<ActionResult>('/api/actions/execute', payload);
  }
}
