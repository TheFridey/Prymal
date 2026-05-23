import { trackProductEvent } from './product-events';

export const ANALYTICS_EVENTS = {
  PUBLIC_PAGE_VIEW: 'public_page_view',
  CTA_CLICKED: 'cta_clicked',
  PRICING_PLAN_VIEWED: 'pricing_plan_viewed',
  SIGNUP_STARTED: 'signup_started',
  ONBOARDING_STARTED: 'onboarding_started',
  FIRST_WIN_SELECTED: 'first_win_selected',
  FIRST_AGENT_RUN_STARTED: 'first_agent_run_started',
  FIRST_AGENT_RUN_COMPLETED: 'first_agent_run_completed',
  WORKFLOW_TEMPLATE_OPENED: 'workflow_template_opened',
  UPGRADE_INTENT: 'upgrade_intent',
  CHECKOUT_STARTED: 'checkout_started',
  DASHBOARD_QUICK_ACTION_CLICKED: 'dashboard_quick_action_clicked',
  DASHBOARD_TIME_SAVED_VIEWED: 'dashboard_time_saved_viewed',
  DASHBOARD_CONTINUE_CLICKED: 'dashboard_continue_clicked',
  DASHBOARD_RECOMMENDED_NEXT_STEP_CLICKED: 'dashboard_recommended_next_step_clicked',
};

const PRODUCT_PERSIST_EVENTS = new Set([
  ANALYTICS_EVENTS.ONBOARDING_STARTED,
  ANALYTICS_EVENTS.FIRST_WIN_SELECTED,
  ANALYTICS_EVENTS.FIRST_AGENT_RUN_STARTED,
  ANALYTICS_EVENTS.FIRST_AGENT_RUN_COMPLETED,
  ANALYTICS_EVENTS.WORKFLOW_TEMPLATE_OPENED,
  ANALYTICS_EVENTS.UPGRADE_INTENT,
  ANALYTICS_EVENTS.CHECKOUT_STARTED,
]);

const BLOCKED_KEY_PATTERN =
  /prompt|message|content|text|document|body|email|password|token|secret|attachment|instruction|snippet|transcript/i;

const MAX_STRING_LENGTH = 120;
const MAX_ARRAY_ITEMS = 10;
const MAX_ARRAY_STRING_LENGTH = 64;

export function sanitizeAnalyticsPayload(metadata = {}) {
  const safe = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (BLOCKED_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }

    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        safe[key] = value;
      }
      continue;
    }

    if (typeof value === 'string') {
      safe[key] = value.slice(0, MAX_STRING_LENGTH);
      continue;
    }

    if (Array.isArray(value)) {
      safe[key] = value
        .filter((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => (typeof item === 'string' ? item.slice(0, MAX_ARRAY_STRING_LENGTH) : item));
    }
  }

  return safe;
}

function invokePrymalTrack(eventName, payload) {
  if (typeof window === 'undefined' || typeof window.prymalTrack !== 'function') {
    return;
  }

  try {
    window.prymalTrack(eventName, payload);
  } catch {
    // Analytics must never block navigation or UI.
  }
}

export function trackAnalyticsEvent(eventName, metadata = {}, options = {}) {
  const payload = sanitizeAnalyticsPayload(metadata);
  invokePrymalTrack(eventName, payload);

  const persist = options.persist ?? PRODUCT_PERSIST_EVENTS.has(eventName);
  if (persist) {
    void trackProductEvent(eventName, payload);
  }
}

export function trackPublicPageView({ page, route, ...extra } = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.PUBLIC_PAGE_VIEW, { page, route, ...extra }, { persist: false });
}

export function trackCtaClicked({ cta, surface, intent, ...extra } = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.CTA_CLICKED, { cta, surface, intent, ...extra }, { persist: false });
}

export function trackPricingPlanViewed({ plan_id, interval, ...extra } = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.PRICING_PLAN_VIEWED, { plan_id, interval, ...extra }, { persist: false });
}

export function trackSignupStarted(metadata = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_STARTED, metadata, { persist: false });
}

export function trackOnboardingStarted(metadata = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED, metadata);
}

export function trackFirstWinSelected({
  outcome_id,
  surface,
  recommended_agent_id,
  credit_intensity,
  ...extra
} = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.FIRST_WIN_SELECTED, {
    outcome_id,
    surface,
    recommended_agent_id,
    credit_intensity,
    ...extra,
  });
}

export function trackFirstAgentRunStarted({ agent_id, outcome_id, surface, ...extra } = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.FIRST_AGENT_RUN_STARTED, {
    agent_id,
    outcome_id,
    surface,
    ...extra,
  });
}

