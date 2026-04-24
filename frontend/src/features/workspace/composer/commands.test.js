import { describe, expect, test } from 'vitest';
import { extractVideoRequest } from './commands';

describe('extractVideoRequest', () => {
  test('parses duration, resolution, and aspect ratio from a /video prompt', () => {
    expect(
      extractVideoRequest('/video Create a 10-second 16:9 promo video for Prymal in 1080p'),
    ).toEqual({
      prompt: 'Create a 10-second 16:9 promo video for Prymal in 1080p',
      durationSeconds: 10,
      resolution: '1080p',
      aspectRatio: '16:9',
    });
  });

  test('detects portrait shorthand and falls back to 720p when resolution is omitted', () => {
    expect(
      extractVideoRequest('/video Make a 6 second portrait product teaser with soft gradients'),
    ).toEqual({
      prompt: 'Make a 6 second portrait product teaser with soft gradients',
      durationSeconds: 6,
      resolution: '720p',
      aspectRatio: '9:16',
    });
  });

  test('defaults to a 4 second widescreen render when duration is omitted', () => {
    expect(extractVideoRequest('/video Show a premium SaaS dashboard reveal')).toEqual({
      prompt: 'Show a premium SaaS dashboard reveal',
      durationSeconds: 4,
      resolution: '720p',
      aspectRatio: '16:9',
    });
  });
});
