import { describe, expect, test } from 'vitest';
import {
  PREFERRED_CREDIT_PACKS_PUBLIC,
  PLAN_LIBRARY,
  findAgentByInvocation,
  getAgentMeta,
  getPlanPrice,
  stripAgentInvocationPrefix,
} from './constants';

describe('findAgentByInvocation', () => {
  test('does not mistake plain words like "message" for agent names', () => {
    expect(findAgentByInvocation('Draft a message I can send to a lead')).toBeNull();
  });

  test('matches an explicit hey-agent invocation at the start of the message', () => {
    expect(findAgentByInvocation('hey sage, help me prioritise this week')?.id).toBe('sage');
  });

  test('matches an explicit @agent invocation at the start of the message', () => {
    expect(findAgentByInvocation('@herald write a follow-up email')?.id).toBe('herald');
  });
});

describe('stripAgentInvocationPrefix', () => {
  test('removes the invocation prefix before sending the message body', () => {
    const sage = getAgentMeta('sage');

    expect(stripAgentInvocationPrefix('hey sage, help me prioritise this week', sage)).toBe(
      'help me prioritise this week',
    );
  });
});

describe('public preferred credit packs', () => {
  test('lists only current preferred checkout pack IDs', () => {
    expect(PREFERRED_CREDIT_PACKS_PUBLIC.map((pack) => pack.id)).toEqual([
      'exec_boost_1000',
      'video_pack_small',
      'video_pack_pro',
    ]);
    expect(PREFERRED_CREDIT_PACKS_PUBLIC.map((pack) => pack.id).join(' ')).not.toMatch(/exec_100|exec_300|exec_700|video_15|video_30|video_100/);
  });
});

describe('getPlanPrice', () => {
  test('includes founding access display prices at 20% off list billing amounts', () => {
    const pro = PLAN_LIBRARY.find((plan) => plan.id === 'pro');

    expect(getPlanPrice(pro, 'monthly').display).toBe('£99');
    expect(getPlanPrice(pro, 'monthly').founding.display).toBe('£79.20');
    expect(getPlanPrice(pro, 'monthly').founding.discountLabel).toBe('20% off');
  });

  test('formats pence cleanly for existing and founding prices', () => {
    const solo = PLAN_LIBRARY.find((plan) => plan.id === 'solo');

    expect(getPlanPrice(solo, 'monthly').display).toBe('£49.99');
    expect(getPlanPrice(solo, 'monthly').founding.display).toBe('£39.99');
  });
});
