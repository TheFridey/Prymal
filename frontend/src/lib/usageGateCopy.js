/** Central copy for billing / fair-use blocks — keeps chat, workflows, and media aligned. */

const BILLING_HREF = '/app/settings?tab=Billing';

export const VIDEO_PAYWALL_CODES = new Set(['VIDEO_CREDITS_EXHAUSTED', 'VIDEO_CREDITS_REQUIRED']);

export function isVideoPaywallCode(code) {
  return code != null && VIDEO_PAYWALL_CODES.has(String(code));
}

/**
 * @param {string | null | undefined} code
 * @returns {{ title: string; message: string; action: { label: string; href: string } | null } | null}
 */
export function getChatUsageGateNotify(code) {
  if (!code) return null;

  const action = { label: 'Plans & usage packs', href: BILLING_HREF };

  switch (code) {
    case 'EXECUTION_CREDITS_EXHAUSTED':
      return {
        title: 'Execution credits needed',
        message:
          'This action needs more execution credits than are currently available. Add a pack or upgrade when you are ready to continue.',
        action,
      };
    case 'EXECUTION_CONCURRENCY_LIMIT':
      return {
        title: 'Another run is already active',
        message:
          'Your plan has a set number of simultaneous runs. Wait for the current run to finish, or upgrade for more parallel capacity.',
        action,
      };
    case 'INTERNAL_BURN_CAP_HIGH_COST':
      return {
        title: 'Higher-capacity action',
        message:
          'This request is larger than your current plan controls allow. You can narrow the context, add usage, or upgrade for heavier work.',
        action,
      };
    case 'INTERNAL_BURN_CAP_VIDEO':
      return {
        title: 'Video credits needed',
        message:
          'AI video uses a separate allowance. Add a Video Pack or use a plan with more video credits before rendering.',
        action,
      };
    case 'FAIR_USE_HIGH_COST_DAILY':
    case 'FAIR_USE_HIGH_COST_MONTHLY':
      return {
        title: 'Plan guardrail is active',
        message:
          'Prymal paused this higher-cost action to keep usage within your plan. Add usage, upgrade, or try again later in the cycle.',
        action,
      };
    case 'FAIR_USE_MEDIA_MONTHLY':
      return {
        title: 'Media guardrail is active',
        message:
          'This media workload is above the current plan guardrail. Reduce the media depth, add a pack, or upgrade before retrying.',
        action,
      };
    case 'FAIR_USE_RATE_LIMIT':
      return {
        title: 'Usage is being paced',
        message:
          'Prymal is pacing requests for your plan. Retry shortly, or add more capacity from Billing.',
        action,
      };
    default:
      return null;
  }
}

/**
 * Short assistant bubble + notification copy for streamed chat failures.
 */
export function getChatUsageGateUserMessage(code) {
  switch (code) {
    case 'EXECUTION_CREDITS_EXHAUSTED':
      return 'This action needs execution credits before Prymal can continue. Open Billing to add a pack or upgrade.';
    case 'INTERNAL_BURN_CAP_HIGH_COST':
      return 'This action requires higher plan capacity or fair-use headroom — open Billing to upgrade or add execution usage.';
    case 'INTERNAL_BURN_CAP_VIDEO':
      return 'Video fair-use limits apply — add a Video Pack or upgrade from Billing.';
    case 'FAIR_USE_HIGH_COST_DAILY':
    case 'FAIR_USE_HIGH_COST_MONTHLY':
      return 'Fair-use cost limits are in effect for your plan. Upgrade or add packs from Billing, or retry later in the cycle.';
    case 'FAIR_USE_MEDIA_MONTHLY':
      return 'Heavy media usage is gated on your tier. Upgrade or add packs from Billing.';
    case 'EXECUTION_CONCURRENCY_LIMIT':
      return 'Parallel run limit reached. Upgrade for higher concurrency from Billing.';
    case 'FAIR_USE_RATE_LIMIT':
      return 'Fair-use pacing is limiting throughput — wait a moment, upgrade, or add packs from Billing.';
    default:
      return null;
  }
}

/**
 * Inline notices (e.g. workflow run).
 */
export function getWorkflowRunBlockedMessage(error) {
  const code = error?.code ?? error?.data?.code;
  if (code === 'WARDEN_WORKFLOW_CONFIRMATION_REQUIRED') {
    return {
      tone: 'warning',
      body:
        'This workflow could send, change, delete, publish, bill, or expose information. Confirm the action before Prymal continues.',
      showBillingLink: false,
    };
  }
  if (code === 'WARDEN_WORKFLOW_BLOCKED') {
    return {
      tone: 'warning',
      body:
        'Prymal blocked this workflow before it ran because part of the input looked unsafe for tool execution. Edit the workflow or remove the risky input, then try again.',
      showBillingLink: false,
    };
  }
  if (code === 'WARDEN_WORKFLOW_ADMIN_REQUIRED') {
    return {
      tone: 'warning',
      body:
        'This workflow touches a high-impact action and needs admin review before it can run.',
      showBillingLink: false,
    };
  }
  if (code === 'EXECUTION_CREDITS_EXHAUSTED') {
    return {
      tone: 'danger',
      body:
        'This workflow run needs execution credits. Upgrade for a higher monthly allowance or add an execution pack from Billing.',
      showBillingLink: true,
    };
  }
  if (code === 'INTERNAL_BURN_CAP_HIGH_COST' || code === 'FAIR_USE_HIGH_COST_MONTHLY' || code === 'FAIR_USE_HIGH_COST_DAILY') {
    return {
      tone: 'warning',
      body:
        'Long or high-cost workflows need a higher plan or additional usage. Open Billing to upgrade or add packs.',
      showBillingLink: true,
    };
  }
  return null;
}
