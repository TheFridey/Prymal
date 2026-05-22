import { describe, expect, test } from 'vitest';
import {
  canUseHoverTooltips,
  resolveAgentStripIndex,
  resolveAgentStripNeighbor,
} from './agentStripA11y';

describe('agentStripA11y', () => {
  const agents = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  test('resolveAgentStripIndex finds the active agent', () => {
    expect(resolveAgentStripIndex(agents, 'b')).toBe(1);
    expect(resolveAgentStripIndex(agents, 'missing')).toBe(-1);
  });

  test('resolveAgentStripNeighbor wraps in both directions', () => {
    expect(resolveAgentStripNeighbor(agents, 0, 'prev')).toEqual({ id: 'c' });
    expect(resolveAgentStripNeighbor(agents, 2, 'next')).toEqual({ id: 'a' });
  });

  test('canUseHoverTooltips respects coarse pointer media queries', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query.includes('hover: hover'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    expect(canUseHoverTooltips()).toBe(true);

    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    expect(canUseHoverTooltips()).toBe(false);
    window.matchMedia = originalMatchMedia;
  });
});
