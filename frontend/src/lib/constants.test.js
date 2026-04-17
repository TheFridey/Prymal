import { describe, expect, test } from 'vitest';
import { findAgentByInvocation, getAgentMeta, stripAgentInvocationPrefix } from './constants';

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
