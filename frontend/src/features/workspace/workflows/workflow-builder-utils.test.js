import { describe, expect, test } from 'vitest';
import {
  getTriggerConfigError,
  getWorkflowDraftValidation,
  humaniseCron,
} from './workflow-builder-utils';

function buildNode(id, agentName, prompt, outputVar, conditions = []) {
  return {
    id,
    data: {
      agentName,
      label: agentName,
      prompt,
      outputVar,
      conditions,
    },
  };
}

describe('workflow builder utils', () => {
  test('humanises known cron expressions', () => {
    expect(humaniseCron('0 8 * * 1')).toBe('Every Monday at 08:00');
  });

  test('validates trigger-specific requirements', () => {
    expect(getTriggerConfigError('schedule', {})).toContain('Cron expression is required');
    expect(getTriggerConfigError('event', {})).toContain('Event type is required');
    expect(getTriggerConfigError('manual', {})).toBeNull();
  });

  test('blocks saving when prompts or output vars are missing', () => {
    const validation = getWorkflowDraftValidation({
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [buildNode('a', 'CIPHER', '', 'summary')],
      edges: [],
    });

    expect(validation.readyToSave).toBe(false);
    expect(validation.blockingIssues[0]).toContain('Add a prompt');
  });

  test('catches duplicate output vars and incomplete conditions', () => {
    const validation = getWorkflowDraftValidation({
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        buildNode('a', 'CIPHER', 'Analyse the numbers', 'shared_output'),
        buildNode('b', 'LEDGER', 'Write the narrative', 'shared_output', [{ field: '', operator: 'contains', value: '' }]),
      ],
      edges: [{ source: 'a', target: 'b' }],
    });

    expect(validation.readyToSave).toBe(false);
    expect(validation.blockingIssues.some((issue) => issue.includes('Output variables must be unique'))).toBe(true);
    expect(validation.blockingIssues.some((issue) => issue.includes('condition fields'))).toBe(true);
  });

  test('guides users when a multi-step graph is not connected yet', () => {
    const validation = getWorkflowDraftValidation({
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        buildNode('a', 'SCOUT', 'Find the opportunity', 'market_signal'),
        buildNode('b', 'FORGE', 'Write the draft', 'article_draft'),
      ],
      edges: [],
    });

    expect(validation.readyToSave).toBe(true);
    expect(validation.guidance.some((issue) => issue.includes('Connect your steps'))).toBe(true);
  });
});
