import { HttpClient } from './http.js';
import { ActionsResource } from './resources/actions.js';
import { AgentsResource } from './resources/agents.js';
import { WorkflowsResource } from './resources/workflows.js';
import type { PrymalClientOptions } from './types.js';

export class PrymalClient {
  readonly agents: AgentsResource;
  readonly workflows: WorkflowsResource;
  readonly actions: ActionsResource;

  private readonly http: HttpClient;

  constructor(options: PrymalClientOptions) {
    this.http = new HttpClient(options);
    this.agents = new AgentsResource(this.http);
    this.workflows = new WorkflowsResource(this.http);
    this.actions = new ActionsResource(this.http);
  }
}
