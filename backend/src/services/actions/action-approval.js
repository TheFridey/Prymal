/**
 * Action approval lifecycle manager.
 * Handles WARDEN-flagged actions that require human approval before execution.
 * Mirrors the workflow-confirmation pattern. Uses action_approvals table.
 */
import crypto from 'node:crypto';
import * as Sentry from '@sentry/node';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { actionApprovals } from '../../db/schema.js';

const APPROVAL_TTL_MINUTES = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a pending approval request.
 * Returns a plaintext token — send this to the user for approval.
 *
 * @param {{ actionType: string, payload: object, orgId: string, userId: string, workflowId?: string, nodeId?: string }} opts
 * @returns {Promise<{ approvalId: string, token: string }>}
 */
export async function createApprovalRequest({ actionType, payload, orgId, userId, workflowId, nodeId }) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000);

  const [record] = await db
    .insert(actionApprovals)
    .values({
      orgId,
      userId,
      actionType,
      payload,
      tokenHash,
      expiresAt,
      workflowId: workflowId ?? null,
      nodeId: nodeId ?? null,
    })
    .returning({ id: actionApprovals.id });

  return { approvalId: record.id, token };
}

/**
 * Validate and consume an approval token.
 * Sets used_at and verdict = 'approved' on success.
 *
 * @param {string} token
 * @param {{ orgId: string }} context
 * @returns {Promise<{ valid: boolean, actionType?: string, payload?: object, reason?: string }>}
 */
export async function validateAndConsume(token, { orgId }) {
  const tokenHash = hashToken(token);

  const record = await db.query.actionApprovals.findFirst({
    where: eq(actionApprovals.tokenHash, tokenHash),
  });

  if (!record) {
    return { valid: false, reason: 'not_found' };
  }

  if (record.orgId !== orgId) {
    return { valid: false, reason: 'org_mismatch' };
  }

  if (record.usedAt) {
    return { valid: false, reason: 'already_used' };
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, reason: 'expired' };
  }

  await db
    .update(actionApprovals)
    .set({ usedAt: new Date(), verdict: 'approved' })
    .where(eq(actionApprovals.id, record.id));

  return { valid: true, actionType: record.actionType, payload: record.payload };
}

/**
 * Deny an approval request.
 * Sets verdict = 'denied', used_at = NOW().
 *
 * @param {string} token
 * @param {{ orgId: string }} context
 */
export async function denyApproval(token, { orgId }) {
  const tokenHash = hashToken(token);
  const record = await db.query.actionApprovals.findFirst({
    where: and(
      eq(actionApprovals.tokenHash, tokenHash),
      eq(actionApprovals.orgId, orgId),
    ),
  });

  if (!record) {
    return;
  }

  await db
    .update(actionApprovals)
    .set({ usedAt: new Date(), verdict: 'denied' })
    .where(eq(actionApprovals.id, record.id));
}

/**
 * Consume an approval by its ID without requiring the plaintext token.
 * Used for in-app approvals where the user is already authenticated.
 * Marks the record as approved and returns action type + payload for re-execution.
 *
 * @param {string} approvalId
 * @param {{ orgId: string }} context
 * @returns {Promise<{ valid: boolean, actionType?: string, payload?: object, workflowId?: string, nodeId?: string, reason?: string }>}
 */
export async function consumeByApprovalId(approvalId, { orgId }) {
  try {
    const record = await db.query.actionApprovals.findFirst({
      where: and(
        eq(actionApprovals.id, approvalId),
        eq(actionApprovals.orgId, orgId),
      ),
    });

    if (!record) return { valid: false, reason: 'not_found' };
    if (record.usedAt) return { valid: false, reason: 'already_used' };
    if (new Date() > record.expiresAt) return { valid: false, reason: 'expired' };

    await db
      .update(actionApprovals)
      .set({ usedAt: new Date(), verdict: 'approved' })
      .where(eq(actionApprovals.id, record.id));

    return {
      valid: true,
      actionType: record.actionType,
      payload: record.payload,
      workflowId: record.workflowId ?? undefined,
      nodeId: record.nodeId ?? undefined,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'action-approval', operation: 'consumeByApprovalId' },
    });
    return { valid: false, reason: 'internal_error' };
  }
}

/**
 * Deny an approval by its ID without requiring the plaintext token.
 * Used for in-app denials.
 *
 * @param {string} approvalId
 * @param {{ orgId: string }} context
 */
export async function denyByApprovalId(approvalId, { orgId }) {
  try {
    await db
      .update(actionApprovals)
      .set({ usedAt: new Date(), verdict: 'denied' })
      .where(
        and(
          eq(actionApprovals.id, approvalId),
          eq(actionApprovals.orgId, orgId),
          isNull(actionApprovals.usedAt),
        ),
      );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'action-approval', operation: 'denyByApprovalId' },
    });
  }
}

/**
 * Get pending (non-expired, non-used) approvals for an org.
 *
 * @param {{ orgId: string }} opts
 * @returns {Promise<Array>}
 */
export async function getPendingApprovals({ orgId }) {
  try {
    return await db.query.actionApprovals.findMany({
      where: and(
        eq(actionApprovals.orgId, orgId),
        isNull(actionApprovals.usedAt),
        gt(actionApprovals.expiresAt, new Date()),
      ),
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'action-approval', operation: 'getPendingApprovals', orgId },
    });
    return [];
  }
}
