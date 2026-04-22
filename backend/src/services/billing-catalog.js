const CORE_FREE_AGENTS = ['cipher', 'herald', 'forge', 'wren'];
const SOLO_AGENTS = [...CORE_FREE_AGENTS, 'lore'];

export const CREDIT_TYPES = {
  execution: 'execution',
  video: 'video',
};

export const BILLING_INTERVALS = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly',
};

export const BILLING_THRESHOLDS = [80, 90, 100];

export const EXECUTION_CONTEXT_MULTIPLIERS = [
  { maxTokens: 7999, multiplier: 1 },
  { maxTokens: 31999, multiplier: 1.5 },
  { maxTokens: 63999, multiplier: 2 },
  { maxTokens: Number.POSITIVE_INFINITY, multiplier: 3 },
];

export const EXECUTION_AGENT_MULTIPLIERS = [
  { maxAgents: 2, multiplier: 1 },
  { maxAgents: 5, multiplier: 2 },
  { maxAgents: 10, multiplier: 3 },
  { maxAgents: Number.POSITIVE_INFINITY, multiplier: 4 },
];

export const VEO_31_LITE_SPEC = {
  provider: 'google',
  providerLabel: 'Veo 3.1 Lite',
  model: process.env.GEMINI_MODEL_VEO?.trim() || 'veo-3.1-lite-generate-preview',
  supportedDurations: [4, 6, 8],
  supportedResolutions: ['720p', '1080p'],
  supportedAspectRatios: ['16:9', '9:16'],
  maxPromptTokens: 1024,
  maxRetries: 2,
};

export const VEO_31_LITE_PRICING_USD_PER_SECOND = {
  '720p': 0.05,
  '1080p': 0.08,
};

export const COST_GUARD_DEFAULTS = {
  thresholdRatio: Number(process.env.BILLING_COST_GUARD_RATIO ?? 0.7),
  usdToGbp: Number(process.env.BILLING_COST_GUARD_USD_TO_GBP ?? 0.79),
  throttleDelayMs: Number(process.env.BILLING_COST_GUARD_DELAY_MS ?? 7_500),
};

export const BILLING_PLANS = {
  free: {
    id: 'free',
    label: 'Offer Access',
    monthlyPriceGbp: 0,
    includedExecutionCredits: 50,
    includedVideoCredits: 0,
    seatLimit: 1,
    accessibleAgents: CORE_FREE_AGENTS,
    dailyVideoCreditCap: 0,
    concurrency: {
      execution: 1,
      video: 0,
    },
  },
  solo: {
    id: 'solo',
    label: 'Solo',
    monthlyPriceGbp: 49.99,
    includedExecutionCredits: 500,
    includedVideoCredits: 0,
    seatLimit: 1,
    accessibleAgents: SOLO_AGENTS,
    dailyVideoCreditCap: 0,
    concurrency: {
      execution: 1,
      video: 1,
    },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    monthlyPriceGbp: 99,
    includedExecutionCredits: 2000,
    includedVideoCredits: 10,
    seatLimit: 1,
    accessibleAgents: 'all',
    dailyVideoCreditCap: 10,
    concurrency: {
      execution: 3,
      video: 2,
    },
  },
  teams: {
    id: 'teams',
    label: 'Teams',
    monthlyPriceGbp: 179,
    includedExecutionCredits: 6000,
    includedVideoCredits: 30,
    seatLimit: 5,
    accessibleAgents: 'all',
    dailyVideoCreditCap: 15,
    concurrency: {
      execution: 8,
      video: 4,
    },
  },
  agency: {
    id: 'agency',
    label: 'Agency',
    monthlyPriceGbp: 249,
    includedExecutionCredits: 10000,
    includedVideoCredits: 60,
    seatLimit: 25,
    accessibleAgents: 'all',
    dailyVideoCreditCap: 25,
    concurrency: {
      execution: 15,
      video: 6,
    },
  },
};

