import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  apiKeys,
  llmExecutionTraces,
  loreDocuments,
  organisations,
  productEvents,
  users,
  videoGenerationEvents,
  wardenAuditEvents,
  workflowRuns,
  workflows,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { buildGrowthSnapshot } from './growth-snapshot.js';

const router = new Hono();

router.get('/growth', requireStaff, requireStaffPermission('admin.activity.read'), async (context) => {
  const [
    organisationRows,
    userRows,
    eventRows,
    traceRows,
    workflowRows,
    workflowRunRows,
    documentRows,
    apiKeyRows,
    wardenRows,
    videoRows,
  ] = await Promise.all([
    db.query.organisations.findMany({ orderBy: [desc(organisations.createdAt)] }),
    db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
    db.query.productEvents.findMany({ orderBy: [desc(productEvents.createdAt)] }),
    db.query.llmExecutionTraces.findMany({ orderBy: [desc(llmExecutionTraces.createdAt)] }),
    db.query.workflows.findMany({ orderBy: [desc(workflows.createdAt)] }),
    db.query.workflowRuns.findMany({ orderBy: [desc(workflowRuns.createdAt)] }),
    db.query.loreDocuments.findMany({ orderBy: [desc(loreDocuments.createdAt)] }),
    db.query.apiKeys.findMany({ orderBy: [desc(apiKeys.createdAt)] }),
    db.query.wardenAuditEvents.findMany({ orderBy: [desc(wardenAuditEvents.createdAt)] }),
    db.query.videoGenerationEvents.findMany({ orderBy: [desc(videoGenerationEvents.createdAt)] }),
  ]);

  return context.json({
    growth: buildGrowthSnapshot({
      organisations: organisationRows,
      users: userRows,
      events: eventRows,
      traces: traceRows,
      workflows: workflowRows,
      workflowRuns: workflowRunRows,
      documents: documentRows,
      apiKeys: apiKeyRows,
      wardenEvents: wardenRows,
      videoEvents: videoRows,
    }),
  });
});

export default router;
