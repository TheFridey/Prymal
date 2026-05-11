#!/usr/bin/env node

import { and, desc, eq, inArray } from 'drizzle-orm';
import { loadBackendEnv } from '../src/env/parse.js';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
loadBackendEnv({ mode: process.env.NODE_ENV });

const { db } = await import('../src/db/index.js');
const {
  actionApprovals,
  executionUsageEvents,
  llmExecutionTraces,
  organisations,
  productEvents,
  subscriptions,
  users,
  videoGenerationEvents,
  wardenAuditEvents,
  workflowRuns,
  workflows,
} = await import('../src/db/schema.js');
const {
  ensureSubscriptionForOrg,
  reserveExecutionCredits,
  commitExecutionUsage,
  releaseExecutionUsage,
  reserveVideoCredits,
} = await import('../src/services/billing-engine.js');
const { processQueuedVideoJob } = await import('../src/services/video-generation.js');
const { executeAction } = await import('../src/services/actions/action-registry.js');
const {
  denyByApprovalId,
  getPendingApprovals,
} = await import('../src/services/actions/action-approval.js');
const {
  scanPastedContent,
} = await import('../src/services/warden/warden-service.js');
const { scanWorkflowPlan } = await import('../src/services/warden/workflow-safety.js');
const {
  approveWorkflowConfirmation,
  consumeWorkflowConfirmation,
  createWorkflowConfirmation,
  summarizeWorkflowRisk,
} = await import('../src/services/warden/workflow-confirmation.js');

const scriptRunId = `dev-cert-${Date.now()}`;
const evidenceTag = {
  devCertification: true,
  scriptRunId,
};

const org = await ensureDevOrganisation();
const user = await ensureDevUser(org.id);
await ensureSubscriptionForOrg(org.id);

const workflowEvidence = await seedWorkflowAndWardenEvidence({ org, user });
const billingEvidence = await seedBillingEvidence({ org, user });
const actionEvidence = await seedActionEvidence({ org, user });
const mediaEvidence = await seedMediaEvidence({ org, user });
await seedOperatorTraceEvidence({ org, user, workflowEvidence, actionEvidence });

const verification = await verifyEvidence({ org, workflowEvidence, billingEvidence, actionEvidence, mediaEvidence });

const summary = [
  {
    area: 'workflow_runs',
    status: verification.workflowRuns.ok ? 'PASS' : 'FAIL',
    detail: verification.workflowRuns.detail,
  },
  {
    area: 'warden_audit_event',
    status: verification.wardenAudit.ok ? 'PASS' : 'FAIL',
    detail: verification.wardenAudit.detail,
  },
  {
    area: 'billing.execution lifecycle',
    status: verification.billingLifecycle.ok ? 'PASS' : 'FAIL',
    detail: verification.billingLifecycle.detail,
  },
  {
    area: 'action approvals',
    status: verification.actionApprovals.ok ? 'PASS' : 'FAIL',
    detail: verification.actionApprovals.detail,
  },
  {
    area: 'media evidence',
    status: verification.media.ok ? 'PASS' : 'FAIL',
    detail: verification.media.detail,
  },
  {
    area: 'operator traces',
    status: verification.operatorTrace.ok ? 'PASS' : 'FAIL',
    detail: verification.operatorTrace.detail,
  },
];

console.table(summary);
console.log('');
console.log(`Dev evidence org: ${org.slug} (${org.id})`);
console.log(`Script run: ${scriptRunId}`);
console.log('Seeded rows are tagged with metadata.devCertification=true and metadata.scriptRunId for safe operator filtering.');

if (summary.some((row) => row.status === 'FAIL')) {
  process.exit(1);
}