export const CREDIT_PACKS = {
  execution: {
    exec_100: {
      id: 'exec_100',
      creditType: CREDIT_TYPES.execution,
      label: '100 execution credits',
      amountGbp: 10,
      credits: 100,
      stripePriceEnvKey: 'STRIPE_PRICE_EXEC_100',
    },
    exec_300: {
      id: 'exec_300',
      creditType: CREDIT_TYPES.execution,
      label: '300 execution credits',
      amountGbp: 25,
      credits: 300,
      stripePriceEnvKey: 'STRIPE_PRICE_EXEC_300',
    },
    exec_700: {
      id: 'exec_700',
      creditType: CREDIT_TYPES.execution,
      label: '700 execution credits',
      amountGbp: 50,
      credits: 700,
      stripePriceEnvKey: 'STRIPE_PRICE_EXEC_700',
    },
  },
  video: {
    video_15: {
      id: 'video_15',
      creditType: CREDIT_TYPES.video,
      label: '15 video credits',
      amountGbp: 5,
      credits: 15,
      stripePriceEnvKey: 'STRIPE_PRICE_VIDEO_15',
    },
    video_30: {
      id: 'video_30',
      creditType: CREDIT_TYPES.video,
      label: '30 video credits',
      amountGbp: 10,
      credits: 30,
      stripePriceEnvKey: 'STRIPE_PRICE_VIDEO_30',
    },
    video_100: {
      id: 'video_100',
      creditType: CREDIT_TYPES.video,
      label: '100 video credits',
      amountGbp: 25,
      credits: 100,
      stripePriceEnvKey: 'STRIPE_PRICE_VIDEO_100',
    },
  },
};

const MIN_EXECUTION_UNIT_REVENUE = Math.min(
  ...Object.values(BILLING_PLANS)
    .filter((plan) => plan.monthlyPriceGbp > 0 && plan.includedExecutionCredits > 0)
    .map((plan) => plan.monthlyPriceGbp / plan.includedExecutionCredits),
  ...Object.values(CREDIT_PACKS.execution).map((pack) => pack.amountGbp / pack.credits),
);

const MIN_VIDEO_UNIT_REVENUE = Math.min(
  ...Object.values(BILLING_PLANS)
    .filter((plan) => plan.monthlyPriceGbp > 0 && plan.includedVideoCredits > 0)
    .map((plan) => plan.monthlyPriceGbp / plan.includedVideoCredits),
  ...Object.values(CREDIT_PACKS.video).map((pack) => pack.amountGbp / pack.credits),
);

export function getBillingPlan(planId = 'free') {
  return BILLING_PLANS[planId] ?? BILLING_PLANS.free;
}

export function getPlanConfig(planId = 'free') {
  const plan = getBillingPlan(planId);

  return {
    label: plan.label,
    monthlyCreditLimit: plan.includedExecutionCredits,
    monthlyExecutionCredits: plan.includedExecutionCredits,
    monthlyVideoCredits: plan.includedVideoCredits,
    seatLimit: plan.seatLimit,
    accessibleAgents: plan.accessibleAgents,
    dailyVideoCreditCap: plan.dailyVideoCreditCap,
    concurrency: plan.concurrency,
    monthlyPriceGbp: plan.monthlyPriceGbp,
  };
}

export function canAccessAgent(planId, agentId) {
  const accessibleAgents = getBillingPlan(planId).accessibleAgents;
  return accessibleAgents === 'all' || accessibleAgents.includes(agentId);
}

export function getAllCreditPacks() {
  return [
    ...Object.values(CREDIT_PACKS.execution),
    ...Object.values(CREDIT_PACKS.video),
  ];
}

export function getCreditPack(creditType, packId) {
  return CREDIT_PACKS[creditType]?.[packId] ?? null;
}

export function getPackStripePriceId(pack) {
  if (!pack?.stripePriceEnvKey) {
    return null;
  }

  return process.env[pack.stripePriceEnvKey]?.trim() || null;
}

