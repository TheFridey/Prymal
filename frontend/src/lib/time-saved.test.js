import { describe, expect, test } from 'vitest';
import {
  DEFAULT_HOURLY_RATE_GBP,
  TIME_SAVED_WEIGHTS,
  buildTimeSavedInputFromViewer,
  estimateTimeSaved,
  estimateTimeSavedFromApiStats,
  formatSavedMinutes,
} from './time-saved';

describe('time-saved', () => {
  test('returns empty state when there is no activity', () => {
    const result = estimateTimeSaved({});

    expect(result.isEmpty).toBe(true);
    expect(result.minutesTotal).toBe(0);
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
    expect(result.minutesTotal).toBe(expectedMinutes);
    expect(result.workflowsRun).toBe(2);
    expect(result.estimatedValueGbp).toBe(Math.round((expectedMinutes / 60) * 40));
  });

  test('estimateTimeSavedFromApiStats uses separate week and month counts', () => {
    const result = estimateTimeSavedFromApiStats({
      periods: {
        week: {
          label: 'Last 7 days',
          counts: { conversations: 2, workflowRuns: 1 },
        },
        month: {
          label: 'This billing cycle',
          counts: { conversations: 5, workflowRuns: 2, contentAssets: 1 },
        },
      },
    });

    const weekMinutes = 2 * TIME_SAVED_WEIGHTS.agentChatCompleted + TIME_SAVED_WEIGHTS.workflowRunCompleted;
    const monthMinutes =
      5 * TIME_SAVED_WEIGHTS.agentChatCompleted
      + 2 * TIME_SAVED_WEIGHTS.workflowRunCompleted
      + TIME_SAVED_WEIGHTS.contentOrCampaignOutput;

    expect(result.week.minutesTotal).toBe(weekMinutes);
    expect(result.month.minutesTotal).toBe(monthMinutes);
    expect(result.week.label).toBe('Last 7 days');
    expect(result.month.label).toBe('This billing cycle');
    expect(result.isEmpty).toBe(false);
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
