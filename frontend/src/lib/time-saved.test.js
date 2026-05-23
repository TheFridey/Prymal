import { describe, expect, test } from 'vitest';
import {
  DEFAULT_HOURLY_RATE_GBP,
  TIME_SAVED_WEIGHTS,
  buildTimeSavedInputFromViewer,
  estimateTimeSaved,
  formatSavedMinutes,
} from './time-saved';

describe('time-saved', () => {
  test('returns empty state when there is no activity', () => {
    const result = estimateTimeSaved({});

    expect(result.isEmpty).toBe(true);
    expect(result.minutesMonth).toBe(0);
    expect(result.minutesWeek).toBe(0);
    expect(result.estimatedValueGbp).toBe(0);
    expect(result.completedTasks).toBe(0);
  });

  test('applies configurable weights and value estimate', () => {
    const result = estimateTimeSaved({
      conversations: 4,
      workflowRuns: 2,
      contentAssets: 1,
      hourlyRateGbp: 40,
    });

    const expectedMinutes =
      4 * TIME_SAVED_WEIGHTS.agentChatCompleted
      + 2 * TIME_SAVED_WEIGHTS.workflowRunCompleted
      + 1 * TIME_SAVED_WEIGHTS.contentOrCampaignOutput;

    expect(result.isEmpty).toBe(false);
    expect(result.minutesMonth).toBe(expectedMinutes);
    expect(result.minutesWeek).toBe(Math.min(expectedMinutes, Math.round(expectedMinutes * 0.35)));
    expect(result.workflowsRun).toBe(2);
    expect(result.estimatedValueGbp).toBe(Math.round((expectedMinutes / 60) * 40));
  });

  test('buildTimeSavedInputFromViewer merges billing stats when present', () => {
    const input = buildTimeSavedInputFromViewer(
      { stats: { conversationCount: 2, contentAssets: 1 } },
      { conversations: 5, workflowRuns: 3, loreDocuments: 2 },
    );

    expect(input.conversations).toBe(5);
    expect(input.workflowRuns).toBe(3);
    expect(input.loreDocuments).toBe(2);
    expect(input.contentAssets).toBe(1);
  });

  test('formatSavedMinutes renders hours and minutes', () => {
    expect(formatSavedMinutes(0)).toBe('0m');
    expect(formatSavedMinutes(45)).toBe('45m');
    expect(formatSavedMinutes(90)).toBe('1h 30m');
  });

  test('uses default hourly rate when not overridden', () => {
    const result = estimateTimeSaved({ conversations: 6 });
    expect(result.hourlyRateGbp).toBe(DEFAULT_HOURLY_RATE_GBP);
  });
});
