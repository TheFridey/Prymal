import { screen } from '@testing-library/react';
import { LearningSignalsSection, isLearningSignalsEmpty } from './Dashboard';
import { renderWithProviders } from '../test/renderWithProviders';

const COMPLETE_SIGNALS = {
  patternsLearned: {
    value: 42,
    label: 'Business patterns learned',
    trend: 'up',
    explanation: 'Derived from positive feedback.',
  },
  workflowsReusedThisWeek: {
    value: 3,
    label: 'Workflows reused this week',
    trend: 'flat',
    explanation: 'Counts run-again workflow runs.',
  },
  topPerformingContentFormat: {
    value: 'short LinkedIn post',
    label: 'Top performing format',
    confidence: 'medium',
    explanation: 'Based on 4 positive signals.',
  },
  brandVoiceConfidence: {
    value: 64,
    previousValue: 52,
    trend: 'up',
    explanation: 'Calculated from brand context.',
  },
  recentSignals: [
    {
      id: 'feedback-1',
      type: 'feedback',
      title: 'HERALD received success feedback',
      description: 'Outcome metric: clicks.',
      createdAt: new Date().toISOString(),
    },
  ],
};

test('LearningSignalsSection renders real metric values and recent signals', () => {
  renderWithProviders(<LearningSignalsSection signals={COMPLETE_SIGNALS} />);

  expect(screen.getByRole('heading', { name: 'Prymal is learning your business' })).toBeInTheDocument();
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('short LinkedIn post')).toBeInTheDocument();
  expect(screen.getByText('64%')).toBeInTheDocument();
  expect(screen.getByText('medium confidence')).toBeInTheDocument();
  expect(screen.getByText('HERALD received success feedback')).toBeInTheDocument();
});

test('LearningSignalsSection renders the safe empty state without fake metrics', () => {
  renderWithProviders(<LearningSignalsSection signals={null} />);

  expect(screen.getByText('Your learning layer is just getting started')).toBeInTheDocument();
  expect(screen.getByText(/Generate content, run workflows, publish outputs, or give feedback/i)).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Start a workflow' }).length).toBeGreaterThan(0);
  expect(screen.queryByText('Recent learning events')).not.toBeInTheDocument();
});

test('LearningSignalsSection handles partial and null metric fields safely', () => {
  renderWithProviders(
    <LearningSignalsSection
      signals={{
        patternsLearned: { value: 1, label: 'Business patterns learned', explanation: 'One signal exists.' },
        topPerformingContentFormat: { value: null, label: 'Top performing format', explanation: 'Not enough signal yet.' },
      }}
    />,
  );

  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('Not enough data')).toBeInTheDocument();
  expect(screen.getAllByText('Stable').length).toBeGreaterThan(0);
});

test('isLearningSignalsEmpty treats meaningful partial data as non-empty', () => {
  expect(isLearningSignalsEmpty(null)).toBe(true);
  expect(isLearningSignalsEmpty({ brandVoiceConfidence: { value: 12 } })).toBe(false);
  expect(isLearningSignalsEmpty({ recentSignals: [{ id: 'signal-1' }] })).toBe(false);
});