export function calculateExecutionCreditBurn({ base = 1, estimatedContextTokens = 0, agentCount = 1 } = {}) {
  const contextMultiplier = getExecutionContextMultiplier(estimatedContextTokens);
  const agentMultiplier = getExecutionAgentMultiplier(agentCount);
  const creditsUsed = Math.ceil(Math.max(base, 1) * contextMultiplier * agentMultiplier);

  return {
    base: Math.max(base, 1),
    estimatedContextTokens: Math.max(Number(estimatedContextTokens) || 0, 0),
    agentCount: Math.max(Number(agentCount) || 1, 1),
    contextMultiplier,
    agentMultiplier,
    creditsUsed,
  };
}

export function getExecutionContextMultiplier(tokenCount = 0) {
  const normalized = Math.max(Number(tokenCount) || 0, 0);
  return EXECUTION_CONTEXT_MULTIPLIERS.find((entry) => normalized <= entry.maxTokens)?.multiplier ?? 3;
}

export function getExecutionAgentMultiplier(agentCount = 1) {
  const normalized = Math.max(Number(agentCount) || 1, 1);
  return EXECUTION_AGENT_MULTIPLIERS.find((entry) => normalized <= entry.maxAgents)?.multiplier ?? 4;
}

export function calculateVideoCreditBurn({ durationSeconds, resolution = '720p' }) {
  const normalizedDuration = Math.max(Number(durationSeconds) || 0, 0);
  const baseCredits = Math.ceil(normalizedDuration / 5);
  const resolutionSurcharge = resolution === '1080p' ? 1 : 0;
  const creditsUsed = Math.ceil(baseCredits + resolutionSurcharge);

  return {
    durationSeconds: normalizedDuration,
    resolution,
    baseCredits,
    resolutionSurcharge,
    creditsUsed,
  };
}

export function estimateVideoProviderCostUsd({ durationSeconds, resolution = '720p' }) {
  const normalizedDuration = Math.max(Number(durationSeconds) || 0, 0);
  const unitPrice = VEO_31_LITE_PRICING_USD_PER_SECOND[resolution] ?? VEO_31_LITE_PRICING_USD_PER_SECOND['720p'];
  return Number((normalizedDuration * unitPrice).toFixed(4));
}

export function validateVideoGenerationRequest({ durationSeconds, resolution, aspectRatio, retryCount = 0 }) {
  if (!VEO_31_LITE_SPEC.supportedDurations.includes(Number(durationSeconds))) {
    return {
      ok: false,
      code: 'VIDEO_DURATION_UNSUPPORTED',
      message: `Veo 3.1 Lite currently supports ${VEO_31_LITE_SPEC.supportedDurations.join(', ')} second videos only.`,
    };
  }

  if (!VEO_31_LITE_SPEC.supportedResolutions.includes(resolution)) {
    return {
      ok: false,
      code: 'VIDEO_RESOLUTION_UNSUPPORTED',
      message: `Veo 3.1 Lite supports ${VEO_31_LITE_SPEC.supportedResolutions.join(' and ')} output only.`,
    };
  }

  if (!VEO_31_LITE_SPEC.supportedAspectRatios.includes(aspectRatio)) {
    return {
      ok: false,
      code: 'VIDEO_ASPECT_RATIO_UNSUPPORTED',
      message: `Veo 3.1 Lite supports ${VEO_31_LITE_SPEC.supportedAspectRatios.join(' or ')} aspect ratios only.`,
    };
  }

  if (resolution === '1080p' && Number(durationSeconds) !== 8) {
    return {
      ok: false,
      code: 'VIDEO_RESOLUTION_DURATION_INVALID',
      message: '1080p video generation requires an 8 second duration with Veo 3.1 Lite.',
    };
  }

  if (Number(retryCount) > VEO_31_LITE_SPEC.maxRetries) {
    return {
      ok: false,
      code: 'VIDEO_RETRY_LIMIT_REACHED',
      message: `Video jobs may only be retried ${VEO_31_LITE_SPEC.maxRetries} times before a new credit reservation is required.`,
    };
  }

  return { ok: true };
}

