import { usageEstimateEvents } from '../db/schema.js';

/**
 * Append-only usage ledger row (estimated GBP provider cost).
 * Called inside billing-engine transactions after successful commits.
 */
export async function recordUsageEstimateEvent(tx, row) {
  await tx.insert(usageEstimateEvents).values({
    organisationId: row.organisationId,
    userId: row.userId ?? null,
    subscriptionId: row.subscriptionId ?? null,
    planKey: row.planKey,
    actionType: row.actionType,
    costClass: row.costClass,
    estimatedGbpCost: Number(row.estimatedGbpCost) || 0,
    creditCost: Number(row.creditCost) || 0,
    provider: row.provider ?? null,
    model: row.model ?? null,
    referenceKind: row.referenceKind ?? null,
    referenceId: row.referenceId ?? null,
    metadata: row.metadata ?? {},
  });
}
