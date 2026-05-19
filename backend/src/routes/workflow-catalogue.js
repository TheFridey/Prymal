import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workflowCatalogueItems } from '../db/schema.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { recordProductEvent } from '../services/telemetry.js';
import { fireAndForgetEmail, notifyWorkflowInstalled } from '../services/email/email-trigger-utils.js';
import { sanitizeErrorForClient } from '../services/security/redaction.js';
import {
  createCataloguePurchase,
  createCatalogueReview,
  createDraftFromWorkflow,
  duplicateCatalogueWorkflowIntoOrg,
  getCatalogueItem,
  isWorkflowCataloguePremiumEnabled,
  listCatalogueItems,
  serializeCatalogueItem,
  submitCatalogueItemForReview,
  updateCatalogueItem,
} from '../services/workflow-catalogue.js';

const router = new Hono();

const listSchema = z.object({
  category: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  pricingType: z.enum(['free', 'premium']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  requiredPlan: z.enum(['free', 'solo', 'pro', 'teams', 'agency']).optional(),
  search: z.string().trim().optional(),
  sort: z.enum(['popular', 'newest', 'rating', 'official']).optional().default('popular'),
});

const cataloguePayloadSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  shortDescription: z.string().trim().min(10).max(240).optional(),
  longDescription: z.string().trim().max(3000).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  expectedOutput: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  requiredInputs: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  expectedRuntimeLabel: z.string().trim().max(80).optional(),
  requiredPlan: z.enum(['free', 'solo', 'pro', 'teams', 'agency']).nullable().optional(),
  pricingType: z.enum(['free', 'premium']).optional(),
  templateWorkflowDefinition: z.record(z.unknown()).optional(),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(1200).optional(),
});

router.get('/', zValidator('query', listSchema), async (context) => {
  const filters = context.req.valid('query');
  const items = await listCatalogueItems(filters);
  await recordProductEvent({
    eventName: 'workflow_catalogue_viewed',
    metadata: { surface: 'catalogue', filters },
  });
  return context.json({ items: items.map((item) => serializeCatalogueItem(item)) });
});

router.get('/mine', requireOrg, async (context) => {
  const org = context.get('org');
  const items = await listCatalogueItems({}, { includeMine: true, orgId: org.orgId });
  return context.json({ items: items.map((item) => serializeCatalogueItem(item, { includeDefinition: true })) });
});

router.post('/from-workflow/:workflowId', requireOrg, requireRole('owner', 'admin'), zValidator('json', cataloguePayloadSchema), async (context) => {
  const org = context.get('org');
  const { workflowId } = context.req.param();
  return withCatalogueErrors(context, async () => {
    const item = await createDraftFromWorkflow({
      userId: org.userId,
      orgId: org.orgId,
      workflowId,
      payload: context.req.valid('json'),
    });
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) }, 201);
  });
});

router.get('/:slug', async (context) => {
  const { slug } = context.req.param();
  return withCatalogueErrors(context, async () => {
    const item = await getCatalogueItem(slug);
    if (!item) return context.json({ error: 'Workflow catalogue item not found.' }, 404);
    await recordProductEvent({
      eventName: 'workflow_catalogue_item_viewed',
      metadata: {
        itemId: item.id,
        slug: item.slug,
        category: item.category,
        pricingType: item.pricingType,
        difficulty: item.difficulty,
        requiredPlan: item.requiredPlan,
      },
    });
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) });
  });
});

router.post('/:id/install', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  return withCatalogueErrors(context, async () => {
    try {
      const { workflow, item } = await duplicateCatalogueWorkflowIntoOrg({
        catalogueItemId: id,
        targetOrgId: org.orgId,
        userId: org.userId,
      });
      fireAndForgetEmail(notifyWorkflowInstalled({
        orgId: org.orgId,
        userId: org.userId,
        workflowId: workflow.id,
        installedWorkflowId: workflow.id,
        workflowTitle: workflow.name ?? item.title,
      }), 'workflow installed email');
      return context.json({
        workflow,
        item: serializeCatalogueItem(item),
        route: `/app/workflows?workflow=${workflow.id}`,
      }, 201);
    } catch (error) {
      await recordProductEvent({
        orgId: org.orgId,
        userId: org.userId,
        eventName: 'workflow_catalogue_install_failed',
        metadata: { itemId: id, reason: error.message },
      });
      throw error;
    }
  });
});

router.patch('/:id', requireOrg, requireRole('owner', 'admin'), zValidator('json', cataloguePayloadSchema), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  return withCatalogueErrors(context, async () => {
    const item = await updateCatalogueItem({
      itemId: id,
      userId: org.userId,
      orgId: org.orgId,
      payload: context.req.valid('json'),
    });
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) });
  });
});

router.post('/:id/submit', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  return withCatalogueErrors(context, async () => {
    const item = await submitCatalogueItemForReview(id, org.userId, org.orgId);
    return context.json({ item: serializeCatalogueItem(item, { includeDefinition: true }) });
  });
});

router.post('/:id/review', requireOrg, zValidator('json', reviewSchema), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const payload = context.req.valid('json');
  return withCatalogueErrors(context, async () => {
    const review = await createCatalogueReview({
      itemId: id,
      userId: org.userId,
      orgId: org.orgId,
      rating: payload.rating,
      text: payload.reviewText,
    });
    return context.json({ review }, 201);
  });
});

router.post('/:id/purchase', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  return withCatalogueErrors(context, async () => {
    if (!isWorkflowCataloguePremiumEnabled()) {
      return context.json({ error: 'Premium workflow purchases are coming soon.' }, 403);
    }
    const item = await db.query.workflowCatalogueItems.findFirst({ where: eq(workflowCatalogueItems.id, id) });
    if (!item || item.pricingType !== 'premium') {
      return context.json({ error: 'Premium workflow not found.' }, 404);
    }
    const purchase = await createCataloguePurchase({ item, buyerOrgId: org.orgId, buyerUserId: org.userId });
    await recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'workflow_catalogue_purchase_started',
      metadata: { itemId: item.id, slug: item.slug, pricingType: item.pricingType },
    });
    return context.json({ purchase, checkoutUrl: null, message: 'Stripe Checkout wiring is pending marketplace enablement.' }, 202);
  });
});

async function withCatalogueErrors(context, action) {
  try {
    return await action();
  } catch (error) {
    return context.json({
      error: sanitizeErrorForClient(error, {
        fallback: 'Workflow Catalogue request failed.',
        internalFallback: 'Workflow Catalogue request failed.',
      }),
    }, error.status ?? 500);
  }
}

export default router;