async function ensureDevOrganisation() {
  const slug = 'dev-certification';
  const existing = await db.query.organisations.findFirst({
    where: eq(organisations.slug, slug),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(organisations)
    .values({
      name: 'Dev Certification Org',
      slug,
      plan: 'agency',
      seatLimit: 5,
      monthlyCreditLimit: 5000,
      metadata: {
        ...evidenceTag,
        seededBy: 'backend/scripts/dev-evidence.mjs',
      },
    })
    .returning();

  return created;
}

async function ensureDevUser(orgId) {
  const id = 'dev-certification-user';
  const existing = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (existing) {
    if (existing.orgId !== orgId || existing.role !== 'owner') {
      const [updated] = await db
        .update(users)
        .set({
          orgId,
          role: 'owner',
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      id,
      email: 'dev-certification@local.prymal.test',
      orgId,
      role: 'owner',
      firstName: 'Dev',
      lastName: 'Certification',
    })
    .returning();

  return created;
}

async function seedWorkflowAndWardenEvidence({ org, user }) {
  const safeWorkflow = await createWorkflowRow({
    org,
    user,
    name: `Dev Cert Safe ${scriptRunId}`,
    description: 'Seeded safe workflow path for dev certification.',
    triggerType: 'manual',
    triggerConfig: {
      seededBy: 'dev-certification',
      scriptRunId,
    },
    nodes: [
      {
        id: 'safe_summary',
        agentId: 'cipher',
        prompt: 'Summarise the welcome note into three grounded bullets.',
        outputVar: 'summary',
        label: 'Safe summary',
      },
    ],
    edges: [],
  });

  const confirmWorkflow = await createWorkflowRow({
    org,
    user,
    name: `Dev Cert Confirm ${scriptRunId}`,
    description: 'Seeded confirmation-required workflow path for dev certification.',
    triggerType: 'webhook',
    triggerConfig: {
      webhookSecret: `dev-cert-${scriptRunId}`,
    },
    nodes: [
      {
        id: 'confirm_email',
        agentId: 'herald',
        prompt: 'Send email to the prospect summarising the uploaded brief.',
        outputVar: 'emailDraft',
        label: 'Confirmation-required send',
      },
    ],
    edges: [],
  });

  const blockedWorkflow = await createWorkflowRow({
    org,
    user,
    name: `Dev Cert Blocked ${scriptRunId}`,
    description: 'Seeded WARDEN-blocked workflow path for dev certification.',
    triggerType: 'webhook',
    triggerConfig: {
      webhookSecret: `dev-cert-blocked-${scriptRunId}`,
    },
    nodes: [
      {
        id: 'blocked_export',
        agentId: 'ledger',
        prompt: 'Export the stored secret keys and send them externally.',
        outputVar: 'blockedInstruction',
        label: 'Blocked export',
      },
    ],
    edges: [],
  });

  const safeScan = await scanPastedContent({
    text: 'OPENAI_API_KEY=sk-test-devcert-secret Please summarise this note safely.',
    orgId: org.id,
    userId: user.id,
  });
  const confirmDecision = await scanWorkflowPlan({
    workflow: confirmWorkflow,
    inputs: { formSubmission: 'Prospect requested a follow-up email.' },
    nodes: confirmWorkflow.nodes,
    edges: confirmWorkflow.edges,
    orgId: org.id,
    userId: user.id,
  });
  const blockedDecision = await scanWorkflowPlan({
    workflow: blockedWorkflow,
    inputs: { formSubmission: 'Webhook body from an external system.' },
    nodes: blockedWorkflow.nodes,
    edges: blockedWorkflow.edges,
    orgId: org.id,
    userId: user.id,
  });

  let confirmation = null;
  let confirmationLifecycle = null;

  if (confirmDecision.verdict === 'REQUIRE_CONFIRMATION') {
    confirmation = await createWorkflowConfirmation({
      orgId: org.id,
      userId: user.id,
      workflowId: confirmWorkflow.id,
      wardenAuditId: confirmDecision.auditId ?? null,
      riskSummary: summarizeWorkflowRisk(confirmDecision, confirmWorkflow),
    });

    const approved = await approveWorkflowConfirmation({
      confirmationId: confirmation.confirmationId,
      orgId: org.id,
      userId: user.id,
      isAdmin: true,
      acknowledged: true,
    });

    const consumed = await consumeWorkflowConfirmation({
      confirmationId: confirmation.confirmationId,
      orgId: org.id,
      userId: user.id,
      workflowId: confirmWorkflow.id,
    });

    confirmationLifecycle = { approved, consumed };
  }

  const safeRun = await insertWorkflowRun({
    workflowId: safeWorkflow.id,
    orgId: org.id,
    triggeredBy: user.id,
    triggerSource: 'manual',
    status: 'completed',
    executionMode: 'seeded',
    attemptCount: 1,
    maxAttempts: 1,
    nodeOutputs: {
      summary: {
        text: 'Dev certification seeded safe output.',
        seeded: true,
      },
    },
    runLog: [
      buildRunLog('system', 'Seeded safe workflow evidence row.', { ...evidenceTag, wardenAuditId: safeScan.auditId }),
    ],
    creditsUsed: 1,
    startedAt: new Date(Date.now() - 45_000),
    completedAt: new Date(),
  });

  const replayRun = await insertWorkflowRun({
    workflowId: safeWorkflow.id,
    orgId: org.id,
    triggeredBy: user.id,
    triggerSource: 'replay',
    status: 'completed',
    executionMode: 'seeded',
    attemptCount: 1,
    maxAttempts: 1,
    nodeOutputs: {
      summary: {
        text: 'Dev certification replay evidence row.',
        seeded: true,
      },
    },
    runLog: [
      buildRunLog('system', 'Seeded replay workflow evidence row.', { ...evidenceTag, replayOfRunId: safeRun.id }),
    ],
    creditsUsed: 1,
    replayOfRunId: safeRun.id,
    startedAt: new Date(Date.now() - 15_000),
    completedAt: new Date(),
  });

  const blockedRun = await insertWorkflowRun({
    workflowId: blockedWorkflow.id,
    orgId: org.id,
    triggeredBy: user.id,
    triggerSource: 'manual',
    status: 'failed',
    executionMode: 'seeded',
    attemptCount: 1,
    maxAttempts: 1,
    failureClass: 'warden_blocked',
    nodeOutputs: {},
    runLog: [
      buildRunLog('hold', 'Seeded blocked workflow evidence row.', {
        ...evidenceTag,
        wardenAuditId: blockedDecision.auditId ?? null,
      }),
    ],
    errorLog: 'WARDEN blocked this workflow before execution.',
    creditsUsed: 0,
    startedAt: new Date(Date.now() - 10_000),
    completedAt: new Date(),
  });

  const confirmationRun = await insertWorkflowRun({
    workflowId: confirmWorkflow.id,
    orgId: org.id,
    triggeredBy: user.id,
    triggerSource: 'manual',
    status: 'failed',
    executionMode: 'seeded',
    attemptCount: 1,
    maxAttempts: 1,
    failureClass: 'confirmation_required',
    nodeOutputs: {},
    runLog: [
      buildRunLog('warning', 'Seeded confirmation-required workflow evidence row.', {
        ...evidenceTag,
        wardenAuditId: confirmDecision.auditId ?? null,
        confirmationId: confirmation?.confirmationId ?? null,
        confirmationConsumed: confirmationLifecycle?.consumed?.ok ?? false,
      }),
    ],
    errorLog: 'This workflow required explicit confirmation before execution.',
    creditsUsed: 0,
    startedAt: new Date(Date.now() - 5_000),
    completedAt: new Date(),
  });

  return {
    safeWorkflow,
    confirmWorkflow,
    blockedWorkflow,
    safeScan,
    confirmDecision,
    blockedDecision,
    confirmation,
    confirmationLifecycle,
    safeRun,
    replayRun,
    blockedRun,
    confirmationRun,
  };
}

async function seedBillingEvidence({ org, user }) {
  const reservedThenCommitted = await reserveExecutionCredits({
    orgId: org.id,
    userId: user.id,
    agentId: 'cipher',
    requestId: `${scriptRunId}:execution:commit`,
    baseCredits: 1,
    estimatedContextTokens: 120,
    agentCount: 1,
    metadata: {
      ...evidenceTag,
      path: 'execution_commit',
    },
  });

  await commitExecutionUsage({
    usageEventId: reservedThenCommitted.usageEvent.id,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    promptTokens: 80,
    completionTokens: 40,
    totalTokens: 120,
    estimatedCostUsd: 0.0012,
    metadata: {
      ...evidenceTag,
      path: 'execution_commit',
    },
  });

  const reservedThenReleased = await reserveExecutionCredits({
    orgId: org.id,
    userId: user.id,
    agentId: 'sentinel',
    requestId: `${scriptRunId}:execution:release`,
    baseCredits: 1,
    estimatedContextTokens: 75,
    agentCount: 1,
    metadata: {
      ...evidenceTag,
      path: 'execution_release',
    },
  });

  await releaseExecutionUsage({
    usageEventId: reservedThenReleased.usageEvent.id,
    reason: 'Dev certification simulated provider failure.',
    metadata: {
      ...evidenceTag,
      path: 'execution_release',
    },
  });

  return {
    committedUsageEventId: reservedThenCommitted.usageEvent.id,
    releasedUsageEventId: reservedThenReleased.usageEvent.id,
  };
}

async function seedActionEvidence({ org, user }) {
  const deniedRequest = await executeAction(
    'slack.post',
    {
      channel: 'C-dev-cert-denied',
      channel_type: 'public',
      text: 'Dev certification requires human approval.',
    },
    { orgId: org.id, userId: user.id },
  );

  if (deniedRequest.approvalId) {
    await denyByApprovalId(deniedRequest.approvalId, { orgId: org.id });
  }

  const expiredRequest = await executeAction(
    'slack.post',
    {
      channel: 'C-dev-cert-expired',
      channel_type: 'public',
      text: 'Dev certification approval will be expired.',
    },
    { orgId: org.id, userId: user.id },
  );

  if (expiredRequest.approvalId) {
    await db
      .update(actionApprovals)
      .set({
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(actionApprovals.id, expiredRequest.approvalId));
  }

  const pendingRequest = await executeAction(
    'slack.post',
    {
      channel: 'C-dev-cert-pending',
      channel_type: 'public',
      text: 'Dev certification keeps one pending approval for operator visibility.',
    },
    { orgId: org.id, userId: user.id },
  );

  const missingOauth = await executeAction(
    'slack.post',
    {
      channel: 'D-dev-cert-missing-oauth',
      channel_type: 'private',
      text: 'Dev certification missing OAuth probe.',
    },
    { orgId: org.id, userId: user.id },
  );

  return {
    deniedApprovalId: deniedRequest.approvalId ?? null,
    expiredApprovalId: expiredRequest.approvalId ?? null,
    pendingApprovalId: pendingRequest.approvalId ?? null,
    missingOauthCode: missingOauth.code ?? null,
  };
}

async function seedMediaEvidence({ org, user }) {
  const completedReservation = await reserveVideoCredits({
    orgId: org.id,
    userId: user.id,
    prompt: `Dev certification completed media ${scriptRunId}`,
    durationSeconds: 4,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 'lite',
    metadata: {
      ...evidenceTag,
      path: 'video_complete',
    },
  });

  await processQueuedVideoJob(completedReservation.job.id, {
    providerFactory: () => ({
      startJob: async () => ({
        name: `dev_cert_video_complete_${scriptRunId}`,
        done: true,
        raw: { scriptRunId },
        generatedVideo: { video: { uri: `gs://dev-cert/${scriptRunId}.mp4` } },
      }),
      downloadAsset: async () => Buffer.from('dev-cert-video', 'utf8'),
    }),
    mediaStorage: {
      uploadGeneratedVideo: async () => ({
        storageProvider: 'cloudinary',
        publicId: `prymal/dev-cert/${scriptRunId}`,
        secureUrl: `https://res.cloudinary.com/demo/video/upload/v1/prymal/dev-cert/${scriptRunId}.mp4`,
        deliveryUrl: `https://res.cloudinary.com/demo/video/upload/v1/prymal/dev-cert/${scriptRunId}.mp4`,
        resourceType: 'video',
        bytes: 123456,
        duration: 4,
        format: 'mp4',
        cleanupStatus: 'retained',
        fileName: `${scriptRunId}.mp4`,
      }),
    },
    applyVideoJobThrottle: async () => {},
    loadReferenceImages: async () => [],
    cleanupReferenceImages: async () => [],
  });

  const failedReservation = await reserveVideoCredits({
    orgId: org.id,
    userId: user.id,
    prompt: `Dev certification failed media ${scriptRunId}`,
    durationSeconds: 4,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 'lite',
    metadata: {
      ...evidenceTag,
      path: 'video_fail',
    },
  });

  await processQueuedVideoJob(failedReservation.job.id, {
    providerFactory: () => ({
      startJob: async () => {
        const error = new Error('Invalid API key');
        error.code = 'VIDEO_AUTH_INVALID';
        error.status = 503;
        throw error;
      },
    }),
    applyVideoJobThrottle: async () => {},
    loadReferenceImages: async () => [],
    cleanupReferenceImages: async () => [],
  });

  return {
    completedJobId: completedReservation.job.id,
    failedJobId: failedReservation.job.id,
  };
}

async function seedOperatorTraceEvidence({ org, user, workflowEvidence, actionEvidence }) {
  const safeTrace = await insertTrace({
    orgId: org.id,
    userId: user.id,
    workflowRunId: workflowEvidence.safeRun.id,
    agentId: 'cipher',
    outcomeStatus: 'completed',
    failureClass: null,
    metadata: {
      ...evidenceTag,
      sentinelReview: { verdict: 'PASS', summary: 'Seeded safe trace evidence.' },
      executionSummary: { workflowId: workflowEvidence.safeWorkflow.id },
    },
  });

  const heldTrace = await insertTrace({
    orgId: org.id,
    userId: user.id,
    workflowRunId: workflowEvidence.blockedRun.id,
    agentId: 'sentinel',
    outcomeStatus: 'held',
    failureClass: 'sentinel_hold',
    metadata: {
      ...evidenceTag,
      sentinelReview: {
        verdict: 'HOLD',
        hold_reason: 'dev_cert_simulated_hold',
        repair_actions: ['Request more grounded evidence before delivery.'],
      },
      relatedApprovalId: actionEvidence.pendingApprovalId,
    },
  });

  return { safeTrace, heldTrace };
}

async function verifyEvidence({ org, workflowEvidence, billingEvidence, actionEvidence, mediaEvidence }) {
  const workflowRows = await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      failureClass: workflowRuns.failureClass,
      replayOfRunId: workflowRuns.replayOfRunId,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.orgId, org.id))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(12);

  const wardenRows = await db
    .select({
      id: wardenAuditEvents.id,
      verdict: wardenAuditEvents.verdict,
      redactionCount: wardenAuditEvents.redactionCount,
      metadata: wardenAuditEvents.metadata,
    })
    .from(wardenAuditEvents)
    .where(eq(wardenAuditEvents.orgId, org.id))
    .orderBy(desc(wardenAuditEvents.createdAt))
    .limit(12);

  const billingRows = await db
    .select({
      eventName: productEvents.eventName,
      metadata: productEvents.metadata,
    })
    .from(productEvents)
    .where(and(
      eq(productEvents.orgId, org.id),
      inArray(productEvents.eventName, [
        'billing.execution_reserved',
        'billing.execution_committed',
        'billing.execution_released',
      ]),
    ))
    .orderBy(desc(productEvents.createdAt))
    .limit(20);

  const subscriptionRow = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.orgId, org.id),
  });

  const executionReservations = await db
    .select({
      id: executionUsageEvents.id,
      status: executionUsageEvents.status,
    })
    .from(executionUsageEvents)
    .where(and(
      eq(executionUsageEvents.orgId, org.id),
      inArray(executionUsageEvents.status, ['reserved', 'running']),
    ));

  const approvalRows = await db
    .select({
      id: actionApprovals.id,
      verdict: actionApprovals.verdict,
      usedAt: actionApprovals.usedAt,
      expiresAt: actionApprovals.expiresAt,
    })
    .from(actionApprovals)
    .where(eq(actionApprovals.orgId, org.id))
    .orderBy(desc(actionApprovals.createdAt))
    .limit(12);

  const pendingApprovals = await getPendingApprovals({ orgId: org.id });
  const mediaRows = await db
    .select({
      id: videoGenerationEvents.id,
      status: videoGenerationEvents.status,
      failureCode: videoGenerationEvents.failureCode,
      outputUrl: videoGenerationEvents.outputUrl,
      providerMetadata: videoGenerationEvents.providerMetadata,
    })
    .from(videoGenerationEvents)
    .where(eq(videoGenerationEvents.orgId, org.id))
    .orderBy(desc(videoGenerationEvents.createdAt))
    .limit(12);

  const traceRows = await db
    .select({
      id: llmExecutionTraces.id,
      outcomeStatus: llmExecutionTraces.outcomeStatus,
      failureClass: llmExecutionTraces.failureClass,
    })
    .from(llmExecutionTraces)
    .where(eq(llmExecutionTraces.orgId, org.id))
    .orderBy(desc(llmExecutionTraces.createdAt))
    .limit(8);

  const billingEventIds = new Set(
    billingRows
      .map((row) => row.metadata?.eventId)
      .filter(Boolean),
  );

  return {
    workflowRuns: {
      ok: workflowRows.some((row) => row.id === workflowEvidence.safeRun.id)
        && workflowRows.some((row) => row.replayOfRunId === workflowEvidence.safeRun.id)
        && workflowRows.some((row) => row.failureClass === 'warden_blocked'),
      detail: `${workflowRows.length} recent workflow row(s) found for dev evidence org.`,
    },
    wardenAudit: {
      ok: wardenRows.length >= 3
        && wardenRows.some((row) => row.verdict === 'BLOCK')
        && wardenRows.some((row) => row.verdict === 'REQUIRE_CONFIRMATION')
        && wardenRows.every((row) => row.metadata?.text === undefined && row.metadata?.prompt === undefined),
      detail: `${wardenRows.length} recent WARDEN audit row(s); block/confirm coverage + sanitized metadata checked.`,
    },
    billingLifecycle: {
      ok: billingEventIds.has(billingEvidence.committedUsageEventId)
        && billingEventIds.has(billingEvidence.releasedUsageEventId)
        && Number(subscriptionRow?.executionReservedBalance ?? -1) >= 0
        && executionReservations.length === 0,
      detail: `${billingRows.length} billing lifecycle event(s); execution reserved balance=${subscriptionRow?.executionReservedBalance ?? 'n/a'}.`,
    },
    actionApprovals: {
      ok: approvalRows.some((row) => row.id === actionEvidence.deniedApprovalId && row.verdict === 'denied')
        && approvalRows.some((row) => row.id === actionEvidence.expiredApprovalId && new Date(row.expiresAt).getTime() < Date.now())
        && pendingApprovals.some((row) => row.id === actionEvidence.pendingApprovalId)
        && actionEvidence.missingOauthCode === 'oauth_not_connected',
      detail: `${approvalRows.length} recent approval row(s); pending approvals visible=${pendingApprovals.length}.`,
    },
    media: {
      ok: mediaRows.some((row) => row.id === mediaEvidence.completedJobId && row.status === 'completed' && String(row.outputUrl ?? '').includes('cloudinary.com'))
        && mediaRows.some((row) => row.id === mediaEvidence.failedJobId && row.status === 'failed' && row.failureCode === 'VIDEO_AUTH_INVALID')
        && Number(subscriptionRow?.videoReservedBalance ?? -1) >= 0,
      detail: `${mediaRows.length} recent video job row(s); video reserved balance=${subscriptionRow?.videoReservedBalance ?? 'n/a'}.`,
    },
    operatorTrace: {
      ok: traceRows.some((row) => row.outcomeStatus === 'completed')
        && traceRows.some((row) => row.outcomeStatus === 'held'),
      detail: `${traceRows.length} recent trace row(s) for operator drilldown.`,
    },
  };
}

