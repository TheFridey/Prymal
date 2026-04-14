import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  agentMemory,
  llmExecutionTraces,
  loreDocuments,
  organisations,
  users,
  workflowRuns,
  workflows,
} from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';

const router = new Hono();

function buildIdLike(column, query) {
  return sql`${column}::text ilike ${`%${query}%`}`;
}

router.get('/search', requireStaff, requireStaffPermission('admin.view'), async (context) => {
  const query = context.req.query('q')?.trim() ?? '';
  const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 6), 1), 12);

  if (query.length < 2) {
    return context.json({ query, results: [] });
  }

  const likeQuery = `%${query}%`;

  const [organisationRows, userRows, workflowRows, runRows, traceRows, documentRows, memoryRows] = await Promise.all([
    db.query.organisations.findMany({
      where: or(
        ilike(organisations.name, likeQuery),
        ilike(organisations.slug, likeQuery),
        ilike(organisations.stripeCustomerId, likeQuery),
        ilike(organisations.stripeSubId, likeQuery),
        buildIdLike(organisations.id, query),
      ),
      orderBy: [desc(organisations.updatedAt)],
      limit,
    }),
    db.query.users.findMany({
      where: or(
        ilike(users.email, likeQuery),
        ilike(users.firstName, likeQuery),
        ilike(users.lastName, likeQuery),
        buildIdLike(users.id, query),
      ),
      orderBy: [desc(users.updatedAt)],
      limit,
    }),
    db.query.workflows.findMany({
      where: or(
        ilike(workflows.name, likeQuery),
        buildIdLike(workflows.id, query),
        buildIdLike(workflows.orgId, query),
      ),
      orderBy: [desc(workflows.updatedAt)],
      limit,
    }),
    db.query.workflowRuns.findMany({
      where: or(
        buildIdLike(workflowRuns.id, query),
        buildIdLike(workflowRuns.workflowId, query),
        ilike(workflowRuns.status, likeQuery),
        ilike(workflowRuns.failureClass, likeQuery),
      ),
      orderBy: [desc(workflowRuns.createdAt)],
      limit,
    }),
    db.query.llmExecutionTraces.findMany({
      where: or(
        buildIdLike(llmExecutionTraces.id, query),
        ilike(llmExecutionTraces.agentId, likeQuery),
        ilike(llmExecutionTraces.model, likeQuery),
        ilike(llmExecutionTraces.policyKey, likeQuery),
        buildIdLike(llmExecutionTraces.conversationId, query),
        buildIdLike(llmExecutionTraces.workflowRunId, query),
      ),
      orderBy: [desc(llmExecutionTraces.createdAt)],
      limit,
    }),
    db.query.loreDocuments.findMany({
      where: or(
        ilike(loreDocuments.title, likeQuery),
        ilike(loreDocuments.sourceType, likeQuery),
        ilike(loreDocuments.sourceUrl, likeQuery),
        buildIdLike(loreDocuments.id, query),
      ),
      orderBy: [desc(loreDocuments.updatedAt)],
      limit,
    }),
    db.query.agentMemory.findMany({
      where: or(
        ilike(agentMemory.key, likeQuery),
        ilike(agentMemory.value, likeQuery),
        ilike(agentMemory.scope, likeQuery),
        ilike(agentMemory.agentId, likeQuery),
        buildIdLike(agentMemory.id, query),
      ),
      orderBy: [desc(agentMemory.updatedAt)],
      limit,
    }),
  ]);

  const results = [
    ...organisationRows.map((row) => ({
      kind: 'organisation',
      id: row.id,
      title: row.name,
      subtitle: `${row.plan} workspace | ${row.slug}`,
      targetTab: 'organisations',
      orgId: row.id,
    })),
    ...organisationRows
      .filter((row) => row.stripeCustomerId || row.stripeSubId)
      .map((row) => ({
        kind: 'billing_entity',
        id: row.id,
        title: row.name,
        subtitle: `${row.stripeCustomerId ?? 'no customer'} | ${row.stripeSubId ?? 'no subscription'}`,
        targetTab: 'billing',
        orgId: row.id,
      })),
    ...userRows.map((row) => ({
      kind: 'user',
      id: row.id,
      title: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email,
      subtitle: `${row.email} | ${row.role}`,
      targetTab: 'users',
      userId: row.id,
    })),
    ...workflowRows.map((row) => ({
      kind: 'workflow',
      id: row.id,
      title: row.name,
      subtitle: `Workflow | org ${row.orgId}`,
      targetTab: 'workflow-ops',
      workflowId: row.id,
      orgId: row.orgId,
    })),
    ...runRows.map((row) => ({
      kind: 'workflow_run',
      id: row.id,
      title: `${row.status} run`,
      subtitle: `${row.workflowId} | ${row.failureClass ?? 'no failure class'}`,
      targetTab: 'workflow-ops',
      workflowRunId: row.id,
      orgId: row.orgId,
    })),
    ...traceRows.map((row) => ({
      kind: 'trace',
      id: row.id,
      title: `${row.agentId} via ${row.model}`,
      subtitle: `${row.outcomeStatus} | ${row.policyKey}`,
      targetTab: 'traces',
      traceId: row.id,
      workflowRunId: row.workflowRunId,
      orgId: row.orgId,
    })),
    ...documentRows.map((row) => ({
      kind: 'lore_document',
      id: row.id,
      title: row.title,
      subtitle: `${row.sourceType} | ${row.status}`,
      targetTab: 'activity',
      documentId: row.id,
      orgId: row.orgId,
    })),
    ...memoryRows.map((row) => ({
      kind: 'memory',
      id: row.id,
      title: row.key,
      subtitle: `${row.agentId} | ${row.scope} | ${row.provenanceKind}`,
      targetTab: 'activity',
      memoryId: row.id,
      orgId: row.orgId,
    })),
  ]
    .slice(0, limit * 6)
    .sort((left, right) => left.title.localeCompare(right.title))
    .slice(0, limit * 4);

  return context.json({ query, results });
});

