import { describe, it, expect } from 'vitest';
import {
  getChatUsageGateNotify,
  getChatUsageGateUserMessage,
  isVideoPaywallCode,
} from './usageGateCopy.js';

describe('usageGateCopy', () => {
  it('flags video paywall codes', () => {
    expect(isVideoPaywallCode('VIDEO_CREDITS_EXHAUSTED')).toBe(true);
    expect(isVideoPaywallCode('VIDEO_CREDITS_REQUIRED')).toBe(true);
    expect(isVideoPaywallCode('CHAT_FAILED')).toBe(false);
  });

  it('returns notify payload for execution exhaustion', () => {
    const gate = getChatUsageGateNotify('EXECUTION_CREDITS_EXHAUSTED');
    expect(gate?.title).toMatch(/Execution/);
    expect(gate?.action?.href).toMatch(/Billing/);
    expect(getChatUsageGateUserMessage('EXECUTION_CREDITS_EXHAUSTED')).toContain('Billing');
  });

  it('handles fair-use rate limit', () => {
    expect(getChatUsageGateNotify('FAIR_USE_RATE_LIMIT')).not.toBeNull();
    expect(getChatUsageGateUserMessage('FAIR_USE_RATE_LIMIT')).toBeTruthy();
  });
});
