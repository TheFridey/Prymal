// routes/admin/waitlist.js
import { asc, count, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { emailQueue, waitlistEntries } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { getAdminMutationMeta } from '../../services/admin-mutations.js';
import { recordAdminActionLog } from '../../services/telemetry.js';

const router = new Hono();

export const batchInviteSchema = z.object({
  ids: z.array(z.string().uuid('Each waitlist entry id must be a valid UUID.'))
    .min(1, 'ids must include at least one waitlist entry UUID.')
    .max(100, 'ids cannot contain more than 100 waitlist entry UUIDs.'),
});

export function batchInviteValidationHook(result, context) {
  if (result.success) {
    return;
  }

  return context.json(
    {
      error: result.error.issues[0]?.message ?? 'Invalid waitlist batch invite request.',
    },
    400,
  );
}

function buildInviteUrl(frontendUrl = process.env.FRONTEND_URL) {
  const normalizedFrontendUrl = String(frontendUrl ?? '').trim().replace(/\/$/, '');
  return normalizedFrontendUrl ? `${normalizedFrontendUrl}/signup` : '/signup';
}

async function defaultFindWaitlistEntryById(id) {
  return db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.id, id),
  });
}

async function defaultInviteWaitlistEntry({ entry, now, inviteUrl }) {
  await db.transaction(async (tx) => {
    await tx.insert(emailQueue).values({
      toEmail: entry.email,
      templateName: 'waitlist_invite',
      payload: {
        subject: "You're invited to Prymal",
        email: entry.email,
        inviteUrl,
        source: entry.source ?? 'waitlist',
      },
      sendAfter: now,
    });

    await tx.update(waitlistEntries).set({ invitedAt: now }).where(eq(waitlistEntries.id, entry.id));
  });
}

export async function dispatchWaitlistBatchInvite({
  ids,
  staff,
  now = new Date(),
  requestId = null,
  idempotencyKey = null,
  frontendUrl = process.env.FRONTEND_URL,
  findWaitlistEntryById = defaultFindWaitlistEntryById,
  inviteWaitlistEntry = defaultInviteWaitlistEntry,
  recordAdminAction = recordAdminActionLog,
}) {
  const inviteUrl = buildInviteUrl(frontendUrl);
  let queued = 0;
  let skipped = 0;

  for (const id of ids) {
    const entry = await findWaitlistEntryById(id);

    if (!entry || entry.invitedAt) {
      skipped += 1;
      continue;
    }

    await inviteWaitlistEntry({ entry, now, inviteUrl });
    queued += 1;
  }

  await recordAdminAction({
    orgId: null,
    actorUserId: staff?.userId ?? null,
    actorStaffRole: staff?.staffRole,
    action: 'admin.waitlist.batch_invite',
    permission: 'admin.waitlist.write',
    targetType: 'waitlist',
    targetId: null,
    requestId,
    idempotencyKey,
    reasonCode: 'manual_batch_invite',
    reason: `Batch invite dispatched to ${queued} waitlist entries from the staff console.`,
    metadata: {
      queued,
      skipped,
      totalRequested: ids.length,
    },
  });

  return {
    queued,
    skipped,
    invitedAt: now.toISOString(),
  };
}

export function createBatchInviteHandler({
  getNow = () => new Date(),
  frontendUrl = process.env.FRONTEND_URL,
  findWaitlistEntryById = defaultFindWaitlistEntryById,
  inviteWaitlistEntry = defaultInviteWaitlistEntry,
  recordAdminAction = recordAdminActionLog,
} = {}) {
  return async (context) => {
    const staff = context.get('staff');
    const payload = context.req.valid('json');
    const mutationMeta = getAdminMutationMeta(context);

    const result = await dispatchWaitlistBatchInvite({
      ids: payload.ids,
      staff,
      now: getNow(),
      requestId: mutationMeta.requestId,
      idempotencyKey: mutationMeta.idempotencyKey,
      frontendUrl,
      findWaitlistEntryById,
      inviteWaitlistEntry,
      recordAdminAction,
    });

    return context.json(result);
  };
}

router.get('/waitlist', requireStaff, requireStaffPermission('admin.waitlist.read'), async (context) => {
  const limit = Math.min(Number(context.req.query('limit') ?? 100), 1000);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);

  const rows = await db.query.waitlistEntries.findMany({
    orderBy: [desc(waitlistEntries.createdAt)],
    limit, offset,
  });

  const [{ count: total = 0 } = { count: 0 }] = await db.select({ count: count() }).from(waitlistEntries);

  return context.json({
    total, limit, offset,
    entries: rows.map((entry) => ({
      id: entry.id,
      email: entry.email,
      source: entry.source,
      invitedAt: entry.invitedAt,
      createdAt: entry.createdAt,
    })),
  });
});

router.post(
  '/waitlist/batch-invite',
  requireStaff,
  requireStaffPermission('admin.waitlist.write'),
  zValidator('json', batchInviteSchema, batchInviteValidationHook),
  createBatchInviteHandler(),
);

router.get('/waitlist/export', requireStaff, requireStaffPermission('admin.waitlist.read'), async (context) => {
  const rows = await db.query.waitlistEntries.findMany({ orderBy: [asc(waitlistEntries.createdAt)] });

  const csvLines = [
    'id,email,source,created_at',
    ...rows.map((entry) =>
      [
        entry.id,
        `"${entry.email.replace(/"/g, '""')}"`,
        `"${(entry.source ?? '').replace(/"/g, '""')}"`,
        entry.createdAt ? new Date(entry.createdAt).toISOString() : '',
      ].join(','),
    ),
  ];

  return new Response(csvLines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="prymal-waitlist.csv"',
    },
  });
});

export default router;
