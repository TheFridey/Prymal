/**
 * Workflow post approval service.
 *
 * Approval modes (stored on workflow.approvalMode):
 *   draft_only        – generate content, save as draft, do NOT publish.
 *   approval_required – save content, create approval request, wait for human review.
 *   auto_publish      – run WARDEN check, then publish immediately.
 *
 * Approval requests expire after APPROVAL_TTL_HOURS (default 48h).
 * Expired pending requests are auto-rejected by the expiry cleanup query.
 */

import { and, eq, lt } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import { recordAuditLog } from './telemetry.js';

const log = logger.child({ component: 'approval-service' });

export const APPROVAL_TTL_HOURS = Number(process.env.APPROVAL_TTL_HOURS ?? 48);

/**
 * Handle content that needs to be published according to the workflow's approvalMode.
 *
 * @param {{
 *   workflow: object,
 *   workflowRun: object,
 *   orgContext: object,
 *   postText: string,
 *   postMetadata?: object,
 *   wardenResult?: { verdict: string, riskLevel: string },
 *   publishFn?: Function,
 * }} params
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 * @returns {Promise<{
 *   outcome: 'drafted' | 'pending_approval' | 'published' | 'blocked',
 *   approvalId?: string,
 *   receiptId?: string,
 *   reason?: string,
 * }>}
 */
export async function handlePostApprovalMode(params, db) {
  const { workflow, workflowRun, orgContext, postText, postMetadata = {}, wardenResult, publishFn } = params;
  const mode = workflow.approvalMode ?? 'auto_publish';

  if (!postText?.trim()) {
    throw new Error('Post text is required for approval handling.');
  }

  if (mode === 'draft_only') {
    log.info({ workflow_id: workflow.id, mode }, 'approval_service.draft_only');
    return { outcome: 'drafted', reason: 'draft_only mode – post saved but not submitted for publishing.' };
  }

  if (mode === 'approval_required') {
    const approvalId = await createApprovalRequest({
      workflow,
      workflowRun,
      orgContext,
      postText,
      postMetadata,
      wardenResult,
    }, db);

    log.info({ workflow_id: workflow.id, approval_id: approvalId }, 'approval_service.pending_approval');

    return { outcome: 'pending_approval', approvalId };
  }

  if (mode === 'auto_publish') {
    if (wardenResult?.verdict === 'block') {
      log.warn(
        { workflow_id: workflow.id, risk_level: wardenResult.riskLevel },
        'approval_service.auto_publish_blocked_by_warden',
      );
      return {
        outcome: 'blocked',
        reason: `WARDEN blocked publish (risk level: ${wardenResult.riskLevel}).`,
      };
    }

    const receiptId = await publishAndRecordReceipt({
      workflow,
      workflowRun,
      orgContext,
      postText,
      postMetadata,
      wardenResult,
      approvalId: null,
      publishFn,
    }, db);

    return { outcome: 'published', receiptId };
  }

  throw new Error(`Unknown approvalMode: ${mode}`);
}

/**
 * Create a pending approval request row.
 */
async function createApprovalRequest(params, db) {
  const { workflow, workflowRun, orgContext, postText, postMetadata, wardenResult } = params;
  const { workflowPostApprovals } = await import('../db/schema.js');

  const expiresAt = new Date(Date.now() + APPROVAL_TTL_HOURS * 60 * 60_000);

  const [approval] = await db
    .insert(workflowPostApprovals)
    .values({
      workflowId: workflow.id,
      workflowRunId: workflowRun.id,
      orgId: orgContext.orgId,
      service: postMetadata.service ?? 'linkedin',
      postText,
      postMetadata,
      status: 'pending',
      wardenVerdict: wardenResult?.verdict ?? null,
      wardenRiskLevel: wardenResult?.riskLevel ?? null,
      expiresAt,
    })
    .returning();

  return approval.id;
}

/**
 * Approve a pending post and publish it.
 *
 * @param {string} approvalId
 * @param {{ actorUserId: string, orgId: string, publishFn?: Function }} context
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 * @returns {Promise<{ receiptId: string }>}
 */
export async function approvePost(approvalId, context, db) {
  const { workflowPostApprovals, workflows, workflowRuns } = await import('../db/schema.js');

  const approval = await db.query.workflowPostApprovals.findFirst({
    where: eq(workflowPostApprovals.id, approvalId),
  });

  if (!approval) {
    const err = new Error('Approval request not found.');
    err.code = 'APPROVAL_NOT_FOUND';
    throw err;
  }
  if (approval.orgId !== context.orgId) {
    const err = new Error('You do not have permission to approve this post.');
    err.code = 'APPROVAL_FORBIDDEN';
    throw err;
  }
  if (approval.status !== 'pending') {
    const err = new Error(`Approval is already ${approval.status}.`);
    err.code = 'APPROVAL_NOT_PENDING';
    throw err;
  }
  if (approval.expiresAt < new Date()) {
    await db
      .update(workflowPostApprovals)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(workflowPostApprovals.id, approvalId));
    const err = new Error('This approval request has expired.');
    err.code = 'APPROVAL_EXPIRED';
    throw err;
  }

  const workflow = await db.query.workflows.findFirst({
    where: eq(workflows.id, approval.workflowId),
  });
  const workflowRun = await db.query.workflowRuns.findFirst({
    where: eq(workflowRuns.id, approval.workflowRunId),
  });

  if (!workflow || !workflowRun) {
    const err = new Error('Associated workflow or run not found.');
    err.code = 'APPROVAL_CONTEXT_MISSING';
    throw err;
  }

  const orgContext = { orgId: approval.orgId, userId: context.actorUserId };

  const receiptId = await publishAndRecordReceipt({
    workflow,
    workflowRun,
    orgContext,
    postText: approval.postText,
    postMetadata: approval.postMetadata,
    wardenResult: { verdict: approval.wardenVerdict, riskLevel: approval.wardenRiskLevel },
    approvalId,
    publishFn: context.publishFn,
  }, db);

  await db
    .update(workflowPostApprovals)
    .set({
      status: 'published',
      reviewedByUserId: context.actorUserId,
      approvedAt: new Date(),
      publishedAt: new Date(),
      publishReceiptId: receiptId,
      updatedAt: new Date(),
    })
    .where(eq(workflowPostApprovals.id, approvalId));

  await recordAuditLog({
    orgId: approval.orgId,
    actorUserId: context.actorUserId,
    action: 'approval.post_approved',
    targetType: 'workflow_post_approval',
    targetId: approvalId,
    metadata: { receiptId, service: approval.service },
  }).catch(() => {});

  log.info({ approval_id: approvalId, receipt_id: receiptId }, 'approval_service.approved_and_published');

  return { receiptId };
}

