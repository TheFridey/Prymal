import { beforeEach, describe, expect, it } from 'vitest';
import {
  FOUNDING_ACCESS_STORAGE_KEYS,
  shouldShowFoundingAccessPopup,
  shouldShowFoundingPricingUi,
} from './founding-access';

describe('shouldShowFoundingAccessPopup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('does not show when Founding Access is inactive', () => {
    expect(shouldShowFoundingAccessPopup({ offer: { active: false } })).toBe(false);
  });

  it('does not show after dismissal in the same session', () => {
    sessionStorage.setItem(FOUNDING_ACCESS_STORAGE_KEYS.dismissed, 'true');

    expect(shouldShowFoundingAccessPopup({ offer: { active: true } })).toBe(false);
  });

  it('does not show to paying subscribers', () => {
    expect(shouldShowFoundingAccessPopup({
      offer: {
        active: true,
        viewer: { isPayingSubscriber: true },
      },
    })).toBe(false);
  });

  it('shows once for eligible anonymous or non-paying visitors', () => {
    expect(shouldShowFoundingAccessPopup({
      offer: {
        active: true,
        viewer: { isPayingSubscriber: false },
      },
    })).toBe(true);
  });

  it('does not show when dev pricing fallback is active (API unavailable)', () => {
    expect(shouldShowFoundingAccessPopup({
      offer: { active: true, devPricingUnavailable: true, viewer: { isPayingSubscriber: false } },
    })).toBe(false);
  });
});

describe('shouldShowFoundingPricingUi', () => {
  it('reflects ready offer state', () => {
    expect(shouldShowFoundingPricingUi({ status: 'ready', offer: { active: true } })).toBe(true);
    expect(shouldShowFoundingPricingUi({ status: 'ready', offer: { active: false } })).toBe(false);
    expect(shouldShowFoundingPricingUi({ status: 'idle', offer: null })).toBe(false);
  });
});