export function trackFirstAgentRunCompleted({
  agent_id,
  conversation_id,
  message_id,
  outcome_id,
  ...extra
} = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.FIRST_AGENT_RUN_COMPLETED, {
    agent_id,
    conversation_id,
    message_id,
    outcome_id,
    ...extra,
  });
}

export function trackWorkflowTemplateOpened({ template_slug, surface, action, ...extra } = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.WORKFLOW_TEMPLATE_OPENED, {
    template_slug,
    surface,
    action,
    ...extra,
  });
}

export function trackUpgradeIntent({ surface, plan_id, intent, cta, ...extra } = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.UPGRADE_INTENT, {
    surface,
    plan_id,
    intent,
    cta,
    ...extra,
  });
}

export function trackCheckoutStarted({
  checkout_type,
  plan_id,
  interval,
  pack_id,
  credit_type,
  surface,
  ...extra
} = {}) {
  trackAnalyticsEvent(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
    checkout_type,
    plan_id,
    interval,
    pack_id,
    credit_type,
    surface,
    ...extra,
  });
}

export function trackDashboardQuickActionClicked({ action_id, surface = 'dashboard', route, ...extra } = {}) {
  trackAnalyticsEvent(
    ANALYTICS_EVENTS.DASHBOARD_QUICK_ACTION_CLICKED,
    { action_id, surface, route, ...extra },
    { persist: false },
  );
}

export function trackDashboardTimeSavedViewed({
  surface = 'dashboard',
  is_empty,
  minutes_month,
  workflows_run,
  ...extra
} = {}) {
  trackAnalyticsEvent(
    ANALYTICS_EVENTS.DASHBOARD_TIME_SAVED_VIEWED,
    { surface, is_empty, minutes_month, workflows_run, ...extra },
    { persist: false },
  );
}

export function trackDashboardContinueClicked({
  surface = 'dashboard',
  item_type,
  route,
  ...extra
} = {}) {
  trackAnalyticsEvent(
    ANALYTICS_EVENTS.DASHBOARD_CONTINUE_CLICKED,
    { surface, item_type, route, ...extra },
    { persist: false },
  );
}

export function trackDashboardRecommendedNextStepClicked({
  surface = 'dashboard',
  recommendation_id,
  route,
  plan_id,
  ...extra
} = {}) {
  trackAnalyticsEvent(
    ANALYTICS_EVENTS.DASHBOARD_RECOMMENDED_NEXT_STEP_CLICKED,
    { surface, recommendation_id, route, plan_id, ...extra },
    { persist: false },
  );
}

export function resolvePublicPageName(pathname) {
  if (!pathname || pathname === '/') {
    return 'landing';
  }

  if (pathname.startsWith('/pricing')) {
    return 'pricing';
  }

  if (pathname.startsWith('/blog/')) {
    return 'blog_post';
  }

  if (pathname.startsWith('/blog')) {
    return 'blog';
  }

  if (pathname.startsWith('/signup')) {
    return 'signup';
  }

  if (pathname.startsWith('/login')) {
    return 'login';
  }

  if (pathname.startsWith('/features/')) {
    return 'feature';
  }

  if (pathname.startsWith('/features')) {
    return 'features';
  }

  if (pathname.startsWith('/compare/')) {
    return 'compare_detail';
  }

  if (pathname.startsWith('/compare')) {
    return 'compare';
  }

  if (pathname.startsWith('/for-agencies')) {
    return 'for_agencies';
  }

  if (pathname.startsWith('/for-small-business')) {
    return 'for_small_business';
  }

  if (pathname.startsWith('/changelog')) {
    return 'changelog';
  }

  if (pathname.startsWith('/trust')) {
    return 'trust';
  }

  if (pathname.startsWith('/agents/')) {
    return 'agent_profile';
  }

  if (pathname.startsWith('/privacy')) {
    return 'privacy';
  }

  if (pathname.startsWith('/terms')) {
    return 'terms';
  }

  if (pathname.startsWith('/cookies')) {
    return 'cookies';
  }

  return 'other';
}

export function isPublicMarketingRoute(pathname) {
  return (
    pathname === '/' ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/blog') ||
    pathname.startsWith('/features') ||
    pathname.startsWith('/compare') ||
    pathname.startsWith('/for-agencies') ||
    pathname.startsWith('/for-small-business') ||
    pathname.startsWith('/changelog') ||
    pathname.startsWith('/trust') ||
    pathname.startsWith('/agents/') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/cookies') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/login')
  );
}
