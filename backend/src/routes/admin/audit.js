// routes/admin/audit.js
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { adminActionLogs, auditLogs, productEvents } from '../../db/schema.js';
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

export default router;
