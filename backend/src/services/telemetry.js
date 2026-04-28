import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminActionLogs, auditLogs, productEvents } from '../db/schema.js';

export async function recordAuditLog({
  orgId = null,
  actorUserId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  if (!action) {
    return;
  }

  try {
    await db.insert(auditLogs).values({
      orgId,
      actorUserId,
      action,
      targetType,
      targetId,
      metadata,
    });
  } catch (error) {
    console.error('[AUDIT] Failed to persist audit log:', error.message);
  }
}

export async function recordProductEvent({
  orgId = null,
  userId = null,
  eventName,
  metadata = {},
}) {
  if (!eventName) {
    return;
  }

  try {
    await db.insert(productEvents).values({
      orgId,
      userId,
      eventName,
      metadata,
    });
  } catch (error) {
    console.error('[EVENTS] Failed to persist product event:', error.message);
  }
}

/** Inserts at most one row per (userId, eventName) — for activation milestones. */
export async function recordProductEventOnce({
  orgId = null,
  userId = null,
  eventName,
  metadata = {},
}) {
  if (!eventName || !userId) {
    return;
  }

  try {
    const existing = await db
      .select({ id: productEvents.id })
      .from(productEvents)
      .where(and(eq(productEvents.eventName, eventName), eq(productEvents.userId, userId)))
      .limit(1);
    if (existing.length > 0) return;
    await recordProductEvent({ orgId, userId, eventName, metadata });
  } catch (error) {
    console.error('[EVENTS] Failed to persist one-time product event:', error.message);
  }
}

/** Fires `first_win.completed` once with the first qualifying path. */
export async function maybeRecordFirstWinAggregate({ orgId, userId, pathKey, metadata = {} }) {
  if (!orgId || !userId || !pathKey) return;
  await recordProductEventOnce({
    orgId,
    userId,
    eventName: `first_win.path.${pathKey}`,
    metadata: { ...metadata, pathKey },
  });

  try {
    const already = await db
      .select({ id: productEvents.id })
      .from(productEvents)
      .where(and(eq(productEvents.eventName, 'first_win.completed'), eq(productEvents.userId, userId)))
      .limit(1);
    if (already.length > 0) return;
    await recordProductEvent({
      orgId,
      userId,
      eventName: 'first_win.completed',
      metadata: { pathKey, ...metadata },
    });
  } catch (error) {
    console.error('[EVENTS] first_win.completed failed:', error.message);
  }
}

export async function recordAdminActionLog({
  orgId = null,
  actorUserId = null,
  actorStaffRole,
  action,
  permission,
  targetType,
  targetId = null,
  requestId = null,
  idempotencyKey = null,
  reasonCode,
  reason = null,
  metadata = {},
}) {
  if (!action || !permission || !targetType || !reasonCode || !actorStaffRole) {
    return null;
  }

  try {
    const [row] = await db.insert(adminActionLogs).values({
      orgId,
      actorUserId,
      actorStaffRole,
      action,
      permission,
      targetType,
      targetId,
      requestId,
      idempotencyKey,
      reasonCode,
      reason,
      metadata: {
        immutable: true,
        ...metadata,
      },
    }).returning();
    return row ?? null;
  } catch (error) {
    console.error('[ADMIN ACTION] Failed to persist admin action log:', error.message);
    return null;
  }
}
