import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { deliverWorkflowWebhook } = await import('./webhook-delivery.js');

test('deliverWorkflowWebhook posts signed payloads to matching subscriptions', async () => {
  const requests = [];
  const dbClient = {
    query: {
      workflowWebhooks: {
        findMany: async () => [
          {
            id: 'wh-1',
            url: 'https://example.com/hook',
            secret: 'super-secret-webhook-key',
          },
        ],
      },
    },
  };

  const result = await deliverWorkflowWebhook(
    {
      orgId: 'org-123',
      workflowId: 'wf-123',
      event: 'workflow.completed',
      payload: {
        runId: 'run-123',
        status: 'completed',
        creditsUsed: 42,
        nodeOutputs: { writer: { text: 'Done' } },
      },
    },
    {
      dbClient,
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 200 };
      },
      sleepImpl: async () => {},
    },
  );

  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://example.com/hook');
  assert.match(requests[0].options.headers['X-Prymal-Signature'], /^sha256=/);

  const parsedBody = JSON.parse(requests[0].options.body);
  assert.equal(parsedBody.event, 'workflow.completed');
  assert.equal(parsedBody.workflowId, 'wf-123');
  assert.equal(parsedBody.runId, 'run-123');
  assert.equal(parsedBody.orgId, 'org-123');
  assert.deepEqual(parsedBody.data, {
    status: 'completed',
    creditsUsed: 42,
    nodeOutputs: { writer: { text: 'Done' } },
  });
});

test('deliverWorkflowWebhook retries failed deliveries and never throws', async () => {
  const delays = [];
  const dbClient = {
    query: {
      workflowWebhooks: {
        findMany: async () => [
          {
            id: 'wh-2',
            url: 'https://example.com/fail',
            secret: 'another-super-secret',
          },
        ],
      },
    },
  };
  const logger = {
    error(message) {
      logger.messages.push(message);
    },
    messages: [],
  };
  let attempts = 0;

  const result = await deliverWorkflowWebhook(
    {
      orgId: 'org-123',
      workflowId: 'wf-123',
      event: 'workflow.failed',
      payload: {
        runId: 'run-999',
        status: 'failed',
        creditsUsed: 7,
        nodeOutputs: {},
      },
    },
    {
      dbClient,
      fetchImpl: async () => {
        attempts += 1;
        return { ok: false, status: 500 };
      },
      sleepImpl: async (delayMs) => {
        delays.push(delayMs);
      },
      logger,
    },
  );

  assert.equal(result.delivered, 0);
  assert.equal(result.failed, 1);
  assert.equal(attempts, 4);
  assert.deepEqual(delays, [1_000, 2_000, 4_000]);
  assert.equal(logger.messages.length, 1);
  assert.match(logger.messages[0], /Failed to deliver workflow\.failed/);
});