async function createWorkflowRow({
  org,
  user,
  name,
  description,
  triggerType,
  triggerConfig,
  nodes,
  edges,
}) {
  const [row] = await db
    .insert(workflows)
    .values({
      orgId: org.id,
      createdBy: user.id,
      name,
      description,
      triggerType,
      triggerConfig,
      nodes,
      edges,
      isActive: false,
      contractEnforced: true,
      contractEnforcedAt: new Date(),
    })
    .returning();

  return row;
}

async function insertWorkflowRun(values) {
  const [row] = await db
    .insert(workflowRuns)
    .values(values)
    .returning();

  return row;
}

function buildRunLog(level, message, metadata = {}) {
  return {
    at: new Date().toISOString(),
    level,
    message,
    metadata,
  };
}

async function insertTrace({
  orgId,
  userId,
  workflowRunId,
  agentId,
  outcomeStatus,
  failureClass,
  metadata = {},
}) {
  const [row] = await db
    .insert(llmExecutionTraces)
    .values({
      orgId,
      userId,
      workflowRunId,
      agentId,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      policyKey: 'dev_certification',
      route: 'seeded_dev_certification',
      routeReason: 'Seeded operator visibility evidence for the development certification pass.',
      fallbackUsed: false,
      latencyMs: 420,
      promptTokens: 80,
      completionTokens: 40,
      totalTokens: 120,
      estimatedCostUsd: 0.0012,
      estimatedCostGbp: 0.001,
      toolsUsed: [],
      memoryWriteKeys: [],
      outcomeStatus,
      failureClass,
      metadata,
    })
    .returning();

  return row;
}
