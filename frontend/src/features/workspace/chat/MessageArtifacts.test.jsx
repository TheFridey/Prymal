import { fireEvent, screen } from '@testing-library/react';
import { SourceCard } from './MessageArtifacts';
import { renderWithProviders } from '../../../test/renderWithProviders';

test('SourceCard shows ranking details for scored lore sources', () => {
  renderWithProviders(
    <SourceCard
      source={{
        documentTitle: 'Pricing handbook',
        sourceType: 'markdown',
        similarity: 0.82,
        lexicalScore: 0.31,
        freshnessScore: 0.74,
        authorityScore: 0.91,
        finalScore: 0.79,
        confidenceLabel: 'high',
        retrievalMode: 'hybrid',
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Why this source won' }));

  expect(screen.getByText('Ranking signal mix')).toBeInTheDocument();
  expect(screen.getByText('82%')).toBeInTheDocument();
  expect(screen.getByText('31%')).toBeInTheDocument();
  expect(screen.getByText('74%')).toBeInTheDocument();
  expect(screen.getByText('91%')).toBeInTheDocument();
  expect(screen.getByText('79%')).toBeInTheDocument();
});

test('SourceCard shows neutral source details for direct web sources without fake zero scores', () => {
  renderWithProviders(
    <SourceCard
      source={{
        title: 'Guide: How to Say "What Are Your Plans for Today"',
        sourceType: 'web',
        sourceUrl: 'https://example.com/source',
        mode: 'direct',
        fetchedVia: 'search',
        summary: 'Useful source summary.',
        snippet: 'Useful source snippet.',
        similarity: null,
        lexicalScore: null,
        freshnessScore: null,
        authorityScore: null,
        finalScore: null,
      }}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Source details' }));

  expect(screen.queryByText('Ranking signal mix')).not.toBeInTheDocument();
  expect(screen.getByText('Selection method')).toBeInTheDocument();
  expect(screen.getByText('Live web Search')).toBeInTheDocument();
  expect(screen.queryByText('No confidence label')).not.toBeInTheDocument();
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
});
