import { getMemoryWorkflowTtlHours } from '../env.js';

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;

  for (const x of sa) {
    if (sb.has(x)) inter += 1;
  }

  return inter / Math.max(sa.size + sb.size - inter, 1);
}

/**
 * Scores whether ephemeral memory should graduate to durable scopes.
 */
export function evaluateMemoryPromotion(candidate = {}, context = {}) {
  const {
    repetitionCount = 0,
    explicitUserInstruction = false,
    userCorrection = false,
    retrievalHits = 0,
    contradictionRisk = 0,
    sensitivityHint = 'low',
  } = context;

  let score = 0;
  const reasons = [];

  if (explicitUserInstruction) {
    score += 0.35;
    reasons.push('explicit_user_instruction');
  }

  if (userCorrection) {
    score += 0.4;
    reasons.push('user_correction');
  }

  score += Math.min(repetitionCount, 5) * 0.06;
  if (repetitionCount >= 2) reasons.push('repeated_signal');

  score += Math.min(retrievalHits, 10) * 0.02;
  if (retrievalHits >= 3) reasons.push('retrieval_useful');

  score += (candidate.authorityScore ?? candidate.authority_score ?? 0.6) * 0.12;
  score += (candidate.confidence ?? 0.6) * 0.12;

  score -= contradictionRisk * 0.25;
  if (contradictionRisk > 0.4) reasons.push('contradiction_risk');

  if (sensitivityHint === 'high' || sensitivityHint === 'critical') {
    score -= 0.35;
    reasons.push('sensitivity_downgrade');
  }

  const scope = candidate.scope ?? candidate.targetScope;

  let shouldPromote = false;
  let targetScope = scope;
  let targetType = candidate.memoryType ?? 'user_preference';

  if (scope === 'temporary_session') {
    if (repetitionCount >= 2 || explicitUserInstruction || userCorrection) {
      shouldPromote = true;
      targetScope = context.workflowRunId ? 'workflow_run' : 'user';
      reasons.push('session_to_durable');
    } else {
      shouldPromote = false;
      reasons.push('single_use_session_no_promote');
    }
  } else if (scope === 'workflow_run') {
    const ttlHours = getMemoryWorkflowTtlHours();
    const importance = candidate.importanceScore ?? candidate.importance_score ?? 0.5;
    if (importance >= 0.72 || userCorrection || repetitionCount >= 2) {
      shouldPromote = true;
      targetScope = candidate.preferOrg === true ? 'org' : 'user';
      reasons.push('workflow_to_user_or_org');
    } else {
      shouldPromote = false;
      reasons.push(`workflow_ttl_${ttlHours}h_only`);
    }
  }

  if ((candidate.memoryType === 'agent_observation' || candidate.type === 'agent_observation') && (candidate.confidence ?? 0) < 0.55) {
    shouldPromote = false;
    reasons.push('low_confidence_observation_hold');
  }

  const confidenceScore = Math.min(Math.max(score, 0), 1);
  const importanceScore = candidate.importanceScore ?? candidate.importance_score ?? confidenceScore;
  const reviewRequired =
    confidenceScore < 0.45
    || candidate.sentinelRequired === true
    || targetScope === 'org';

  const result = {
    shouldPromote,
    targetScope,
    targetType,
    confidenceScore: Number(confidenceScore.toFixed(4)),
    importanceScore: Number(importanceScore.toFixed(4)),
    reason: reasons.join('; ') || 'policy_default',
    reviewRequired,
  };

  console.info(
    `[MEMORY_PROMOTION] shouldPromote=${result.shouldPromote} target=${result.targetScope}:${result.targetType} conf=${result.confidenceScore} review=${result.reviewRequired} detail=${result.reason}`,
  );

  return result;
}

export async function recordPromotionEvaluation(orgId, evaluation, candidateMemoryId = null, metadata = {}) {
  const { db } = await import('../db/index.js');
  const { memoryPromotionEvents } = await import('../db/schema.js');

  await db.insert(memoryPromotionEvents).values({
    orgId,
    candidateMemoryId,
    shouldPromote: evaluation.shouldPromote,
    targetScope: evaluation.targetScope,
    targetType: evaluation.targetType,
    confidenceScore: evaluation.confidenceScore,
    importanceScore: evaluation.importanceScore,
    reason: evaluation.reason,
    reviewRequired: evaluation.reviewRequired,
    metadata,
  });
}

export function relationOverlapRisk(existingText, incomingText) {
  const ja = tokenize(existingText);
  const jb = tokenize(incomingText);

  return jaccard(ja, jb);
}
