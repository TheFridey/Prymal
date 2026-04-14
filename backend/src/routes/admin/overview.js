// routes/admin/overview.js
import Stripe from 'stripe';
import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import {
  adminActionLogs,
  auditLogs,
  integrations,
  llmExecutionTraces,
  loreDocuments,
  organisationInvitations,
  organisations,
  productEvents,
  users,
  workflowRuns,
  workflows,
} from '../../db/schema.js';
import { hasConfiguredStripe } from '../../env.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { buildActivitySeries, countBy, countEventName } from './helpers.js';

const router = new Hono();

function getStripe() {
  if (!hasConfiguredStripe()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-09-30.acacia' });
}

async function buildBillingSnapshot({ organisations: orgs }) {
  const stripe = getStripe();
  if (!stripe) return { configured: false, invoices: [], subscriptions: [] };
  try {
    const [invoices, subscriptions] = await Promise.all([
      stripe.invoices.list({ limit: 12 }),
      stripe.subscriptions.list({ limit: 12, status: 'all' }),
    ]);
    const orgByCustomer = new Map(
      orgs.filter((org) => org.stripeCustomerId).map((org) => [org.stripeCustomerId, org]),
    );
    return {
      configured: true,
      invoices: invoices.data.map((invoice) => {
        const org = orgByCustomer.get(typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id);
        return {
          id: invoice.id, number: invoice.number, status: invoice.status,
          amountPaid: invoice.amount_paid, amountDue: invoice.amount_due,
          currency: invoice.currency, hostedInvoiceUrl: invoice.hosted_invoice_url,
          invoicePdf: invoice.invoice_pdf,
          createdAt: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
          orgId: org?.id ?? null, orgName: org?.name ?? null,
        };
      }),
      subscriptions: subscriptions.data.map((subscription) => {
        const org = orgByCustomer.get(typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id);
        return {
          id: subscription.id, status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          orgId: org?.id ?? null, orgName: org?.name ?? null,
        };
      }),
    };
  } catch (error) {
    return { configured: true, error: error.message, invoices: [], subscriptions: [] };
  }
}

router.get('/overview', requireStaff, requireStaffPermission('admin.view'), async (context) => {
  const [
    organisationRows, userRows, invitationRows, workflowRows, workflowRunRows,
    documentRows, integrationRows, auditRows, adminActionRows, eventRows, traceRows,
  ] = await Promise.all([
    db.query.organisations.findMany({ orderBy: [desc(organisations.createdAt)] }),
    db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
    db.query.organisationInvitations.findMany({ orderBy: [desc(organisationInvitations.createdAt)] }),
    db.query.workflows.findMany({ orderBy: [desc(workflows.updatedAt)] }),
    db.query.workflowRuns.findMany({ orderBy: [desc(workflowRuns.createdAt)] }),
    db.query.loreDocuments.findMany({ orderBy: [desc(loreDocuments.createdAt)] }),
    db.query.integrations.findMany({ orderBy: [desc(integrations.createdAt)] }),
    db.query.auditLogs.findMany({ orderBy: [desc(auditLogs.createdAt)] }),
    db.query.adminActionLogs.findMany({ orderBy: [desc(adminActionLogs.createdAt)] }),
    db.query.productEvents.findMany({ orderBy: [desc(productEvents.createdAt)] }),
    db.query.llmExecutionTraces.findMany({ orderBy: [desc(llmExecutionTraces.createdAt)] }),
  ]);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const usersByOrg = countBy(userRows, (row) => row.orgId);
  const invitesByOrg = countBy(invitationRows.filter((row) => row.status === 'pending'), (row) => row.orgId);
  const workflowsByOrg = countBy(workflowRows, (row) => row.orgId);
  const docsByOrg = countBy(documentRows, (row) => row.orgId);
  const indexedDocsByOrg = countBy(documentRows.filter((row) => row.status === 'indexed'), (row) => row.orgId);
  const integrationsByOrg = countBy(integrationRows.filter((row) => row.isActive), (row) => row.orgId);
  const runsByOrg = countBy(workflowRunRows, (row) => row.orgId);
  const activeUsers7d = userRows.filter((row) => row.lastSeenAt && row.lastSeenAt >= sevenDaysAgo).length;
  const runs24h = workflowRunRows.filter((row) => row.createdAt >= twentyFourHoursAgo).length;

  const planDistribution = ['free', 'solo', 'pro', 'teams', 'agency'].map((planId) => ({
    plan: planId,
    count: organisationRows.filter((row) => row.plan === planId).length,
  }));

  const activitySeries = buildActivitySeries({ auditRows, eventRows, days: 10 });
  const onboardingCount30d = countEventName(eventRows, 'onboarding.completed', thirtyDaysAgo);
  const usefulOutput30d = countEventName(eventRows, 'activation.useful_output', thirtyDaysAgo);
  const invitationSent30d = countEventName(eventRows, 'team.invitation.sent', thirtyDaysAgo);
  const seatActivation30d = countEventName(eventRows, 'team.member.joined', thirtyDaysAgo);
  const traceFailures30d = traceRows.filter((row) => row.outcomeStatus === 'failed' && row.createdAt >= thirtyDaysAgo).length;
  const totalModelCostUsd30d = traceRows.filter((row) => row.createdAt >= thirtyDaysAgo).reduce((sum, row) => sum + (row.estimatedCostUsd ?? 0), 0);

  const organisationMap = new Map(organisationRows.map((org) => [org.id, org]));

  const organisationHealth = organisationRows.map((org) => ({
    id: org.id, name: org.name, slug: org.slug, plan: org.plan,
    creditsUsed: org.creditsUsed, monthlyCreditLimit: org.monthlyCreditLimit, seatLimit: org.seatLimit,
    memberCount: usersByOrg.get(org.id) ?? 0, pendingInvites: invitesByOrg.get(org.id) ?? 0,
    workflowCount: workflowsByOrg.get(org.id) ?? 0, runCount: runsByOrg.get(org.id) ?? 0,
    documentCount: docsByOrg.get(org.id) ?? 0, indexedDocumentCount: indexedDocsByOrg.get(org.id) ?? 0,
    integrationCount: integrationsByOrg.get(org.id) ?? 0,
    createdAt: org.createdAt, updatedAt: org.updatedAt,
  }));

  const usersView = userRows.map((user) => {
    const org = user.orgId ? organisationMap.get(user.orgId) : null;
    return {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role, orgId: user.orgId, orgName: org?.name ?? null, orgPlan: org?.plan ?? null,
      avatarUrl: user.avatarUrl, lastSeenAt: user.lastSeenAt,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    };
  });

  const workflowMap = new Map(workflowRows.map((workflow) => [workflow.id, workflow]));
  const recentRuns = workflowRunRows.slice(0, 14).map((run) => {
    const workflow = workflowMap.get(run.workflowId);
    const org = organisationMap.get(run.orgId);
    return {
      id: run.id, status: run.status, workflowId: run.workflowId,
      workflowName: workflow?.name ?? 'Unknown workflow',
      orgId: run.orgId, orgName: org?.name ?? 'Unknown organisation',
      creditsUsed: run.creditsUsed, startedAt: run.startedAt,
      completedAt: run.completedAt, createdAt: run.createdAt, errorLog: run.errorLog,
    };
  });

  const documentQueue = documentRows
    .filter((doc) => doc.status !== 'indexed')
    .slice(0, 14)
    .map((doc) => ({
      id: doc.id, title: doc.title, status: doc.status, sourceType: doc.sourceType,
      orgId: doc.orgId, orgName: organisationMap.get(doc.orgId)?.name ?? 'Unknown organisation',
      createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    }));

  const billing = await buildBillingSnapshot({ organisations: organisationRows });

  const recentActivity = [
    ...adminActionRows.slice(0, 20).map((entry) => ({
      id: `admin-${entry.id}`, kind: 'admin', label: entry.action,
      meta: { ...entry.metadata, permission: entry.permission, reasonCode: entry.reasonCode, reason: entry.reason, staffRole: entry.actorStaffRole },
      actorUserId: entry.actorUserId, targetType: entry.targetType, targetId: entry.targetId, createdAt: entry.createdAt,
    })),
    ...auditRows.slice(0, 20).map((entry) => ({
      id: `audit-${entry.id}`, kind: 'audit', label: entry.action,
      meta: entry.metadata ?? {}, actorUserId: entry.actorUserId,
      targetType: entry.targetType, targetId: entry.targetId, createdAt: entry.createdAt,
    })),
    ...eventRows.slice(0, 20).map((entry) => ({
      id: `event-${entry.id}`, kind: 'event', label: entry.eventName,
      meta: entry.metadata ?? {}, actorUserId: entry.userId,
      targetType: null, targetId: null, createdAt: entry.createdAt,
    })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 16);

  return context.json({
    summary: {
      organisations: organisationRows.length, users: userRows.length, activeUsers7d,
      workflows: workflowRows.length, workflowRuns24h: runs24h,
      documentsIndexed: documentRows.filter((row) => row.status === 'indexed').length,
      openInvites: invitationRows.filter((row) => row.status === 'pending').length,
      activeIntegrations: integrationRows.filter((row) => row.isActive).length,
      totalCreditsUsed: organisationRows.reduce((sum, row) => sum + (row.creditsUsed ?? 0), 0),
      llmRuns: traceRows.length, adminActions: adminActionRows.length,
    },
    lifecycle: {
      onboardingCompleted30d: onboardingCount30d, usefulOutputs30d: usefulOutput30d,
      invitationsSent30d: invitationSent30d, seatActivations30d: seatActivation30d,
      traceFailures30d, totalModelCostUsd30d: Number(totalModelCostUsd30d.toFixed(4)),
    },
    pipeline: {
      docsPending: documentRows.filter((row) => row.status === 'pending' || row.status === 'indexing').length,
      workflowRunsQueued: workflowRunRows.filter((row) => row.status === 'queued' || row.status === 'running').length,
      integrationsOffline: integrationRows.filter((row) => !row.isActive).length,
      failedRuns: workflowRunRows.filter((row) => row.status === 'failed').length,
    },
    planDistribution, activitySeries, organisations: organisationHealth,
    users: usersView, recentRuns, documentQueue, billing, recentActivity,
  });
});

export default router;
