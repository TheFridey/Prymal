/**
 * Time-based retrieval decay — reduces effective influence of stale / unused memories.
 * Pinned, always_include, recently used, and confirmed memories resist decay.
 */

const DAY_MS = 86_400_000;

const SCOPE_DECAY_SPEED = {
  temporary_session: 2.4,
  workflow_run: 1.8,
  restricted: 1.0,
  agent_private: 1.1,
  user: 0.85,
  org: 0.65,
};

const TYPE_DECAY_SPEED = {
  agent_observation: 1.35,
  task_state: 1.25,
  workflow_state: 1.2,
  episodic_event: 1.1,
  system_note: 1.15,
  warning: 1.0,
  user_preference: 0.55,
  preference: 0.55,
  business_fact: 0.6,
  project_fact: 0.62,
  brand_voice: 0.58,
  fact: 0.7,
  instruction: 0.75,
  pattern: 0.8,
};

const MIN_DECAY_FACTOR_NEVER_FORGET = 0.58;
const MIN_DECAY_FACTOR_PINNED = 0.88;
const MIN_DECAY_FACTOR_ALWAYS = 0.82;
const MIN_DECAY_FACTOR_LOCKED = 0.96;

function daysBetween(isoOrDate, nowMs) {
  if (!isoOrDate) return 0;
  const t = isoOrDate instanceof Date ? isoOrDate.getTime() : new Date(isoOrDate).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (nowMs - t) / DAY_MS);
}

/**
 * @param {object} memory — agent_memory row-like object
 * @param {Date} [now]
 * @returns {{ decayFactor: number, reason: string }}
 */
export function calculateMemoryDecay(memory, now = new Date()) {
  const nowMs = now.getTime();

  if (
    !memory
    || memory.memoryItemStatus === 'archived'
    || memory.memoryItemStatus === 'deleted'
    || memory.memoryItemStatus === 'rejected'
    || memory.memoryItemStatus === 'expired'
  ) {
    return { decayFactor: 0, reason: 'not_retrievable_status' };
  }

  if (memory.neverForget === true) {
    const ageUnusedDays = daysBetween(memory.lastUsedAt ?? memory.updatedAt ?? memory.createdAt, nowMs);
    const floor = Math.max(MIN_DECAY_FACTOR_NEVER_FORGET, 0.72 - Math.min(ageUnusedDays / 400, 0.12));
    return { decayFactor: Number(floor.toFixed(4)), reason: 'never_forget_floor' };
  }

  if (memory.userLocked === true) {
    const ageUnusedDays = daysBetween(memory.lastConfirmedAt ?? memory.confirmedAt ?? memory.updatedAt ?? memory.createdAt, nowMs);
    const factor = Math.max(MIN_DECAY_FACTOR_LOCKED, 0.995 - Math.min(ageUnusedDays / 540, 0.02));
    return { decayFactor: Number(factor.toFixed(4)), reason: 'user_locked_resistance' };
  }

  if (memory.pinned === true) {
    const unusedDays = daysBetween(memory.lastUsedAt ?? memory.updatedAt, nowMs);
    const factor = Math.max(MIN_DECAY_FACTOR_PINNED, 0.97 - Math.min(unusedDays / 220, 0.09));
    return { decayFactor: Number(factor.toFixed(4)), reason: 'pinned_resistance' };
  }

  if (memory.alwaysInclude === true) {
    const unusedDays = daysBetween(memory.lastUsedAt ?? memory.updatedAt, nowMs);
    const factor = Math.max(MIN_DECAY_FACTOR_ALWAYS, 0.94 - Math.min(unusedDays / 180, 0.1));
    return { decayFactor: Number(factor.toFixed(4)), reason: 'always_include_boost_base' };
  }

  const scope = memory.scope ?? 'org';
  const memoryType = memory.memoryType ?? 'fact';
  const scopeSpeed = SCOPE_DECAY_SPEED[scope] ?? 1;
  const typeSpeed = TYPE_DECAY_SPEED[memoryType] ?? 1;

  const referenceDate = memory.lastSeenAt
    ?? memory.lastUsedAt
    ?? memory.lastConfirmedAt
    ?? memory.promotedAt
    ?? memory.updatedAt
    ?? memory.createdAt;
  const idleDays = daysBetween(referenceDate, nowMs);

  const provenance = memory.provenanceKind ?? 'inferred';
  const confirmedMultiplier = provenance === 'confirmed' ? 0.62 : 1;
  const recentlyConfirmedDays = daysBetween(memory.lastConfirmedAt ?? memory.confirmedAt, nowMs);
  const confirmationBoost = provenance === 'confirmed' && recentlyConfirmedDays <= 45
    ? 0.08
    : provenance === 'confirmed' && recentlyConfirmedDays <= 120
      ? 0.04
      : 0;

  const rawPenalty = idleDays * 0.009 * scopeSpeed * typeSpeed * confirmedMultiplier;
  let decayFactor = Math.max(0.06, 1 - rawPenalty + confirmationBoost);

  if (memory.supersededAt || memory.supersededBy) {
    decayFactor *= 0.32;
  } else if (memory.contradictionDetected === true) {
    decayFactor *= 0.82;
  }

  decayFactor = Number(Math.min(1, decayFactor).toFixed(4));

  const reasonParts = [
    `idle_${idleDays.toFixed(1)}d`,
    `scope_${scope}`,
    `type_${memoryType}`,
    provenance === 'confirmed' ? 'confirmed_trail' : 'inferred',
  ];

  if (memory.lastSeenAt) {
    reasonParts.push('seen_tracking');
  }
  if (memory.lastConfirmedAt || memory.confirmedAt) {
    reasonParts.push('confirmed_recency');
  }
  if (memory.supersededAt || memory.supersededBy) {
    reasonParts.push('superseded');
  } else if (memory.contradictionDetected === true) {
    reasonParts.push('contradiction_review');
  }

  return { decayFactor, reason: reasonParts.join(';') };
}
