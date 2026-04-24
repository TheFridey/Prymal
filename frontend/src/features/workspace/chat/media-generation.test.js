import { describe, expect, test } from 'vitest';
import {
  buildVideoConfirmCopy,
  createVideoGenerationDraft,
  estimateImageExecutionCredits,
  estimatePromptTokens,
  estimateVideoCredits,
  shouldConfirmVideoRender,
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

  test('requires confirmation for Standard, 1080p, or high-credit renders', () => {
    expect(
      shouldConfirmVideoRender({ mode: 'lite', resolution: '720p', estimatedCredits: 2 }),
    ).toBe(false);
    expect(
      shouldConfirmVideoRender({ mode: 'standard', resolution: '720p', estimatedCredits: 2 }),
    ).toBe(true);
    expect(
      shouldConfirmVideoRender({ mode: 'lite', resolution: '1080p', estimatedCredits: 2 }),
    ).toBe(true);
    expect(
      shouldConfirmVideoRender({ mode: 'lite', resolution: '720p', estimatedCredits: 5 }),
    ).toBe(true);
  });

  test('confirm copy surfaces credit count and mode clearly', () => {
    const copy = buildVideoConfirmCopy({
      mode: 'standard',
      durationSeconds: 8,
      resolution: '1080p',
      referenceImageCount: 2,
      estimatedCredits: 13,
    });
    expect(copy.headline).toBe('This Standard render will use 13 video credits. Continue?');
    expect(copy.detail).toContain('Standard 8s at 1080p');
    expect(copy.detail).toContain('2 reference images');
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
