import {
  applyCreditAdjustment,
  getBillingSnapshotForOrg,
  setSubscriptionPlan,
} from './billing-engine.js';
import {
  BILLING_PLANS,
  canAccessAgent,
  getBillingPlan,
  getPlanConfig,
} from './billing-catalog.js';

export { BILLING_PLANS as PLAN_CONFIG, canAccessAgent, getPlanConfig };

export function getPlanCreditLimit(plan = 'free') {
  return getPlanConfig(plan).monthlyCreditLimit;
}

export function getPlanSeatLimit(plan = 'free') {
  return getPlanConfig(plan).seatLimit;
}

export function hasRemainingCredits(context, requiredCredits = 1) {
  const available = context?.credits?.execution?.available
    ?? context?.credits?.remaining
    ?? context?.credits?.available
    ?? 0;

  return available >= requiredCredits;
}

export function assertCreditsAvailable(context, requiredCredits = 1) {
  if (hasRemainingCredits(context, requiredCredits)) {
    return;
  }

  const error = new Error('Execution credits exhausted. Purchase an execution pack or upgrade to continue.');
  error.status = 402;
  error.code = 'EXECUTION_CREDITS_EXHAUSTED';
  error.upgrade = true;
  throw error;
}

export async function consumeCredits(orgId, credits, metadata = {}) {
  if (!credits || credits <= 0) {
    return;
  }

  await applyCreditAdjustment({
    orgId,
    creditType: 'execution',
    delta: -Math.abs(credits),
    source: 'burn',
    entryType: 'legacy_commit',
    metadata,
  });
}

export async function applyPlanToOrganisation(orgId, plan) {
  return setSubscriptionPlan({
    orgId,
    planId: plan,
  });
}

export function creditsRemaining(organisationOrSnapshot) {
  if (organisationOrSnapshot?.execution) {
    return {
      limit: organisationOrSnapshot.execution.available + organisationOrSnapshot.execution.committedThisCycle,
      used: organisationOrSnapshot.execution.committedThisCycle,
      remaining: organisationOrSnapshot.execution.available,
      execution: organisationOrSnapshot.execution,
      video: organisationOrSnapshot.video ?? null,
    };
  }

  const plan = getBillingPlan(organisationOrSnapshot?.plan);
  const limit = organisationOrSnapshot?.monthlyCreditLimit ?? plan.includedExecutionCredits;
  const used = organisationOrSnapshot?.creditsUsed ?? 0;

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
  };
}

export async function getOrgCreditContext(orgId) {
  const snapshot = await getBillingSnapshotForOrg(orgId);
  return creditsRemaining(snapshot.credits);
}
