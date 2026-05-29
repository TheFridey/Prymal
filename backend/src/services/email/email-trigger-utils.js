import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ component: 'email-trigger-utils' });
import { organisations, users, workflows } from '../../db/schema.js';
import {
  sendCreditsLowEmail,
  sendFounderAccessEmail,
  sendPaymentFailedEmail,
  sendSubscriptionStartedEmail,
  sendUsageCapEmail,
  sendWorkflowInstalledEmail,
} from './email-service.js';
import { getBillingPlan } from '../billing-catalog.js';

export async function getUserEmail(userId) {
  if (!userId) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user?.email ?? null;
}

export async function getOrgPrimaryRecipient(orgId, preferredUserId = null) {
  const preferred = await getUserEmail(preferredUserId);
  if (preferred) return { email: preferred, userId: preferredUserId };

  const [owner] = await db
    .select()
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(asc(users.createdAt))
    .limit(1);

  return owner?.email ? { email: owner.email, userId: owner.id } : { email: null, userId: null };
}

export function fireAndForgetEmail(promise, label) {
  promise.catch((error) => {
    log.warn({ err: error, label }, 'email.fire_and_forget_failed');
  });
}

export async function notifySubscriptionStarted({ orgId, userId = null, planId, subscriptionId, checkoutSessionId }) {
  const recipient = await getOrgPrimaryRecipient(orgId, userId);
  if (!recipient.email) return { ok: false, skipped: true, reason: 'missing_recipient' };
  const plan = getBillingPlan(planId);
  return sendSubscriptionStartedEmail(recipient.email, {
    planName: plan.label,
    executionCredits: plan.includedExecutionCredits,
    videoCredits: plan.includedVideoCredits,
    subscriptionId,
    checkoutSessionId,
  }, {
    orgId,
    userId: recipient.userId,
  });
}

export async function notifyPaymentFailed({ orgId, invoiceId, amountDue, currency, subscriptionId }) {
  const recipient = await getOrgPrimaryRecipient(orgId);
  if (!recipient.email) return { ok: false, skipped: true, reason: 'missing_recipient' };
  return sendPaymentFailedEmail(recipient.email, {
    invoiceId,
    amountDue,
    currency,
    subscriptionId,
  }, {
    orgId,
    userId: recipient.userId,
  });
}

export async function notifyCreditsLow({ orgId, userId = null, planId, thresholdPercent, billingPeriodKey, creditType }) {
  const recipient = await getOrgPrimaryRecipient(orgId, userId);
  if (!recipient.email) return { ok: false, skipped: true, reason: 'missing_recipient' };
  const plan = getBillingPlan(planId);
  return sendCreditsLowEmail(recipient.email, {
    planName: plan.label,
    thresholdPercent,
    billingPeriodKey,
    creditType,
  }, {
    orgId,
    userId: recipient.userId,
  });
}

export async function notifyUsageCapReached({ orgId, userId = null, planId, capState, billingPeriodKey, creditType }) {
  const recipient = await getOrgPrimaryRecipient(orgId, userId);
  if (!recipient.email) return { ok: false, skipped: true, reason: 'missing_recipient' };
  const plan = getBillingPlan(planId);
  return sendUsageCapEmail(recipient.email, {
    planName: plan.label,
    capState,
    billingPeriodKey,
    creditType,
  }, {
    orgId,
    userId: recipient.userId,
  });
}

export async function notifyWorkflowInstalled({ orgId, userId, workflowId, workflowTitle, installedWorkflowId }) {
  const recipient = await getOrgPrimaryRecipient(orgId, userId);
  if (!recipient.email) return { ok: false, skipped: true, reason: 'missing_recipient' };
  return sendWorkflowInstalledEmail(recipient.email, {
    workflowId,
    installedWorkflowId: installedWorkflowId || workflowId,
    workflowTitle,
  }, {
    orgId,
    userId: recipient.userId,
  });
}

export async function notifyFounderAccess({ orgId, userId = null, claim, boost, subscriptionId }) {
  const recipient = await getOrgPrimaryRecipient(orgId, userId || claim?.userId);
  if (!recipient.email) return { ok: false, skipped: true, reason: 'missing_recipient' };
  return sendFounderAccessEmail(recipient.email, {
    claimId: claim?.id,
    subscriptionId,
    founderPeriodEndsAt: claim?.founderPeriodEndsAt,
    onboardingBonusCredits: boost?.applied ? boost?.credits : null,
  }, {
    orgId,
    userId: recipient.userId,
  });
}

export async function getWorkflowTitle(workflowId) {
  if (!workflowId) return null;
  const workflow = await db.query.workflows.findFirst({ where: eq(workflows.id, workflowId) });
  return workflow?.name ?? null;
}

export async function getOrganisationName(orgId) {
  if (!orgId) return null;
  const org = await db.query.organisations.findFirst({ where: eq(organisations.id, orgId) });
  return org?.name ?? null;
}
