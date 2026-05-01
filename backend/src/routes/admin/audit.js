// routes/admin/audit.js
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { adminActionLogs, auditLogs, productEvents, wardenAuditEvents } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';

const router = new Hono();

router.get('/audit-logs', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const limit = Math.min(Number(context.req.query('limit') ?? 100), 500);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const rows = await db.query.auditLogs.findMany({ orderBy: [desc(auditLogs.createdAt)], limit, offset });
  return context.json({ logs: rows, count: rows.length });
});

router.get('/admin-action-logs', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const limit = Math.min(Number(context.req.query('limit') ?? 100), 500);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const rows = await db.query.adminActionLogs.findMany({ orderBy: [desc(adminActionLogs.createdAt)], limit, offset });
  return context.json({ logs: rows, count: rows.length });
});

router.get('/admin-action-logs/:id', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const { id } = context.req.param();
  const receipt = await db.query.adminActionLogs.findFirst({ where: eq(adminActionLogs.id, id) });
  if (!receipt) return context.json({ error: 'Action receipt not found.' }, 404);
  return context.json({ receipt });
});

router.get('/product-events', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const limit = Math.min(Number(context.req.query('limit') ?? 100), 500);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const eventName = context.req.query('eventName');
  const rows = await db.query.productEvents.findMany({
    where: eventName ? eq(productEvents.eventName, eventName) : undefined,
    orderBy: [desc(productEvents.createdAt)],
    limit, offset,
  });
  return context.json({ events: rows, count: rows.length });
});

router.get('/warden-events', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const limit = Math.min(Number(context.req.query('limit') ?? 100), 500);
  const offset = Math.max(Number(context.req.query('offset') ?? 0), 0);
  const filters = [];
  const filterMap = [
    ['verdict', wardenAuditEvents.verdict],
    ['riskLevel', wardenAuditEvents.riskLevel],
    ['surface', wardenAuditEvents.surface],
    ['sourceType', wardenAuditEvents.sourceType],
    ['userId', wardenAuditEvents.userId],
    ['orgId', wardenAuditEvents.orgId],
    ['toolName', wardenAuditEvents.toolName],
    ['provider', wardenAuditEvents.provider],
  ];

  for (const [queryKey, column] of filterMap) {
    const value = context.req.query(queryKey);
    if (value) filters.push(eq(column, value));
  }

  const category = context.req.query('category');
  if (category) {
    filters.push(sql`${wardenAuditEvents.categories}::jsonb ? ${category}`);
  }

  const from = context.req.query('from');
  const to = context.req.query('to');
  if (from) filters.push(gte(wardenAuditEvents.createdAt, new Date(from)));
  if (to) filters.push(lte(wardenAuditEvents.createdAt, new Date(to)));

  const rows = await db.query.wardenAuditEvents.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(wardenAuditEvents.createdAt)],
    limit,
    offset,
  });
  return context.json({
    events: rows.map((event) => ({
      ...event,
      modelClassifier: event.metadata?.modelClassifier ?? null,
    })),
    count: rows.length,
  });
});

export default router;
