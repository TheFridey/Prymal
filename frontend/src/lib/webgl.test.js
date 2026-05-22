import { describe, expect, test } from 'vitest';
import { isWebGLAvailable, shouldPreferStaticHeroScene } from './webgl';

describe('webgl helpers', () => {
  test('isWebGLAvailable returns a boolean', () => {
    expect(typeof isWebGLAvailable()).toBe('boolean');
  });

  test('shouldPreferStaticHeroScene respects reduced motion override', () => {
    expect(shouldPreferStaticHeroScene({ reducedMotion: true })).toBe(true);
  });
});
