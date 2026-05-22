/**
 * Lightweight public marketing analytics. Safe when Plausible or prymalTrack is absent.
 */

import { trackAnalyticsEvent, trackCtaClicked, trackUpgradeIntent } from './analytics';

export function trackPublicEvent(eventName, metadata = {}) {
  trackAnalyticsEvent(eventName, metadata, { persist: false });
}

export function publicCtaDataAttrs({ cta, surface, intent }) {
  const attrs = {};
  if (cta) attrs['data-cta'] = cta;
  if (surface) attrs['data-surface'] = surface;
  if (intent) attrs['data-intent'] = intent;
  return attrs;
}

export function trackPublicCtaClick({ cta, surface, intent, plan_id, ...extra } = {}) {
  trackCtaClicked({ cta, surface, intent, plan_id, ...extra });

  if (intent === 'upgrade') {
    trackUpgradeIntent({ surface, plan_id, intent, cta, ...extra });
  }
}

export function bindPublicCtaClick(handler, meta) {
  return (event) => {
    trackPublicCtaClick(meta);
    handler?.(event);
  };
}
