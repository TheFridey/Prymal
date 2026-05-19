import { executeWorkflowRunWithValidation } from '../services/workflow-runner.js';
import { registerSchedule, deregisterSchedule } from '../services/inline-scheduler.js';

const DEFAULT_TRIGGER_API_URL = 'https://api.trigger.dev';

function getTriggerApiKey() {
  return process.env.TRIGGER_API_KEY?.trim() || null;
}

function getTriggerApiBaseUrl() {
  return process.env.TRIGGER_API_URL?.trim() || DEFAULT_TRIGGER_API_URL;
}

export function hasTriggerDevConfig() {
  return Boolean(getTriggerApiKey());
}

async function sendTriggerEvent(event) {
  const apiKey = getTriggerApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(new URL('/api/v1/events', getTriggerApiBaseUrl()), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      event,
      options: {},
    }),
  });

  if (response.ok) {
    return response.json();
  }

  let detail = `${response.status} ${response.statusText}`.trim();

  try {
    const payload = await response.json();
    const message = typeof payload?.error === 'string'
      ? payload.error
      : typeof payload?.message === 'string'
        ? payload.message
        : null;

    if (message) {
      detail = `${detail}: ${message}`;
    }
  } catch {
    // Preserve the HTTP status detail when Trigger.dev does not return JSON.
  }

  throw new Error(`Trigger.dev event dispatch failed: ${detail}`);
}

export async function dispatchWorkflowRun({ runId, workflow, orgContext }) {
  if (!hasTriggerDevConfig()) {
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

  await sendTriggerEvent({
    name: 'prymal.workflow.run',
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
