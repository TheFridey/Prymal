import { executeWorkflowRunWithValidation } from '../services/workflow-runner.js';
import { registerSchedule, deregisterSchedule } from '../services/inline-scheduler.js';

let clientPromise = null;

export function hasTriggerDevConfig() {
  return Boolean(process.env.TRIGGER_API_KEY);
}

async function getClient() {
  if (!hasTriggerDevConfig()) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = import('@trigger.dev/sdk').then(({ TriggerClient }) =>
      new TriggerClient({
        id: 'axiom-platform',
        apiKey: process.env.TRIGGER_API_KEY,
        apiUrl: process.env.TRIGGER_API_URL ?? 'https://api.trigger.dev',
      }),
    );
  }

  return clientPromise;
}

export async function dispatchWorkflowRun({ runId, workflow, orgContext }) {
  const triggerClient = await getClient();

  if (!triggerClient) {
    queueMicrotask(async () => {
      try {
        await executeWorkflowRunWithValidation({ runId, workflow, orgContext });
      } catch (error) {
        console.error('[WORKFLOW] Inline execution failed:', error.message);
      }
    });

    return {
      mode: 'inline',
    };
  }

  await triggerClient.sendEvent({
    name: 'axiom.workflow.run',
    payload: {
      runId,
      workflow,
      orgContext,
    },
  });

  return {
    mode: 'trigger.dev',
  };
}

export async function registerCron(workflowId, cronExpression, handler) {
  if (!hasTriggerDevConfig()) {
    registerSchedule(workflowId, cronExpression, handler);
    return;
  }

  console.log(`[TRIGGER] Schedule registration is managed by Trigger.dev for workflow ${workflowId}: ${cronExpression}`);
}

export async function unregisterCron(workflowId) {
  if (!hasTriggerDevConfig()) {
    deregisterSchedule(workflowId);
    return;
  }

  console.log(`[TRIGGER] Schedule cleanup requested for workflow ${workflowId}.`);
}

export const trigger = {
  dispatchWorkflowRun,
  registerCron,
  unregisterCron,
};