router.get('/org-health/:orgId', requireStaff, requireStaffPermission('admin.org.read'), async (context) => {
  const { orgId } = context.req.param();
  const organisation = await db.query.organisations.findFirst({ where: eq(organisations.id, orgId) });

  if (!organisation) {
    return context.json({ error: 'Organisation not found.' }, 404);
  }

  const [memberCount, workflowCount, documentCount, traceCount, memoryCount, recentRunCount] = await Promise.all([
    db.select({ count: sql`count(*)::int` }).from(users).where(eq(users.orgId, orgId)),
    db.select({ count: sql`count(*)::int` }).from(workflows).where(eq(workflows.orgId, orgId)),
    db.select({ count: sql`count(*)::int` }).from(loreDocuments).where(eq(loreDocuments.orgId, orgId)),
    db.select({ count: sql`count(*)::int` }).from(llmExecutionTraces).where(eq(llmExecutionTraces.orgId, orgId)),
    db.select({ count: sql`count(*)::int` }).from(agentMemory).where(eq(agentMemory.orgId, orgId)),
    db.select({ count: sql`count(*)::int` }).from(workflowRuns).where(eq(workflowRuns.orgId, orgId)),
  ]);

  return context.json({
    organisation: {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      plan: organisation.plan,
      seatLimit: organisation.seatLimit,
      creditsUsed: organisation.creditsUsed,
      monthlyCreditLimit: organisation.monthlyCreditLimit,
      updatedAt: organisation.updatedAt,
    },
    health: {
      members: memberCount[0]?.count ?? 0,
      workflows: workflowCount[0]?.count ?? 0,
      loreDocuments: documentCount[0]?.count ?? 0,
      traces: traceCount[0]?.count ?? 0,
      memoryEntries: memoryCount[0]?.count ?? 0,
      workflowRuns: recentRunCount[0]?.count ?? 0,
    },
  });
});

export default router;