/**
 * Reject a pending post.
 *
 * @param {string} approvalId
 * @param {{ actorUserId: string, orgId: string, reason?: string }} context
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export async function rejectPost(approvalId, context, db) {
  const { workflowPostApprovals } = await import('../db/schema.js');

  const approval = await db.query.workflowPostApprovals.findFirst({
    where: eq(workflowPostApprovals.id, approvalId),
  });

  if (!approval) {
    const err = new Error('Approval request not found.');
    err.code = 'APPROVAL_NOT_FOUND';
    throw err;
  }
  if (approval.orgId !== context.orgId) {
    const err = new Error('You do not have permission to reject this post.');
    err.code = 'APPROVAL_FORBIDDEN';
    throw err;
  }
  if (approval.status !== 'pending') {
    const err = new Error(`Approval is already ${approval.status}.`);
    err.code = 'APPROVAL_NOT_PENDING';
    throw err;
  }

  await db
    .update(workflowPostApprovals)
    .set({
      status: 'rejected',
      reviewedByUserId: context.actorUserId,
      rejectedAt: new Date(),
      rejectionReason: context.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workflowPostApprovals.id, approvalId));

  await recordAuditLog({
    orgId: approval.orgId,
    actorUserId: context.actorUserId,
    action: 'approval.post_rejected',
    targetType: 'workflow_post_approval',
    targetId: approvalId,
    metadata: { reason: context.reason ?? null, service: approval.service },
  }).catch(() => {});

  log.info({ approval_id: approvalId }, 'approval_service.rejected');
}

/**
 * List pending approvals for an org.
 * @param {string} orgId
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export async function listPendingApprovals(orgId, db) {
  const { workflowPostApprovals } = await import('../db/schema.js');

  return db.query.workflowPostApprovals.findMany({
    where: and(
      eq(workflowPostApprovals.orgId, orgId),
      eq(workflowPostApprovals.status, 'pending'),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}

/**
 * Expire stale pending approvals (run periodically, e.g. in the schedule worker tick).
 * @param {import('drizzle-orm/postgres-js').PostgresJsDatabase} db
 */
export async function expireStaleApprovals(db) {
  const { workflowPostApprovals } = await import('../db/schema.js');

  const result = await db
    .update(workflowPostApprovals)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        eq(workflowPostApprovals.status, 'pending'),
        lt(workflowPostApprovals.expiresAt, new Date()),
      ),
    )
    .returning({ id: workflowPostApprovals.id });

  if (result.length > 0) {
    log.info({ expired: result.length }, 'approval_service.expired_stale');
  }
  return result.length;
}

/**
 * Publish a post via the social actions service and record a receipt.
 */
async function publishAndRecordReceipt(params, db) {
  const { workflow, workflowRun, orgContext, postText, postMetadata, wardenResult, approvalId, publishFn } = params;
  const { publishReceipts } = await import('../db/schema.js');

  const publish = publishFn ?? (await import('./actions/social-actions.js')).publishSocialPost;

  const service = postMetadata.service ?? 'linkedin';

  let providerPostId = null;
  let authorUrn = null;
  let status = 'published';
  let errorMessage = null;
  let publishedAt = null;

  try {
    const result = await publish(
      {
        service,
        text: postText,
        title: postMetadata.title ?? undefined,
        linkUrl: postMetadata.linkUrl ?? undefined,
        imageUrl: postMetadata.imageUrl ?? undefined,
        contentId: postMetadata.contentId ?? undefined,
      },
      orgContext,
    );

    providerPostId = result.delivery?.providerMessageId ?? null;
    authorUrn = result.delivery?.target ?? null;
    publishedAt = new Date();
  } catch (err) {
    status = 'failed';
    errorMessage = String(err?.message ?? err).slice(0, 500);
    log.error({ err, workflow_id: workflow.id }, 'approval_service.publish_failed');
    throw err;
  } finally {
    const [receipt] = await db
      .insert(publishReceipts)
      .values({
        workflowId: workflow.id,
        workflowRunId: workflowRun.id,
        approvalId: approvalId ?? null,
        orgId: orgContext.orgId,
        service,
        providerPostId,
        authorUrn,
        postText,
        postMetadata,
        wardenVerdict: wardenResult?.verdict ?? null,
        wardenRiskLevel: wardenResult?.riskLevel ?? null,
        status,
        errorMessage,
        publishedAt,
      })
      .returning();

    if (status === 'published') {
      return receipt.id;
    }
  }
}
