/**
 * Stripe price guards — keep legacy/grandfather IDs out of new checkout flows.
 * Webhook mapping may still resolve legacy IDs to the agency plan for existing subscriptions.
 */

function trimIds(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
  );
}

export function getLegacyAgencyStripePriceIdSet() {
  return new Set(
    Object.values(
      trimIds({
        monthly: process.env.STRIPE_PRICE_AGENCY_LEGACY,
        quarterly: process.env.STRIPE_PRICE_AGENCY_LEGACY_QUARTERLY,
        yearly: process.env.STRIPE_PRICE_AGENCY_LEGACY_YEARLY,
      }),
    ).filter(Boolean),
  );
}

/** True if this price ID must never be used for new subscription checkout (legacy Agency or misconfiguration). */
export function isForbiddenNewSubscriptionAgencyPriceId(priceId) {
  if (!priceId || typeof priceId !== 'string') return false;
  return getLegacyAgencyStripePriceIdSet().has(priceId);
}

/** All Stripe price IDs configured for Founding Access (for enforcement vs standard). */
export function getFoundingStripePriceIdSet() {
  const ids = [];
  const plans = ['SOLO', 'PRO', 'TEAMS', 'AGENCY'];
  const intervals = ['', '_QUARTERLY', '_YEARLY'];
  for (const p of plans) {
    for (const i of intervals) {
      const key = `STRIPE_PRICE_FOUNDING_${p}${i}`;
      const raw = process.env[key]?.trim();
      if (raw) ids.push(raw);
    }
  }
  return new Set(ids);
}
