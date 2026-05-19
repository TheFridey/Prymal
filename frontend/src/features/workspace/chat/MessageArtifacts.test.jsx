import { fireEvent, screen } from '@testing-library/react';
import { EvidenceDrawer } from './MessageArtifacts';
import { renderWithProviders } from '../../../test/renderWithProviders';

test('EvidenceDrawer shows only safe evidence fields for normal users', () => {
  renderWithProviders(
    <EvidenceDrawer
      evidenceSummary={{
        confidenceLevel: 'high',
        sourceCount: 1,
        sourceFreshness: 'fresh',
        contradictionSeverity: 'low',
        origins: ['workspace_knowledge', 'live_research'],
      }}
      sources={[
        {
          title: 'Pricing handbook',
          sourceUrl: 'https://example.com/pricing',
          origin: 'workspace_knowledge',
          freshness: 'fresh',
          confidenceLevel: 'high',
          contradictionWarning: 'A newer draft may change this point.',
          provider: 'hidden-provider',
          model: 'hidden-model',
        },
      ]}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /open evidence/i }));

  expect(screen.getByText(/Evidence confidence: high/i)).toBeInTheDocument();
  expect(screen.getAllByText(/workspace knowledge/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/live research/i)).toBeInTheDocument();
  expect(screen.getByText('Pricing handbook')).toBeInTheDocument();
  expect(screen.getByText(/A newer draft may change this point/i)).toBeInTheDocument();
  expect(screen.queryByText(/hidden-provider/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/hidden-model/i)).not.toBeInTheDocument();
});

test('EvidenceDrawer reports not enough evidence when no sources exist', () => {
  renderWithProviders(
    <EvidenceDrawer
      evidenceSummary={{
        confidenceLevel: 'low',
        sourceCount: 0,
        sourceFreshness: 'unknown',
        contradictionSeverity: 'none',
        notEnoughEvidence: true,
        missingEvidenceReason: 'Not enough evidence to verify all claims yet.',
        origins: [],
      }}
      sources={[]}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /open evidence/i }));

  expect(screen.getByText(/Evidence needs strengthening/i)).toBeInTheDocument();
  expect(screen.getByText(/Not enough evidence to verify all claims yet/i)).toBeInTheDocument();
});
