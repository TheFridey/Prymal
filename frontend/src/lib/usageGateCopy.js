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
        title: 'Execution credits exhausted',
        message:
          'This action needs execution capacity. Upgrade for a higher monthly pool, or buy an execution pack for a short burst.',
        action,
      };
    case 'EXECUTION_CONCURRENCY_LIMIT':
      return {
        title: 'Concurrency limit reached',
        message:
          'Your plan only allows a fixed number of simultaneous runs. Upgrade tiers add parallel capacity and client-scale orchestration.',
        action,
      };
    case 'INTERNAL_BURN_CAP_HIGH_COST':
      return {
        title: 'High-cost workloads',
        message:
          'This request would exceed fair-use cost controls for your tier. Use a higher plan, add an execution pack, or narrow context for this run.',
        action,
      };
    case 'INTERNAL_BURN_CAP_VIDEO':
      return {
        title: 'Video cost limit',
        message:
          'Premium video is metered separately. Add a Video Pack or upgrade for a higher monthly video allowance.',
        action,
      };
    case 'FAIR_USE_HIGH_COST_DAILY':
    case 'FAIR_USE_HIGH_COST_MONTHLY':
      return {
        title: 'Fair-use cost guard',
        message:
          'Daily or monthly internal cost limits for your plan are in effect. Upgrade or add packs, or try again later in the cycle.',
        action,
      };
    case 'FAIR_USE_MEDIA_MONTHLY':
      return {
        title: 'Heavy media lane',
        message:
          'This workload hit media fair-use thresholds. Upgrade, add packs, or reduce media depth for this request.',
        action,
      };
    case 'FAIR_USE_RATE_LIMIT':
      return {
        title: 'Usage temporarily throttled',
        message:
          'Fair-use pacing slowed this request. Retry shortly, upgrade your plan, or add execution packs from Billing.',
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
      return 'Execution credits are exhausted for this cycle. Open Billing to upgrade or buy a pack.';
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
