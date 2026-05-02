import { describe, expect, test } from 'vitest';
import {
  FIRST_RUN_OUTCOMES,
  buildFirstWinPrompt,
  getOutcomeCreditIntensity,
  getRecommendedAgentForOutcome,
  getStarterPromptForOutcome,
} from './first-run-outcomes';

describe('first-run outcomes', () => {
  test('defines the six beta first-win outcomes', () => {
    expect(FIRST_RUN_OUTCOMES.map((outcome) => outcome.id)).toEqual([
      'create_content',
      'get_more_leads',
      'analyse_data',
      'automate_task',
      'business_knowledge',
      'media_asset',
    ]);
  });

  test('returns stable agent and credit recommendations', () => {
    expect(getRecommendedAgentForOutcome('create_content')).toBe('forge');
    expect(getRecommendedAgentForOutcome('business_knowledge')).toBe('lore');
    expect(getRecommendedAgentForOutcome('media_asset')).toBe('pixel');
    expect(getOutcomeCreditIntensity('automate_task')).toBe('Medium');
  });

  test('builds a structured first-win prompt', () => {
    const prompt = buildFirstWinPrompt('get_more_leads', {
      goal: 'Book calls with local accountants',
      audience: 'UK accountancy firms',
      tone: 'Direct and helpful',
      context: 'Offer: workflow automation setup',
      output: '3-message sequence',
    });

    expect(prompt).toContain('First outcome: Get more leads');
    expect(prompt).toContain('Recommended agent: VANCE');
    expect(prompt).toContain('Book calls with local accountants');
    expect(prompt).toContain('Source/context to use:');
  });

  test('falls back safely for unknown outcomes', () => {
    expect(getRecommendedAgentForOutcome('unknown')).toBe('cipher');
    expect(getStarterPromptForOutcome('unknown')).toBe('');
  });
});
