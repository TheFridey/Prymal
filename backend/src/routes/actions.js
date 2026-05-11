/**
 * Action runtime routes.
 * Plan gate: Pro/Teams/Agency only.
 * All payloads pass through WARDEN before action-registry dispatch.
 */
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireOrg } from '../middleware/auth.js';
import { executeAction, getSupportedActionTypes, isKnownActionType } from '../services/actions/action-registry.js';
import {
  getPendingApprovals,
  validateAndConsume,
  denyApproval,
  consumeByApprovalId,
  denyByApprovalId,
} from '../services/actions/action-approval.js';
import { scanPastedContent, WARDEN_VERDICTS } from '../services/warden/index.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';

const router = new Hono();

const ACTION_PLANS = new Set(['pro', 'teams', 'agency']);

const executeSchema = z.object({
  type: z.string().min(1).max(120),
  payload: z.record(z.unknown()),
  workflowId: z.string().uuid().optional(),
  nodeId: z.string().max(120).optional(),
  approvalToken: z.string().optional(),
});

// ── GET /types ──────────────────────────────────────────────────────────────

router.get('/types', requireOrg, (context) => {
  return context.json({ types: getSupportedActionTypes() });
});

// ── POST /execute ───────────────────────────────────────────────────────────

router.post('/execute', requireOrg, zValidator('json', executeSchema), async (context) => {
  const org = context.get('org');

  if (!ACTION_PLANS.has(org.orgPlan)) {
    return context.json({
      error: 'Action runtime is available on Pro, Teams, and Agency plans.',
      code: 'plan_upgrade_required',
      requiredPlan: 'pro',
    }, 403);
  }

  const { type, payload, workflowId, nodeId, approvalToken } = context.req.valid('json');

  if (!isKnownActionType(type)) {
    return context.json({
      error: `Unknown action type: ${type}. Supported types: ${getSupportedActionTypes().join(', ')}`,
      code: 'UNKNOWN_ACTION_TYPE',
    }, 400);
  }

  // WARDEN: scan text fields in payload before execution
  const payloadText = extractPayloadText(payload);
  if (payloadText) {
    const wardenResult = await scanPastedContent({
      text: payloadText,
      orgId: org.orgId,
      userId: org.userId,
    }).catch(() => null);

    if (wardenResult?.verdict === WARDEN_VERDICTS.BLOCK) {
      await recordAuditLog({
        orgId: org.orgId,
        userId: org.userId,
        action: 'action_blocked_by_warden',
        metadata: { type, wardenVerdict: wardenResult.verdict },
      }).catch(() => {});

      return context.json({
        success: false,
        error: 'Action payload was blocked by the WARDEN safety system.',
        code: 'WARDEN_BLOCK',
        blocked: true,
        wardenVerdict: wardenResult.verdict,
      }, 422);
    }
  }

  const actionContext = {
    orgId: org.orgId,
    userId: org.userId,
    workflowId,
    nodeId,
    plan: org.orgPlan,
    approvalToken,
  };

  const actionResult = await executeAction(type, payload, actionContext);

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'action_execute_attempt',
    metadata: {
      actionType: type,
      workflowId,
      success: actionResult.success,
      awaitingApproval: actionResult.awaitingApproval ?? false,
      traceId: actionResult.traceId,
    },
  }).catch(() => {});

  if (actionResult.awaitingApproval) {
    return context.json({
      success: false,
      awaitingApproval: true,
      approvalId: actionResult.approvalId,
      approvalToken: actionResult.approvalToken,
      policyId: actionResult.policyId,
      risk: actionResult.risk,
      traceId: actionResult.traceId,
    }, 202);
  }

  if (actionResult.blocked) {
    return context.json({
      success: false,
      blocked: true,
      error: actionResult.error,
      code: actionResult.code,
      policyId: actionResult.policyId,
      risk: actionResult.risk,
      traceId: actionResult.traceId,
    }, 403);
  }

  if (!actionResult.success) {
    const status = actionResult.code === 'oauth_token_expired' ? 401
      : actionResult.code === 'oauth_not_connected' ? 402
      : actionResult.code === 'approval_token_invalid' ? 400
      : 500;

    return context.json({
      success: false,
      error: actionResult.error,
      code: actionResult.code,
      requiresReauth: actionResult.requiresReauth ?? false,
      integration: actionResult.integration,
      traceId: actionResult.traceId,
    }, status);
  }

  return context.json({
    success: true,
    result: actionResult.result,
    traceId: actionResult.traceId,
    wardenVerdict: actionResult.wardenVerdict,
    durationMs: actionResult.durationMs,
  });
});