export function getUsageThreshold(percentUsed = 0) {
  if (percentUsed >= 100) return 100;
  if (percentUsed >= 90) return 90;
  if (percentUsed >= 80) return 80;
  return 0;
}

export function getThresholdPresentation(percentUsed = 0) {
  const threshold = getUsageThreshold(percentUsed);

  if (threshold === 100) {
    return {
      threshold,
      state: 'blocked',
      label: 'Credit limit reached',
      surface: 'blocked',
    };
  }

  if (threshold === 90) {
    return {
      threshold,
      state: 'critical',
      label: 'Approaching credit exhaustion',
      surface: 'modal',
    };
  }

  if (threshold === 80) {
    return {
      threshold,
      state: 'warning',
      label: 'Heavy credit usage',
      surface: 'banner',
    };
  }

  return {
    threshold: 0,
    state: 'normal',
    label: 'Within plan allowance',
    surface: 'none',
  };
}

export function detectHeavyUsage({ percentUsed = 0, cycleAgeDays = 30, durationSeconds = 0, resolution = '720p' } = {}) {
  const rapidBurn = percentUsed > 90 && cycleAgeDays <= 7;
  const highValueVideoPattern = Number(durationSeconds) >= 8 && resolution === '1080p';

  return {
    flagged: rapidBurn || highValueVideoPattern,
    rapidBurn,
    highValueVideoPattern,
  };
}

export function getConservativeRevenueContributionGbp(creditType, credits) {
  const normalizedCredits = Math.max(Number(credits) || 0, 0);

  if (creditType === CREDIT_TYPES.video) {
    return Number((normalizedCredits * MIN_VIDEO_UNIT_REVENUE).toFixed(4));
  }

  return Number((normalizedCredits * MIN_EXECUTION_UNIT_REVENUE).toFixed(4));
}

export function evaluateCostGuard({ creditType, credits, estimatedCostUsd }) {
  const revenueContributionGbp = getConservativeRevenueContributionGbp(creditType, credits);
  const estimatedCostGbp = Number(((Number(estimatedCostUsd) || 0) * COST_GUARD_DEFAULTS.usdToGbp).toFixed(4));
  const triggered = revenueContributionGbp > 0
    ? estimatedCostGbp > revenueContributionGbp * COST_GUARD_DEFAULTS.thresholdRatio
    : estimatedCostGbp > 0;

  return {
    triggered,
    thresholdRatio: COST_GUARD_DEFAULTS.thresholdRatio,
    revenueContributionGbp,
    estimatedCostUsd: Number((Number(estimatedCostUsd) || 0).toFixed(4)),
    estimatedCostGbp,
    throttleDelayMs: triggered ? COST_GUARD_DEFAULTS.throttleDelayMs : 0,
  };
}

export function serializeBillingCatalog() {
  return {
    thresholds: BILLING_THRESHOLDS,
    plans: Object.values(BILLING_PLANS).map((plan) => ({
      id: plan.id,
      label: plan.label,
      monthlyPriceGbp: plan.monthlyPriceGbp,
      includedExecutionCredits: plan.includedExecutionCredits,
      includedVideoCredits: plan.includedVideoCredits,
      seatLimit: plan.seatLimit,
      dailyVideoCreditCap: plan.dailyVideoCreditCap,
      concurrency: plan.concurrency,
    })),
    packs: getAllCreditPacks().map((pack) => ({
      id: pack.id,
      creditType: pack.creditType,
      label: pack.label,
      amountGbp: pack.amountGbp,
      credits: pack.credits,
    })),
    videoSpec: {
      ...VEO_31_LITE_SPEC,
      maxRetries: VEO_31_LITE_SPEC.maxRetries,
    },
  };
}
