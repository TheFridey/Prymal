/**
 * POST /approvals/:id/approve  – approve a pending post
 * POST /approvals/:id/reject   – reject a pending post
 * GET  /approvals               – list pending approvals for the org
 * GET  /approvals/receipts      – list publish receipts for the org
 */

import { and, desc, eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { publishReceipts, workflowPostApprovals } from '../db/schema.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { approvePost, listPendingApprovals, rejectPost } from '../services/approval-service.js';

const router = new Hono();

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// List pending approvals for this org
router.get('/', requireOrg, async (context) => {
  const org = context.get('org');

  const approvals = await listPendingApprovals(org.orgId, db);

  return context.json({ approvals });
});

// List publish receipts for this org
router.get('/receipts', requireOrg, async (context) => {
  const org = context.get('org');
  const limit = Math.min(Number(context.req.query('limit') ?? 50), 200);

  const receipts = await db.query.publishReceipts.findMany({
    where: eq(publishReceipts.orgId, org.orgId),
    orderBy: [desc(publishReceipts.createdAt)],
    limit,
  });

  return context.json({ receipts });
});

// Approve a pending post
router.post('/:id/approve', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  try {
    const result = await approvePost(id, { actorUserId: org.userId, orgId: org.orgId }, db);
    return context.json({ success: true, receiptId: result.receiptId });
  } catch (error) {
    const status = error.code === 'APPROVAL_NOT_FOUND' ? 404
      : error.code === 'APPROVAL_FORBIDDEN' ? 403
      : error.code === 'APPROVAL_EXPIRED' ? 410
      : error.code === 'APPROVAL_NOT_PENDING' ? 409
      : 422;
    return context.json({ error: error.message, code: error.code }, status);
  }
});

// Reject a pending post
router.post('/:id/reject', requireOrg, requireRole('owner', 'admin'), zValidator('json', rejectSchema), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const { reason } = context.req.valid('json');

  try {
    await rejectPost(id, { actorUserId: org.userId, orgId: org.orgId, reason }, db);
    return context.json({ success: true });
  } catch (error) {
    const status = error.code === 'APPROVAL_NOT_FOUND' ? 404
      : error.code === 'APPROVAL_FORBIDDEN' ? 403
      : error.code === 'APPROVAL_NOT_PENDING' ? 409
      : 422;
    return context.json({ error: error.message, code: error.code }, status);
  }
});

export default router;
