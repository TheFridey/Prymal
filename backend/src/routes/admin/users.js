// routes/admin/users.js
import { desc, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { findAdminMutationReplay, getAdminMutationMeta } from '../../services/admin-mutations.js';
import { recordAdminActionLog, recordAuditLog } from '../../services/telemetry.js';

const router = new Hono();

const userUpdateSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']).optional(),
  orgId: z.string().uuid().nullable().optional(),
  reasonCode: z.string().trim().min(2).max(80).optional().default('manual_override'),
  reason: z.string().trim().min(4).max(500).optional().default('Updated in staff console.'),
});

router.get('/users', requireStaff, requireStaffPermission('admin.user.read'), async (context) => {
  const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 25), 1), 100);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const query = context.req.query('q')?.trim();

  const rows = await db.query.users.findMany({
    where: query
      ? or(ilike(users.email, `%${query}%`), ilike(users.firstName, `%${query}%`), ilike(users.lastName, `%${query}%`))
      : undefined,
    orderBy: [desc(users.createdAt)],
    limit,
    offset,
  });

  return context.json({ users: rows, count: rows.length, limit, offset });
});

router.patch(
  '/users/:userId',
  requireStaff,
  requireStaffPermission('admin.user.update'),
  zValidator('json', userUpdateSchema),
  async (context) => {
    const staff = context.get('staff');
    const { userId } = context.req.param();
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);
    const replay = await findAdminMutationReplay({
      actorUserId: staff.userId,
      action: 'admin.user.update',
      idempotencyKey: mutationMeta.idempotencyKey,
    });

    if (replay) {
      return context.json({
        user: replay.metadata?.after ?? null,
        receipt: replay,
        replayed: true,
      });
    }

    const existing = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!existing) return context.json({ error: 'User not found.' }, 404);

    const nextValues = {
      ...(payload.role ? { role: payload.role } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'orgId') ? { orgId: payload.orgId } : {}),
      updatedAt: new Date(),
    };

    const [updated] = await db.update(users).set(nextValues).where(eq(users.id, userId)).returning();

    await recordAuditLog({
      orgId: updated.orgId ?? null, actorUserId: staff.userId,
      action: 'staff.admin.user_updated', targetType: 'user', targetId: userId,
      metadata: {
        before: { role: existing.role, orgId: existing.orgId },
        after: { role: updated.role, orgId: updated.orgId },
      },
    });

    const receipt = await recordAdminActionLog({
      orgId: updated.orgId ?? existing.orgId ?? null,
      actorUserId: staff.userId, actorStaffRole: staff.staffRole,
      action: 'admin.user.update', permission: 'admin.user.update',
      targetType: 'user', targetId: userId,
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      reasonCode: payload.reasonCode, reason: payload.reason ?? null,
      metadata: {
        before: { role: existing.role, orgId: existing.orgId },
        after: { role: updated.role, orgId: updated.orgId },
      },
    });

    return context.json({
      user: {
        id: updated.id,
        role: updated.role,
        orgId: updated.orgId,
        updatedAt: updated.updatedAt,
      },
      receipt,
    });
  },
);

export default router;
