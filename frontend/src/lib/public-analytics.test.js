import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  bindPublicCtaClick,
  publicCtaDataAttrs,
  trackPublicCtaClick,
  trackPublicEvent,
} from './public-analytics';

describe('public-analytics', () => {
  beforeEach(() => {
    window.prymalTrack = vi.fn();
  });

  afterEach(() => {
    delete window.prymalTrack;
  });

  test('trackPublicEvent forwards to prymalTrack when available', () => {
    trackPublicEvent('public_page_view', { page: 'landing' });
    expect(window.prymalTrack).toHaveBeenCalledWith('public_page_view', { page: 'landing' });
  });

  test('trackPublicEvent is safe when prymalTrack throws', () => {
    window.prymalTrack = vi.fn(() => {
      throw new Error('analytics unavailable');
    });

    expect(() => trackPublicEvent('public_page_view')).not.toThrow();
  });

  test('trackPublicEvent is safe when prymalTrack is missing', () => {
    delete window.prymalTrack;
    expect(() => trackPublicEvent('public_page_view')).not.toThrow();
  });

  test('publicCtaDataAttrs returns data attributes', () => {
    expect(publicCtaDataAttrs({ cta: 'signup', surface: 'pricing-hero', intent: 'convert' })).toEqual({
      'data-cta': 'signup',
      'data-surface': 'pricing-hero',
      'data-intent': 'convert',
    });
  });

  test('bindPublicCtaClick tracks and forwards the original handler', () => {
    const handler = vi.fn();
    const event = { preventDefault: vi.fn() };
    bindPublicCtaClick(handler, { cta: 'signup', surface: 'landing-hero', intent: 'convert' })(event);

    expect(window.prymalTrack).toHaveBeenCalledWith('cta_clicked', {
      cta: 'signup',
      surface: 'landing-hero',
      intent: 'convert',
    });
    expect(handler).toHaveBeenCalledWith(event);
  });

  test('trackPublicCtaClick uses the cta_clicked event name', () => {
    trackPublicCtaClick({ cta: 'view-pricing', surface: 'landing-pricing-teaser', intent: 'learn' });
    expect(window.prymalTrack).toHaveBeenCalledWith('cta_clicked', {
      cta: 'view-pricing',
      surface: 'landing-pricing-teaser',
      intent: 'learn',
    });
  });

  test('trackPublicCtaClick also records upgrade_intent for upgrade CTAs', () => {
    trackPublicCtaClick({
      cta: 'upgrade-pro',
      surface: 'pricing-card-pro',
      intent: 'upgrade',
      plan_id: 'pro',
    });

    expect(window.prymalTrack).toHaveBeenCalledWith('cta_clicked', {
      cta: 'upgrade-pro',
      surface: 'pricing-card-pro',
      intent: 'upgrade',
      plan_id: 'pro',
    });
    expect(window.prymalTrack).toHaveBeenCalledWith('upgrade_intent', {
      surface: 'pricing-card-pro',
      plan_id: 'pro',
      intent: 'upgrade',
      cta: 'upgrade-pro',
    });
  });
});
