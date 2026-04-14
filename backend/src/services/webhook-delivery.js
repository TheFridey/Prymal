import crypto from 'node:crypto';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workflowWebhooks } from '../db/schema.js';

export const WORKFLOW_WEBHOOK_EVENTS = [
  'workflow.completed',
  'workflow.failed',
  'workflow.node.completed',
  'workflow.node.failed',
];

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

export async function deliverWorkflowWebhook(
  { orgId, workflowId, event, payload },
  {
    dbClient = db,
    fetchImpl = fetch,
    sleepImpl = defaultSleep,
    logger = console,
  } = {},
) {
  if (!orgId || !workflowId || !event) {
    return { delivered: 0, failed: 0 };
  }

  const subscriptions = await dbClient.query.workflowWebhooks.findMany({
    where: and(
      eq(workflowWebhooks.orgId, orgId),
      eq(workflowWebhooks.enabled, true),
      or(eq(workflowWebhooks.workflowId, workflowId), isNull(workflowWebhooks.workflowId)),
      sql`${workflowWebhooks.events} @> ARRAY[${event}]::text[]`,
    ),
  });

  if (!subscriptions.length) {
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    const { runId = null, ...data } = payload ?? {};
    const webhookPayload = {
      event,
      workflowId,
      runId,
      orgId,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(webhookPayload);
    const signature = signWebhookPayload(subscription.secret, body);
    const outcome = await postWithRetry({
      url: subscription.url,
      body,
      signature,
      fetchImpl,
      sleepImpl,
    });

    if (outcome.delivered) {
      delivered += 1;
      continue;
    }

    failed += 1;
    logger.error(
      `[WEBHOOK] Failed to deliver ${event} for workflow ${workflowId} to ${subscription.url}: ${outcome.error}`,
    );
  }

  return { delivered, failed };
}

function signWebhookPayload(secret, body) {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

async function postWithRetry({ url, body, signature, fetchImpl, sleepImpl }) {
  let lastError = 'Unknown webhook delivery error.';

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Prymal-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (response.ok) {
        return { delivered: true, error: null };
      }

      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message ?? 'Webhook request failed.';
    }

    const delayMs = RETRY_DELAYS_MS[attempt];
    if (delayMs) {
      await sleepImpl(delayMs);
    }
  }

  return { delivered: false, error: lastError };
}

function defaultSleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
