import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import {
  approveCatalogueItem,
  archiveCatalogueItem,
  createOfficialCatalogueItem,
  listCatalogueItems,
  rejectCatalogueItem,
  serializeCatalogueItem,
} from '../../services/workflow-catalogue.js';

const router = new Hono();

const rejectSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

const officialSchema = z.object({
  slug: z.string().trim().min(3).max(100).optional(),
  title: z.string().trim().min(3).max(120),
  shortDescription: z.string().trim().min(10).max(240),
  longDescription: z.string().trim().max(3000).optional(),
  category: z.string().trim().min(2).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  expectedOutput: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  requiredInputs: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  expectedRuntimeLabel: z.string().trim().max(80).optional(),
  requiredPlan: z.enum(['free', 'solo', 'pro', 'teams', 'agency']).nullable().optional(),
  templateWorkflowDefinition: z.record(z.unknown()),
});

router.get(
  '/workflow-catalogue/submissions',
  requireStaff,
  requireStaffPermission('admin.workflow.catalogue.read'),
  async (context) => {
    const items = await listCatalogueItems({}, { reviewStatus: 'pending' });
    return context.json({ items: items.map((item) => serializeCatalogueItem(item, { includeDefinition: true })) });
  },
);

router.post(
  '/workflow-catalogue/:id/approve',
  requireStaff,
  requireStaffPermission('admin.workflow.catalogue.manage'),
  async (context) => withCatalogueErrors(context, async () => {
    const staff = context.get('staff');
    const item = await approveCatalogueItem(context.req.param('id'), staff.userId);
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) });
  }),
);

router.post(
  '/workflow-catalogue/:id/reject',
  requireStaff,
  requireStaffPermission('admin.workflow.catalogue.manage'),
  zValidator('json', rejectSchema),
  async (context) => withCatalogueErrors(context, async () => {
    const staff = context.get('staff');
    const item = await rejectCatalogueItem(context.req.param('id'), staff.userId, context.req.valid('json').reason);
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) });
  }),
);

router.post(
  '/workflow-catalogue/:id/archive',
  requireStaff,
  requireStaffPermission('admin.workflow.catalogue.manage'),
  async (context) => withCatalogueErrors(context, async () => {
    const staff = context.get('staff');
    const item = await archiveCatalogueItem(context.req.param('id'), staff.userId);
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) });
  }),
);

router.post(
  '/workflow-catalogue/official',
  requireStaff,
  requireStaffPermission('admin.workflow.catalogue.manage'),
  zValidator('json', officialSchema),
  async (context) => withCatalogueErrors(context, async () => {
    const staff = context.get('staff');
    const item = await createOfficialCatalogueItem(staff.userId, context.req.valid('json'));
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) }, 201);
  }),
);

async function withCatalogueErrors(context, action) {
  try {
    return await action();
  } catch (error) {
    return context.json({ error: error.message || 'Workflow Catalogue admin request failed.' }, error.status ?? 500);
  }
}

export default router;
