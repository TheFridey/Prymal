// routes/admin/support.js
import { asc, desc, eq, isNull, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { auditLogs, emailQueue, emailUnsubscribes, powerups } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { findAdminMutationReplay, getAdminMutationMeta } from '../../services/admin-mutations.js';
import { sendDay3Email, sendDay7Email } from '../../services/email.js';
import { pruneExpiredMemory } from '../../services/memory-pruner.js';
import { recordAdminActionLog, recordAuditLog } from '../../services/telemetry.js';
import { and } from 'drizzle-orm';

const router = new Hono();

const memoryPruneSchema = z.object({ dryRun: z.boolean().optional().default(false) });

const powerupCreateSchema = z.object({
  agentId: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(10_000),
});

const powerupUpdateSchema = z.object({
  agentId: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().trim().min(1).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

router.post(
  '/memory/prune',
  requireStaff,
  requireStaffPermission('admin.memory.prune'),
  zValidator('json', memoryPruneSchema),
  async (context) => {
    const staff = context.get('staff');
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);
    const replay = await findAdminMutationReplay({
      actorUserId: staff.userId,
      action: payload.dryRun ? 'admin.memory.prune.preview' : 'admin.memory.prune.execute',
      idempotencyKey: mutationMeta.idempotencyKey,
    });

    if (replay) {
      return context.json({
        pruned: replay.metadata?.pruned ?? 0,
        dryRun: payload.dryRun,
        receipt: replay,
        replayed: true,
      });
    }

    const result = await pruneExpiredMemory({ dryRun: payload.dryRun });

    const receipt = await recordAdminActionLog({
      orgId: null, actorUserId: staff.userId, actorStaffRole: staff.staffRole,
      action: payload.dryRun ? 'admin.memory.prune.preview' : 'admin.memory.prune.execute',
      permission: 'admin.memory.prune',
      targetType: 'memory_scope', targetId: 'temporary_session',
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: payload.dryRun ? 'temporary_session_prune_preview' : 'temporary_session_prune',
      reason: payload.dryRun
        ? 'Previewed expired temporary session memory records from the staff control plane.'
        : 'Pruned expired temporary session memory records from the staff control plane.',
      metadata: { dryRun: payload.dryRun, pruned: result.pruned },
    });

    await recordAuditLog({
      orgId: null, actorUserId: staff.userId,
      action: payload.dryRun ? 'staff.admin.memory_prune_previewed' : 'staff.admin.memory_pruned',
      targetType: 'memory_scope', targetId: 'temporary_session',
      metadata: { dryRun: payload.dryRun, pruned: result.pruned },
    });

    return context.json({ ...result, receipt });
  },
);

router.get('/email-queue', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const status = context.req.query('status') ?? 'pending';
  const limit = Math.min(Number(context.req.query('limit') ?? 50), 200);

  const rows = status === 'sent'
    ? await db.query.emailQueue.findMany({ where: (table, { isNotNull }) => isNotNull(table.sentAt), orderBy: [desc(emailQueue.sentAt)], limit })
    : await db.query.emailQueue.findMany({ where: (table, { isNull }) => isNull(table.sentAt), orderBy: [asc(emailQueue.sendAfter)], limit });

  return context.json({ queue: rows, count: rows.length });
});

router.post('/process-email-queue', requireStaff, requireStaffPermission('admin.email.process'), async (context) => {
  const staff = context.get('staff');
  const mutationMeta = getAdminMutationMeta(context);
  const replay = await findAdminMutationReplay({
    actorUserId: staff.userId,
    action: 'admin.email.process',
    idempotencyKey: mutationMeta.idempotencyKey,
  });

  if (replay) {
    return context.json({
      processed: replay.metadata?.processed ?? 0,
      sent: replay.metadata?.sent ?? 0,
      failed: replay.metadata?.failed ?? 0,
      receipt: replay,
      replayed: true,
    });
  }

  const now = new Date();
  const pending = await db.select().from(emailQueue).where(and(isNull(emailQueue.sentAt), lte(emailQueue.sendAfter, now))).limit(50);

  if (pending.length === 0) {
    const emptyReceipt = await recordAdminActionLog({
      orgId: null,
      actorUserId: staff.userId,
      actorStaffRole: staff.staffRole,
      action: 'admin.email.process',
      permission: 'admin.email.process',
      targetType: 'email_queue',
      targetId: null,
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: 'email_queue_process',
      reason: 'Processed pending transactional emails from the staff control plane.',
      metadata: { processed: 0, sent: 0, failed: 0 },
    });
    return context.json({ processed: 0, message: 'Nothing pending.', receipt: emptyReceipt });
  }

  let sent = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const unsub = await db.select({ id: emailUnsubscribes.id }).from(emailUnsubscribes).where(eq(emailUnsubscribes.email, entry.toEmail.toLowerCase().trim())).limit(1);

      if (unsub.length > 0) {
        await db.update(emailQueue).set({ sentAt: new Date() }).where(eq(emailQueue.id, entry.id));
        sent += 1;
        continue;
      }

      const payload = entry.payload ?? {};
      if (entry.templateName === 'onboarding_day3') await sendDay3Email(entry.toEmail, payload);
      else if (entry.templateName === 'onboarding_day7') await sendDay7Email(entry.toEmail, payload);

      await db.update(emailQueue).set({ sentAt: new Date() }).where(eq(emailQueue.id, entry.id));
      sent += 1;
    } catch (error) {
      console.error(`[EMAIL QUEUE] Failed to send ${entry.id}:`, error.message);
      failed += 1;
    }
  }

  const receipt = await recordAdminActionLog({
    orgId: null,
    actorUserId: staff.userId,
    actorStaffRole: staff.staffRole,
    action: 'admin.email.process',
    permission: 'admin.email.process',
    targetType: 'email_queue',
    targetId: null,
    requestId: mutationMeta.requestId,
    idempotencyKey: mutationMeta.idempotencyKey,
    reasonCode: 'email_queue_process',
    reason: 'Processed pending transactional emails from the staff control plane.',
    metadata: { processed: pending.length, sent, failed },
  });

  return context.json({ processed: pending.length, sent, failed, receipt });
});

router.get('/powerups', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const rows = await db.select().from(powerups).orderBy(asc(powerups.agentId), asc(powerups.createdAt));
  return context.json({ powerups: rows });
});

router.post('/powerups', requireStaff, requireStaffPermission('admin.powerups.manage'), zValidator('json', powerupCreateSchema), async (context) => {
  const body = context.req.valid('json');
  const [row] = await db.insert(powerups).values(body).returning();
  return context.json({ powerup: row }, 201);
});

router.patch('/powerups/:id', requireStaff, requireStaffPermission('admin.powerups.manage'), zValidator('json', powerupUpdateSchema), async (context) => {
  const { id } = context.req.param();
  const body = context.req.valid('json');
  const [row] = await db.update(powerups).set({ ...body, updatedAt: new Date() }).where(eq(powerups.id, id)).returning();
  if (!row) return context.json({ error: 'Power-up not found.' }, 404);
  return context.json({ powerup: row });
});

router.delete('/powerups/:id', requireStaff, requireStaffPermission('admin.powerups.manage'), async (context) => {
  const { id } = context.req.param();
  const deleted = await db.delete(powerups).where(eq(powerups.id, id)).returning({ id: powerups.id });
  if (deleted.length === 0) return context.json({ error: 'Power-up not found.' }, 404);
  return context.json({ success: true });
});

export default router;
