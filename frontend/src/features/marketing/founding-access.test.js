import { describe, expect, it, beforeEach } from 'vitest';
import {
  FOUNDING_ACCESS_STORAGE_KEYS,
  shouldShowFoundingAccessPopup,
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
});
