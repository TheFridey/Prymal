import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { contentAssets, loreDocuments, organisations, workflowTemplates, workflows } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { getLearningSignalsForOrg } from '../services/learning-signals.js';
import { getOrgLearningSnapshot } from '../services/moat-feedback.js';

const router = new Hono();

router.get('/context/metrics', requireOrg, async (context) => {
  const org = context.get('org');
  const learning = await getOrgLearningSnapshot({ orgId: org.orgId });
  return context.json({ learning });
});

router.get('/learning-signals', requireOrg, async (context) => {
  const org = context.get('org');
  const learningSignals = await getLearningSignalsForOrg({ orgId: org.orgId });
  return context.json(learningSignals);
});

router.get('/context/export', requireOrg, async (context) => {
  const org = context.get('org');
  const [organisation, learning, loreDocs, templates, savedWorkflows, assets] = await Promise.all([
    db.query.organisations.findFirst({ where: eq(organisations.id, org.orgId) }),
    getOrgLearningSnapshot({ orgId: org.orgId }),
    db.query.loreDocuments.findMany({
      where: eq(loreDocuments.orgId, org.orgId),
      orderBy: [desc(loreDocuments.createdAt)],
      columns: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        wordCount: true,
        status: true,
        version: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.query.workflowTemplates.findMany({
      where: eq(workflowTemplates.orgId, org.orgId),
      orderBy: [desc(workflowTemplates.updatedAt)],
    }),
    db.query.workflows.findMany({
      where: eq(workflows.orgId, org.orgId),
      orderBy: [desc(workflows.updatedAt)],
    }),
    db.query.contentAssets.findMany({
      where: eq(contentAssets.orgId, org.orgId),
      orderBy: [desc(contentAssets.createdAt)],
      limit: 500,
    }),
  ]);

  return context.json({
    exportedAt: new Date().toISOString(),
    organisation: {
      id: org.orgId,
      name: organisation?.name ?? org.orgName,
      plan: organisation?.plan ?? org.orgPlan,
      metadata: organisation?.metadata ?? {},
    },
    learning,
    brandVoiceProfile: organisation?.metadata?.brandVoiceProfile ?? organisation?.metadata?.brandVoice ?? null,
    businessContext: organisation?.metadata?.businessContext ?? organisation?.metadata?.onboarding ?? null,
    loreDocuments: loreDocs,
    workflowTemplates: templates,
    workflows: savedWorkflows,
    contentAssets: assets.map((asset) => ({
      id: asset.id,
      messageId: asset.messageId,
      conversationId: asset.conversationId,
      workflowId: asset.workflowId,
      workflowRunId: asset.workflowRunId,
      sourceAgent: asset.sourceAgent,
      contentType: asset.contentType,
      title: asset.title,
      body: asset.body,
      parentContentId: asset.parentContentId,
      derivedContentIds: asset.derivedContentIds,
      deliveryStatus: asset.deliveryStatus,
      deliveredAt: asset.deliveredAt,
      resultMetadata: asset.resultMetadata,
      createdAt: asset.createdAt,
    })),
  });
});

export default router;
