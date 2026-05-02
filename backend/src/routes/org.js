import { desc, eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { contentAssets, loreDocuments, organisations, workflowTemplates, workflows } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { getLearningSignalsForOrg } from '../services/learning-signals.js';
import { getOrgLearningSnapshot } from '../services/moat-feedback.js';
import { recordProductEvent } from '../services/telemetry.js';

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

const clientProductEventSchema = z.object({
  eventName: z.enum([
    'output.feedback_useful',
    'output.feedback_not_useful',
    'output.feedback_save_intent',
    'output.feedback_rerun',
    'output.feedback_workflow_intent',
    'output.feedback_improve',
    'first_run_outcome_selected',
    'first_win_prompt_started',
    'first_win_prompt_submitted',
    'first_agent_response_completed',
    'first_useful_output_candidate',
    'lore_empty_state_seen',
    'first_lore_source_added',
    'first_lore_question_asked',
    'lore_source_used_in_response',
    'workflow_cta_shown',
    'workflow_cta_clicked',
    'workflow_draft_created_from_chat',
    'credit_estimate_shown',
    'credit_actual_shown',
    'credit_block_seen',
    'topup_cta_seen',
    'warden_block_user_seen',
    'warden_confirmation_seen',
    'warden_confirmation_approved',
    'warden_confirmation_denied',
    'sentinel_hold_seen',
    'media_estimate_seen',
    'media_generation_started',
    'media_generation_completed',
    'media_regenerate_clicked',
  ]),
  metadata: z
    .object({
      agentId: z.string().optional(),
      conversationId: z.string().uuid().optional(),
      messageId: z.string().uuid().optional(),
    })
    .passthrough()
    .optional(),
});

router.post('/product-events', requireOrg, zValidator('json', clientProductEventSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');
  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: payload.eventName,
    metadata: { ...(payload.metadata ?? {}), surface: 'client' },
  });
  return context.json({ ok: true });
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
