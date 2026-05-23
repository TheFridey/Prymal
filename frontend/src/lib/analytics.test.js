import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ANALYTICS_EVENTS,
  isPublicMarketingRoute,
  resolvePublicPageName,
  sanitizeAnalyticsPayload,
  trackAnalyticsEvent,
  trackCtaClicked,
  trackDashboardContinueClicked,
  trackDashboardQuickActionClicked,
  trackDashboardRecommendedNextStepClicked,
  trackDashboardTimeSavedViewed,
  trackFirstWinSelected,
} from './analytics';

vi.mock('./product-events', () => ({
  trackProductEvent: vi.fn(),
}));

import { trackProductEvent } from './product-events';

describe('analytics', () => {
  beforeEach(() => {
    window.prymalTrack = vi.fn();
    vi.mocked(trackProductEvent).mockClear();
  });

  afterEach(() => {
    delete window.prymalTrack;
  });

  test('sanitizeAnalyticsPayload removes sensitive keys and truncates strings', () => {
    expect(
      sanitizeAnalyticsPayload({
        surface: 'pricing-hero',
        prompt: 'secret prompt',
        message_content: 'hello',
        agent_id: 'cipher',
        note: 'x'.repeat(200),
      }),
    ).toEqual({
      surface: 'pricing-hero',
      agent_id: 'cipher',
      note: 'x'.repeat(120),
    });
  });

  test('sanitizeAnalyticsPayload keeps safe scalar and array values', () => {
    expect(
      sanitizeAnalyticsPayload({
        plan_id: 'pro',
        interval: 'annual',
        credits_used: 42,
        confirmed: true,
        tags: ['alpha', 'beta'],
      }),
    ).toEqual({
      plan_id: 'pro',
      interval: 'annual',
      credits_used: 42,
      confirmed: true,
      tags: ['alpha', 'beta'],
    });
  });

  test('trackAnalyticsEvent forwards sanitized payload to prymalTrack', () => {
    trackCtaClicked({ cta: 'signup', surface: 'landing-hero', intent: 'convert' });

    expect(window.prymalTrack).toHaveBeenCalledWith(ANALYTICS_EVENTS.CTA_CLICKED, {
      cta: 'signup',
      surface: 'landing-hero',
      intent: 'convert',
    });
    expect(trackProductEvent).not.toHaveBeenCalled();
  });

  test('trackAnalyticsEvent persists product funnel events by default', () => {
    trackFirstWinSelected({
      outcome_id: 'create_content',
      surface: 'onboarding',
      recommended_agent_id: 'herald',
    });

    expect(window.prymalTrack).toHaveBeenCalledWith(ANALYTICS_EVENTS.FIRST_WIN_SELECTED, {
      outcome_id: 'create_content',
      surface: 'onboarding',
      recommended_agent_id: 'herald',
    });
    expect(trackProductEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.FIRST_WIN_SELECTED, {
      outcome_id: 'create_content',
      surface: 'onboarding',
      recommended_agent_id: 'herald',
    });
  });

  test('trackAnalyticsEvent is safe when prymalTrack throws', () => {
    window.prymalTrack = vi.fn(() => {
      throw new Error('analytics unavailable');
    });

    expect(() => trackAnalyticsEvent(ANALYTICS_EVENTS.PUBLIC_PAGE_VIEW, { page: 'landing' })).not.toThrow();
  });

  test('trackAnalyticsEvent is safe when prymalTrack is missing', () => {
    delete window.prymalTrack;

    expect(() => trackCtaClicked({ cta: 'signup' })).not.toThrow();
  });

  test('resolvePublicPageName maps marketing routes', () => {
    expect(resolvePublicPageName('/')).toBe('landing');
    expect(resolvePublicPageName('/pricing')).toBe('pricing');
    expect(resolvePublicPageName('/blog/first-win')).toBe('blog_post');
    expect(resolvePublicPageName('/signup')).toBe('signup');
  });

  test('isPublicMarketingRoute identifies public surfaces only', () => {
    expect(isPublicMarketingRoute('/pricing')).toBe(true);
    expect(isPublicMarketingRoute('/app/dashboard')).toBe(false);
  });

  test('dashboard analytics events strip sensitive keys and do not persist', () => {
    trackDashboardQuickActionClicked({
      action_id: 'ask_agent',
      route: '/app/agents/nexus?new=1',
      prompt: 'hidden',
    });

    expect(window.prymalTrack).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_QUICK_ACTION_CLICKED, {
      action_id: 'ask_agent',
      surface: 'dashboard',
      route: '/app/agents/nexus?new=1',
    });
    expect(trackProductEvent).not.toHaveBeenCalled();
  });

  test('trackDashboardTimeSavedViewed forwards safe counts', () => {
    trackDashboardTimeSavedViewed({
      is_empty: false,
      minutes_month: 120,
      workflows_run: 2,
      message_content: 'strip me',
    });

    expect(window.prymalTrack).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_TIME_SAVED_VIEWED, {
      surface: 'dashboard',
      is_empty: false,
      minutes_month: 120,
      workflows_run: 2,
    });
  });

  test('trackDashboardContinueClicked and recommended next step do not persist', () => {
    trackDashboardContinueClicked({ item_type: 'conversation', route: '/app/agents/cipher' });
    trackDashboardRecommendedNextStepClicked({
      recommendation_id: 'first_win',
      route: '/app/agents/nexus?new=1',
      plan_id: 'pro',
    });

    expect(trackProductEvent).not.toHaveBeenCalled();
    expect(window.prymalTrack).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DASHBOARD_CONTINUE_CLICKED,
      expect.objectContaining({ item_type: 'conversation' }),
    );
    expect(window.prymalTrack).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DASHBOARD_RECOMMENDED_NEXT_STEP_CLICKED,
      expect.objectContaining({ recommendation_id: 'first_win', plan_id: 'pro' }),
    );
  });
});
