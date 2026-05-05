/**
 * Eval score feedback loop into LLM routing.
 * Records per-agent/policy-class/org eval outcomes and computes routing weights.
 * All database writes are fire-and-forget — never blocks live execution path.
 *
 * Two escalation interfaces:
 *   shouldEscalate(agentId, evalScores)           — synchronous, score-based (legacy)
 *   shouldEscalateForRouting(agentId, policyClass, { orgId }) — async, history-based (Sprint 5)
 */
import * as Sentry from '@sentry/node';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentEvalSummaries } from '../db/schema.js';

const EMA_ALPHA = 0.1;
const ESCALATION_HALLUCINATION_THRESHOLD = 0.7;
const ESCALATION_HOLD_RATE_THRESHOLD = 0.15;
const LOW_WEIGHT_THRESHOLD = 0.7;
const MEDIUM_CONFIDENCE_MIN = 10;
const HIGH_CONFIDENCE_MIN = 50;

// Escalation ladder: key → next higher policy class (null = already at ceiling)
const POLICY_CLASS_UPGRADE_MAP = {
  fast_chat: 'premium_reasoning',
  low_cost_bulk: 'fast_chat',
  structured_extraction: 'premium_reasoning',
  grounded_research: 'premium_reasoning',
  premium_reasoning: null,
  workflow_automation: 'premium_reasoning',
  vision_file: null,
};

/**
 * Update the running EMA for a numeric field.
 * Returns null if both current and incoming are null/undefined.
 */
function updateEma(current, incoming) {
  if (incoming == null) {
    return current ?? null;
  }
  if (current == null) {
    return incoming;
  }
  return current * (1 - EMA_ALPHA) + incoming * EMA_ALPHA;
}

/**
 * Record an eval outcome for an agent run.
 * Fire-and-forget — call without await in hot paths.
 *
 * @param {string} agentId
 * @param {string} policyClass
 * @param {object} evalScores - { groundedness?, citationScore?, structuredOutputScore?, toolPolicyScore?, hallucinationRisk? }
 * @param {'pass'|'repair'|'hold'} outcomeStatus
 * @param {{ orgId: string }} context
 */
export async function recordEvalOutcome(agentId, policyClass, evalScores, outcomeStatus, { orgId }) {
  try {
    const existing = await db.query.agentEvalSummaries.findFirst({
      where: and(
        eq(agentEvalSummaries.agentId, agentId),
        eq(agentEvalSummaries.policyClass, policyClass),
        eq(agentEvalSummaries.orgId, orgId),
      ),
    });

    const holdDelta = outcomeStatus === 'hold' ? 1 : 0;
    const repairDelta = outcomeStatus === 'repair' ? 1 : 0;
    const passDelta = outcomeStatus === 'pass' ? 1 : 0;

    if (!existing) {
      await db.insert(agentEvalSummaries).values({
        agentId,
        policyClass,
        orgId,
        avgGroundedness: evalScores?.groundedness ?? null,
        avgCitationScore: evalScores?.citationScore ?? null,
        avgStructuredOutputScore: evalScores?.structuredOutputScore ?? null,
        avgToolPolicyScore: evalScores?.toolPolicyScore ?? null,
        avgHallucinationRisk: evalScores?.hallucinationRisk ?? null,
        holdCount: holdDelta,
        repairCount: repairDelta,
        passCount: passDelta,
        sampleSize: 1,
        lastUpdatedAt: new Date(),
      });
      return;
    }

    await db
      .update(agentEvalSummaries)
      .set({
        avgGroundedness: updateEma(existing.avgGroundedness, evalScores?.groundedness),
        avgCitationScore: updateEma(existing.avgCitationScore, evalScores?.citationScore),
        avgStructuredOutputScore: updateEma(existing.avgStructuredOutputScore, evalScores?.structuredOutputScore),
        avgToolPolicyScore: updateEma(existing.avgToolPolicyScore, evalScores?.toolPolicyScore),
        avgHallucinationRisk: updateEma(existing.avgHallucinationRisk, evalScores?.hallucinationRisk),
        holdCount: sql`${agentEvalSummaries.holdCount} + ${holdDelta}`,
        repairCount: sql`${agentEvalSummaries.repairCount} + ${repairDelta}`,
        passCount: sql`${agentEvalSummaries.passCount} + ${passDelta}`,
        sampleSize: sql`${agentEvalSummaries.sampleSize} + 1`,
        lastUpdatedAt: new Date(),
      })
      .where(
        and(
          eq(agentEvalSummaries.agentId, agentId),
          eq(agentEvalSummaries.policyClass, policyClass),
          eq(agentEvalSummaries.orgId, orgId),
        ),
      );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'routing-feedback', agentId, policyClass },
    });
  }
}

