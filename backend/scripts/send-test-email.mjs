#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMAIL_TEMPLATE_BUILDERS } from '../src/services/email/email-copy.js';
import { sendTransactionalEmail } from '../src/services/email/email-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: false });

const args = parseArgs(process.argv.slice(2));
const to = args.to || args._[0];
const type = args.type || args._[1] || 'welcome';

if (!to) {
  console.error('Usage: npm run email:test -- --to you@example.com --type welcome');
  console.error('   or: npm run email:test -- you@example.com welcome');
  console.error('   or: npm run email:test -- --to you@example.com --type all');
  process.exit(1);
}

const types = type === 'all' ? Object.keys(EMAIL_TEMPLATE_BUILDERS) : [type];
const results = [];

for (const emailType of types) {
  if (!EMAIL_TEMPLATE_BUILDERS[emailType]) {
    console.error(`Unknown email type: ${emailType}`);
    console.error(`Available types: ${Object.keys(EMAIL_TEMPLATE_BUILDERS).join(', ')}, all`);
    process.exit(1);
  }

  const payload = samplePayload(emailType);
  const result = await sendTransactionalEmail({
    type: emailType,
    to,
    payload,
    idempotencyKey: `test:${emailType}:${to}:${Date.now()}`,
    metadata: { source: 'email_test_script', testType: type },
    dbClient: createTestEmailEventDb(),
  });

  results.push({ type: emailType, result });

  if (result.ok) {
    console.log(`[${emailType}] sent via ${result.provider}. Message id: ${result.providerMessageId ?? result.event?.providerMessageId ?? 'unknown'}`);
  } else if (result.skipped) {
    console.log(`[${emailType}] skipped: ${result.reason ?? 'provider not configured'}`);
  } else {
    console.error(`[${emailType}] failed: ${result.error ?? 'unknown error'}`);
  }
}

const failed = results.filter(({ result }) => !result.ok && !result.skipped);
if (failed.length) {
  process.exitCode = 1;
} else {
  console.log(`Done. ${results.length} email${results.length === 1 ? '' : 's'} processed for ${to}.`);
}

function parseArgs(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      const nextValue = values[index + 1];
      if (nextValue && !nextValue.startsWith('--')) {
        parsed[key] = nextValue;
        index += 1;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(value);
    }
  }
  return parsed;
}

function samplePayload(templateType) {
  const base = {
    workspaceName: 'Prymal Launch Workspace',
    inviterName: 'Rhys',
    inviteUrl: 'https://prymal.io/invite/test-invite',
    role: 'member',
    planName: 'Pro',
    oldPlanName: 'Solo',
    subscriptionId: 'sub_test_prymal',
    checkoutSessionId: 'cs_test_prymal',
    executionCredits: 2000,
    videoCredits: 5,
    thresholdPercent: 70,
    billingPeriodKey: 'test',
    capState: 'execution_cap_reached',
    amount: 'GBP 99.00',
    invoiceId: 'in_test_prymal',
    paymentId: 'pi_test_prymal',
    paymentIntentId: 'pi_test_prymal',
    invoiceDate: '2026-05-01T10:00:00.000Z',
    invoiceUrl: 'https://prymal.io/app/settings?tab=billing',
    effectiveDate: '2026-05-01T10:00:00.000Z',
    billingPortalUrl: 'https://prymal.io/app/settings?tab=billing',
    workflowTitle: '30-Day Content Engine',
    workflowName: 'Weekly Business Report',
    workflowId: 'test-workflow',
    installedWorkflowId: 'test-workflow',
    workflowRunId: 'test-workflow-run',
    workflowUrl: 'https://prymal.io/app/workflows/test-workflow',
    failureSummary: 'The content review step failed after retry handling.',
    failedAt: '2026-05-01T10:00:00.000Z',
    claimId: 'founder_claim_test',
    founderPeriodEndsAt: '2026-08-01T10:00:00.000Z',
    onboardingBonusCredits: 250,
    eventId: 'workspace_event_test',
    eventName: 'Integration disconnected',
    actorName: 'Rhys',
    occurredAt: '2026-05-01T10:00:00.000Z',
    actionRequired: 'Reconnect the integration from workspace settings.',
  };

  if (templateType === 'payment-failed') {
    return { invoiceId: 'in_test', amountDue: 9900, currency: 'gbp' };
  }

  if (templateType === 'workflow-installed') {
    return { workflowTitle: '30-Day Content Engine', workflowId: 'test-workflow', installedWorkflowId: 'test-workflow' };
  }

  return base;
}

function createTestEmailEventDb() {
  return {
    query: {
      emailEvents: {
        findFirst: async () => null,
      },
    },
    insert: () => ({
      values: (value) => ({
        onConflictDoUpdate: () => ({
          returning: async () => [value],
        }),
        returning: async () => [value],
      }),
    }),
  };
}
