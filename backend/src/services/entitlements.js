import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organisations } from '../db/schema.js';

const CORE_FREE_AGENTS = ['cipher', 'herald', 'forge', 'wren'];
const SOLO_AGENTS = [...CORE_FREE_AGENTS, 'lore'];

export const PLAN_CONFIG = {
  free: {
    label: 'Offer Access',
    monthlyCreditLimit: 50,
    seatLimit: 1,
    accessibleAgents: CORE_FREE_AGENTS,
  },
  solo: {
    label: 'Solo',
    monthlyCreditLimit: 500,
    seatLimit: 1,
    accessibleAgents: SOLO_AGENTS,
  },
  pro: {
    label: 'Pro',
    monthlyCreditLimit: 2000,
    seatLimit: 1,
    accessibleAgents: 'all',
  },
  teams: {
    label: 'Teams',
    monthlyCreditLimit: 6000,
    seatLimit: 5,
    accessibleAgents: 'all',
  },
  agency: {
    label: 'Agency',
    monthlyCreditLimit: 10000,
    seatLimit: 25,
    accessibleAgents: 'all',
  },
};

export function getPlanConfig(plan = 'free') {
  return PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;
}

export function getPlanCreditLimit(plan = 'free') {
  return getPlanConfig(plan).monthlyCreditLimit;
}

export function getPlanSeatLimit(plan = 'free') {
  return getPlanConfig(plan).seatLimit;
}

export function canAccessAgent(plan, agentId) {
  const accessibleAgents = getPlanConfig(plan).accessibleAgents;
  return accessibleAgents === 'all' || accessibleAgents.includes(agentId);
}

export function hasRemainingCredits(context, requiredCredits = 1) {
  return (context?.credits?.remaining ?? 0) >= requiredCredits;
}

export function assertCreditsAvailable(context, requiredCredits = 1) {
  if (hasRemainingCredits(context, requiredCredits)) {
    return;
  }

  const error = new Error('Monthly credit limit reached. Upgrade or wait for the next billing reset.');
  error.status = 402;
  error.code = 'CREDITS_EXHAUSTED';
  error.upgrade = true;
  throw error;
}

export async function consumeCredits(orgId, credits) {
  if (!credits || credits <= 0) {
    return;
  }

  await db
    .update(organisations)
    .set({
      creditsUsed: sql`${organisations.creditsUsed} + ${credits}`,
    })
    .where(sql`${organisations.id} = ${orgId}`);
}

export async function applyPlanToOrganisation(orgId, plan) {
  const config = getPlanConfig(plan);

  await db
    .update(organisations)
    .set({
      plan,
      monthlyCreditLimit: config.monthlyCreditLimit,
      seatLimit: config.seatLimit,
    })
    .where(sql`${organisations.id} = ${orgId}`);
}

export function creditsRemaining(organisation) {
  const limit = organisation?.monthlyCreditLimit ?? getPlanCreditLimit(organisation?.plan);
  const used = organisation?.creditsUsed ?? 0;

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
  };
}