/**
 * Get a routing weight modifier based on historical eval performance.
 * Weight formula (Sprint 5):
 *   baseWeight = (groundedness×0.3) + (citation×0.2) + (structuredOutput×0.2) +
 *                (toolPolicy×0.2) + ((1-hallucinationRisk)×0.1)
 *   holdPenalty = (holdCount / total) × 0.3
 *   weight = max(0, baseWeight - holdPenalty)
 *
 * @param {string} agentId
 * @param {string} policyClass
 * @param {{ orgId: string }} context
 * @returns {{ weight: number, confidence: 'low'|'medium'|'high', sampleSize: number }}
 */
export async function getRoutingWeight(agentId, policyClass, { orgId }) {
  try {
    const summary = await db.query.agentEvalSummaries.findFirst({
      where: and(
        eq(agentEvalSummaries.agentId, agentId),
        eq(agentEvalSummaries.policyClass, policyClass),
        eq(agentEvalSummaries.orgId, orgId),
      ),
    });

    if (!summary || summary.sampleSize < 1) {
      return { weight: 1.0, confidence: 'low', sampleSize: 0 };
    }

    const confidence = summary.sampleSize >= HIGH_CONFIDENCE_MIN
      ? 'high'
      : summary.sampleSize >= MEDIUM_CONFIDENCE_MIN
        ? 'medium'
        : 'low';

    const g = summary.avgGroundedness ?? 0;
    const c = summary.avgCitationScore ?? 0;
    const s = summary.avgStructuredOutputScore ?? 0;
    const t = summary.avgToolPolicyScore ?? 0;
    const h = summary.avgHallucinationRisk ?? 0;

    const baseWeight = (g * 0.3) + (c * 0.2) + (s * 0.2) + (t * 0.2) + ((1 - h) * 0.1);

    const total = summary.holdCount + summary.repairCount + summary.passCount;
    const holdPenalty = total > 0 ? (summary.holdCount / total) * 0.3 : 0;

    const weight = Math.max(0, baseWeight - holdPenalty);

    return { weight, confidence, sampleSize: summary.sampleSize };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'routing-feedback', agentId, policyClass },
    });
    return { weight: 1.0, confidence: 'low', sampleSize: 0 };
  }
}

/**
 * Determine whether an agent run should be escalated to a higher-capability policy class.
 *
 * @param {string} agentId
 * @param {object} evalScores - { hallucinationRisk? }
 * @returns {boolean}
 */
export function shouldEscalate(agentId, evalScores) {
  if (evalScores?.hallucinationRisk != null && evalScores.hallucinationRisk > ESCALATION_HALLUCINATION_THRESHOLD) {
    return true;
  }
  return false;
}

/**
 * shouldEscalateFromSummary checks hold rate from stored summary.
 * Use this for routing decisions based on accumulated history.
 */
export function shouldEscalateFromSummary(summary) {
  if (!summary) {
    return false;
  }

  const total = summary.holdCount + summary.repairCount + summary.passCount;
  if (total === 0) {
    return false;
  }

  const holdRate = summary.holdCount / total;

  if (holdRate > ESCALATION_HOLD_RATE_THRESHOLD) {
    return true;
  }

  if (summary.avgHallucinationRisk != null && summary.avgHallucinationRisk > ESCALATION_HALLUCINATION_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * History-based escalation check (Sprint 5).
 * Async — queries agent_eval_summaries.
 * Returns true if BOTH:
 *   - confidence is 'medium' or 'high'
 *   - weight < 0.65 OR hold rate > 0.12
 *
 * @param {string} agentId
 * @param {string} policyClass
 * @param {{ orgId: string }} context
 * @returns {Promise<boolean>}
 */
export async function shouldEscalateForRouting(agentId, policyClass, { orgId }) {
  try {
    const { weight, confidence, sampleSize } = await getRoutingWeight(agentId, policyClass, { orgId });

    if (confidence === 'low') {
      return false;
    }

    if (weight < 0.65) {
      return true;
    }

    // Also check raw hold rate
    const summary = await db.query.agentEvalSummaries.findFirst({
      where: and(
        eq(agentEvalSummaries.agentId, agentId),
        eq(agentEvalSummaries.policyClass, policyClass),
        eq(agentEvalSummaries.orgId, orgId),
      ),
    });

    if (summary) {
      const total = summary.holdCount + summary.repairCount + summary.passCount;
      const holdRate = total > 0 ? summary.holdCount / total : 0;
      if (holdRate > 0.12) {
        return true;
      }
    }

    void sampleSize;
    return false;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'routing-feedback', operation: 'shouldEscalateForRouting', agentId, policyClass },
    });
    return false;
  }
}

/**
 * Return the next higher policy class in the escalation ladder.
 * Returns null if the class is already at the ceiling or unknown.
 *
 * @param {string} currentPolicyClass
 * @returns {string | null}
 */
export function getPolicyClassUpgrade(currentPolicyClass) {
  if (!Object.prototype.hasOwnProperty.call(POLICY_CLASS_UPGRADE_MAP, currentPolicyClass)) {
    return null;
  }
  return POLICY_CLASS_UPGRADE_MAP[currentPolicyClass];
}

export { LOW_WEIGHT_THRESHOLD, MEDIUM_CONFIDENCE_MIN, HIGH_CONFIDENCE_MIN };
