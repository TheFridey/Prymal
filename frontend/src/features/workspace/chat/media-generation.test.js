import { describe, expect, test } from 'vitest';
import {
  createVideoGenerationDraft,
  estimateImageExecutionCredits,
  estimatePromptTokens,
  estimateVideoCredits,
} from './media-generation';

describe('media-generation helpers', () => {
  test('estimates prompt tokens from the brief length', () => {
    expect(estimatePromptTokens('Generate a polished hero image for Prymal')).toBe(11);
    expect(estimatePromptTokens('')).toBe(0);
  });

  test('maps image quality presets to execution credits', () => {
    expect(estimateImageExecutionCredits({ quality: 'low' })).toBe(2);
    expect(estimateImageExecutionCredits({ quality: 'medium' })).toBe(4);
    expect(estimateImageExecutionCredits({ quality: 'high' })).toBe(8);
  });

  test('keeps standard video estimates materially higher than lite', () => {
    expect(
      estimateVideoCredits({ mode: 'lite', durationSeconds: 8, resolution: '1080p' }),
    ).toBe(3);
    expect(
      estimateVideoCredits({ mode: 'standard', durationSeconds: 8, resolution: '1080p' }),
    ).toBe(13);
  });

  test('normalizes unsupported video draft options to the selected mode', () => {
    expect(
      createVideoGenerationDraft({
        mode: 'lite',
        durationSeconds: 15,
        resolution: '4k',
        aspectRatio: '1:1',
        referenceImages: [{ name: 'mock.png' }],
      }),
    ).toEqual({
      prompt: '',
      mode: 'lite',
      durationSeconds: 4,
      resolution: '720p',
      aspectRatio: '16:9',
      referenceImages: [],
    });
  });
});