// ── GET /approvals ──────────────────────────────────────────────────────────

router.get('/approvals', requireOrg, async (context) => {
  const org = context.get('org');

  if (!ACTION_PLANS.has(org.orgPlan)) {
    return context.json({ approvals: [] });
  }

  const approvals = await getPendingApprovals({ orgId: org.orgId });
  return context.json({ approvals });
});

// ── POST /approvals/:id/approve ─────────────────────────────────────────────

router.post('/approvals/:id/approve', requireOrg, async (context) => {
  const org = context.get('org');
  const body = await context.req.json().catch(() => ({}));
  const token = body?.token;

  if (!token) {
    return context.json({ success: false, reason: 'token_required' }, 400);
  }

  const validation = await validateAndConsume(token, { orgId: org.orgId });

  if (!validation.valid) {
    return context.json({ success: false, reason: validation.reason }, 400);
  }

  // Re-execute the approved action
  const actionContext = {
    orgId: org.orgId,
    userId: org.userId,
    approvalToken: token,
    plan: org.orgPlan,
  };

  const actionResult = await executeAction(validation.actionType, validation.payload, actionContext);

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'action_approval_executed',
    metadata: {
      actionType: validation.actionType,
      approvalId: context.req.param('id'),
      success: actionResult.success,
    },
  }).catch(() => {});

  return context.json({
    success: actionResult.success,
    result: actionResult.result,
    traceId: actionResult.traceId,
  });
});

// ── POST /approvals/:id/deny ────────────────────────────────────────────────

router.post('/approvals/:id/deny', requireOrg, async (context) => {
  const org = context.get('org');
  const body = await context.req.json().catch(() => ({}));
  const token = body?.token;

  if (!token) {
    return context.json({ denied: false, reason: 'token_required' }, 400);
  }

  await denyApproval(token, { orgId: org.orgId });

  await recordAuditLog({
    orgId: org.orgId,
    userId: org.userId,
    action: 'action_approval_denied',
    metadata: { approvalId: context.req.param('id') },
  }).catch(() => {});

  return context.json({ denied: true });
});

// ── POST /approvals/:id/approve-inline ─────────────────────────────────────
// In-app approval — authenticated org member approves without the HMAC token.

router.post('/approvals/:id/approve-inline', requireOrg, async (context) => {
  const org = context.get('org');
  const approvalId = context.req.param('id');

  if (!ACTION_PLANS.has(org.orgPlan)) {
    return context.json({ success: false, reason: 'plan_upgrade_required' }, 403);
  }

  const validation = await consumeByApprovalId(approvalId, { orgId: org.orgId });

  if (!validation.valid) {
    return context.json({ success: false, reason: validation.reason }, 400);
  }

  const actionContext = {
    orgId: org.orgId,
    userId: org.userId,
    workflowId: validation.workflowId,
    nodeId: validation.nodeId,
    plan: org.orgPlan,
  };

  const actionResult = await executeAction(validation.actionType, validation.payload, actionContext);

  await recordProductEvent({
    orgId: org.orgId,
    userId: org.userId,
    eventName: 'action_approval_executed',
    metadata: {
      actionType: validation.actionType,
      approvalId,
      success: actionResult.success,
      inline: true,
    },
  }).catch(() => {});

  return context.json({
    success: actionResult.success,
    result: actionResult.result,
    error: actionResult.error,
    code: actionResult.code,
    traceId: actionResult.traceId,
  });
});

// ── POST /approvals/:id/deny-inline ────────────────────────────────────────
// In-app denial — authenticated org member denies without the HMAC token.

router.post('/approvals/:id/deny-inline', requireOrg, async (context) => {
  const org = context.get('org');
  const approvalId = context.req.param('id');

  await denyByApprovalId(approvalId, { orgId: org.orgId });

  await recordAuditLog({
    orgId: org.orgId,
    userId: org.userId,
    action: 'action_approval_denied',
    metadata: { approvalId, inline: true },
  }).catch(() => {});

  return context.json({ denied: true });
});

function extractPayloadText(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const textFields = ['text', 'body', 'content', 'subject', 'message'];
  const parts = [];

  for (const field of textFields) {
    if (typeof payload[field] === 'string' && payload[field].trim()) {
      parts.push(payload[field]);
    }
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

export default router;
