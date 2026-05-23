/**
 * Central action registry.
 * All executions pass through declarative policy evaluation before dispatch.
 * Approval tokens are validated before proceeding to OAuth/handler.
 * Results are logged via Sentry on failure.
 */
import * as Sentry from '@sentry/node';
import { sendEmail } from './email-actions.js';
import { writeFile, appendToFile, createFolder } from './drive-actions.js';
import { postMessage, postReply } from './slack-actions.js';
import { publishSocialPost } from './social-actions.js';
import { createRequire } from 'node:module';
import { createApprovalRequest, validateAndConsume } from './action-approval.js';

const require = createRequire(import.meta.url);
const actionPolicies = require('./action-policies.json');

const HANDLERS = {
  'email.send': sendEmail,
  'drive.write': writeFile,
  'drive.append': appendToFile,
  'drive.folder': createFolder,
  'slack.post': postMessage,
  'slack.reply': postReply,
  'social.publish': publishSocialPost,
};

export function getSupportedActionTypes() {
  return Object.keys(HANDLERS);
}

export function isKnownActionType(type) {
  return Object.prototype.hasOwnProperty.call(HANDLERS, type);
}

/**
 * Evaluate declarative action policies against a payload.
 * Returns 'allow', 'block', or 'require_approval' with risk metadata.
 *
 * @param {string} actionType
 * @param {object} payload
 * @returns {{ verdict: 'allow'|'block'|'require_approval', policyId?: string, risk?: object }}
 */
export function evaluateActionPolicy(actionType, payload) {
  for (const policy of actionPolicies) {
    if (!policy.scope.tools.includes(actionType)) {
      continue;
    }

    for (const condition of policy.conditions) {
      if (matchesCondition(condition, payload)) {
        return {
          verdict: policy.action === 'require_approval' ? 'require_approval' : 'block',
          policyId: policy.id,
          risk: policy.risk,
        };
      }
    }
  }

  return { verdict: 'allow' };
}

function matchesCondition(condition, payload) {
  const { field, operator, value } = condition;

  switch (field) {
    case 'always':
      return operator === 'equals' ? Boolean(value) === true : false;
    case 'recipient_count': {
      const recipients = Array.isArray(payload.to) ? payload.to : (payload.to ? [payload.to] : []);
      const cc = Array.isArray(payload.cc) ? payload.cc : (payload.cc ? [payload.cc] : []);
      const total = recipients.length + cc.length;
      if (operator === 'greater_than') return total > value;
      break;
    }
    case 'recipient_domain': {
      if (operator === 'not_in_org_domains') {
        // Conservative: any external-looking recipient triggers approval
        const recipients = Array.isArray(payload.to) ? payload.to : (payload.to ? [payload.to] : []);
        return recipients.some((r) => typeof r === 'string' && r.includes('@'));
      }
      break;
    }
    case 'file_size_bytes': {
      const size = payload.file_size_bytes ?? (payload.content ? Buffer.byteLength(payload.content, 'utf8') : 0);
      if (operator === 'greater_than') return size > value;
      break;
    }
    case 'channel_type': {
      if (operator === 'equals') return payload.channel_type === value;
      break;
    }
    default:
      return false;
  }

  return false;
}

/**
 * Execute an action by type.
 *
 * Flow:
 *   1. Validate type is registered
 *   2. Evaluate declarative policy (block / require_approval / allow)
 *   3. If require_approval: check for valid approvalToken, else create approval record
 *   4. Dispatch to handler
 *   5. Return structured ActionResult
 *
 * @param {string} type
 * @param {object} payload
 * @param {{ orgId: string, userId: string, workflowId?: string, nodeId?: string, approvalToken?: string, approvalBypass?: boolean }} context
 * @returns {Promise<ActionResult>}
 */
export async function executeAction(type, payload, context) {
  const handler = HANDLERS[type];

  if (!handler) {
    return {
      success: false,
      error: `Unknown action type: ${type}`,
      code: 'UNKNOWN_ACTION_TYPE',
      traceId: makeTraceId(),
      wardenVerdict: 'allow',
    };
  }

  const traceId = makeTraceId();
  const policyResult = evaluateActionPolicy(type, payload);

  if (policyResult.verdict === 'block') {
    return {
      success: false,
      blocked: true,
      error: `Action blocked by policy: ${policyResult.policyId}`,
      code: 'ACTION_POLICY_BLOCK',
      policyId: policyResult.policyId,
      risk: policyResult.risk,
      traceId,
      wardenVerdict: 'block',
    };
  }

  if (policyResult.verdict === 'require_approval') {
    if (context?.approvalBypass) {
      // Trusted in-app approval routes consume the approval row before dispatch.
    } else if (context?.approvalToken) {
      let validation;
      try {
        validation = await validateAndConsume(context.approvalToken, { orgId: context.orgId });
      } catch (error) {
        Sentry.captureException(error, { tags: { component: 'action-registry', type } });
        return {
          success: false,
          error: 'Approval token validation failed.',
          code: 'approval_token_invalid',
          traceId,
          wardenVerdict: 'require_approval',
        };
      }

      if (!validation.valid) {
        return {
          success: false,
          error: `Approval token invalid: ${validation.reason}`,
          code: 'approval_token_invalid',
          reason: validation.reason,
          traceId,
          wardenVerdict: 'require_approval',
        };
      }
      // Token valid — fall through to execution
    } else {
      // No token — create approval record and return
      try {
        const { approvalId, token: approvalToken } = await createApprovalRequest({
          actionType: type,
          payload,
          orgId: context.orgId,
          userId: context.userId,
          workflowId: context.workflowId,
          nodeId: context.nodeId,
        });
        return {
          success: false,
          awaitingApproval: true,
          approvalId,
          approvalToken,
          policyId: policyResult.policyId,
          risk: policyResult.risk,
          traceId,
          wardenVerdict: 'require_approval',
        };
      } catch (error) {
        Sentry.captureException(error, { tags: { component: 'action-registry', type } });
        return {
          success: false,
          awaitingApproval: true,
          error: 'Could not create approval record.',
          code: 'APPROVAL_CREATE_FAILED',
          traceId,
          wardenVerdict: 'require_approval',
        };
      }
    }
  }

  // Execute handler
  const start = Date.now();
  try {
    const result = await handler(payload, context);
    return {
      success: true,
      result,
      traceId,
      wardenVerdict: policyResult.verdict,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const isOAuthExpiry = error.code === 'oauth_token_expired';
    const isOAuthMissing = error.code === 'OAUTH_TOKEN_NOT_FOUND';

    Sentry.captureException(error, {
      tags: { action_type: type, org_id: context?.orgId },
      extra: { isOAuthExpiry, isOAuthMissing },
    });

    if (isOAuthMissing) {
      return {
        success: false,
        error: 'No OAuth connection found. Connect this integration in your settings.',
        code: 'oauth_not_connected',
        integration: type.split('.')[0],
        traceId,
        wardenVerdict: policyResult.verdict,
      };
    }

    if (isOAuthExpiry) {
      return {
        success: false,
        error: 'OAuth token expired. Reconnect this integration.',
        code: 'oauth_token_expired',
        requiresReauth: true,
        integration: type.split('.')[0],
        traceId,
        wardenVerdict: policyResult.verdict,
      };
    }

    return {
      success: false,
      error: error.message ?? 'Action execution failed.',
      code: error.code ?? 'ACTION_ERROR',
      traceId,
      wardenVerdict: policyResult.verdict,
      durationMs: Date.now() - start,
    };
  }
}

function makeTraceId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
