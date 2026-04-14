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
