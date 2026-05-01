import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import WorkflowCatalogue from './WorkflowCatalogue';
import WorkflowCatalogueDetail from './WorkflowCatalogueDetail';
import AdminWorkflowCatalogue from './AdminWorkflowCatalogue';
import { renderWithProviders } from '../test/renderWithProviders';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: mockApi,
}));

const catalogueItem = {
  id: 'item-1',
  slug: '30-day-content-engine',
  title: '30-Day Content Engine',
  shortDescription: 'Turn one business goal into a month of content.',
  longDescription: 'A practical workflow for content planning.',
  category: 'Content',
  tags: ['content', 'simple'],
  difficulty: 'beginner',
  pricingType: 'free',
  publisherType: 'prymal_official',
  estimatedExecutionCredits: 8,
  estimatedVideoCredits: 0,
  estimatedCostGbp: 0.08,
  expectedRuntimeLabel: '5-8 minutes',
  installCount: 12,
  ratingAverage: 4.8,
  expectedOutput: ['Content calendar', 'Post ideas'],
  requiredInputs: ['Business goal'],
  templateWorkflowDefinition: {
    triggerType: 'manual',
    nodes: [
      { id: 'a', agentId: 'forge', label: 'Campaign strategy', outputVar: 'strategy' },
      { id: 'b', agentId: 'echo', label: 'Calendar builder', outputVar: 'calendar' },
    ],
  },
};

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
});

test('WorkflowCatalogue renders categories, filters, and cards', async () => {
  mockApi.get.mockResolvedValue({ items: [catalogueItem] });
  renderWithProviders(<WorkflowCatalogue />, { route: '/app/workflows/catalogue' });

  expect(screen.getByRole('heading', { name: 'Workflow Catalogue' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Marketing' })).toBeInTheDocument();
  expect((await screen.findAllByText('30-Day Content Engine')).length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Pricing filter')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Simple or advanced filter' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Simple' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
  expect(screen.getAllByText('Official').length).toBeGreaterThan(0);
});

test('WorkflowCatalogue filters call the API with selected difficulty', async () => {
  const user = userEvent.setup();
  mockApi.get.mockResolvedValue({ items: [catalogueItem] });
  renderWithProviders(<WorkflowCatalogue />, { route: '/app/workflows/catalogue' });

  expect((await screen.findAllByText('30-Day Content Engine')).length).toBeGreaterThan(0);
  await user.selectOptions(screen.getByLabelText('Difficulty filter'), 'beginner');

  await waitFor(() => {
    expect(mockApi.get).toHaveBeenLastCalledWith(expect.stringContaining('difficulty=beginner'));
  });
});

test('WorkflowCatalogueDetail renders expected outputs and install CTA', async () => {
  mockApi.get.mockResolvedValue({ item: catalogueItem });
  renderWithProviders(
    <Routes>
      <Route path="/app/workflows/catalogue/:slug" element={<WorkflowCatalogueDetail />} />
    </Routes>,
    { route: '/app/workflows/catalogue/30-day-content-engine' },
  );

  await screen.findByRole('heading', { name: '30-Day Content Engine' });
  expect(screen.getAllByText('Content calendar').length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: 'Workflow blueprint' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Showcase in action' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: "What you'll get" })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: "What you'll need" })).toBeInTheDocument();
  expect(screen.getByText('Business goal')).toBeInTheDocument();
  expect(screen.getByText(/Checked for safe install/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Install workflow' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Duplicate & customise' })).toBeInTheDocument();
  expect(screen.getByText(/Installing is free. Running this workflow uses your normal Prymal credits/i)).toBeInTheDocument();
});

test('WorkflowCatalogueDetail renders premium disabled state', async () => {
  mockApi.get.mockResolvedValue({ item: { ...catalogueItem, pricingType: 'premium' } });
  renderWithProviders(
    <Routes>
      <Route path="/app/workflows/catalogue/:slug" element={<WorkflowCatalogueDetail />} />
    </Routes>,
    { route: '/app/workflows/catalogue/paid' },
  );

  await screen.findByRole('heading', { name: '30-Day Content Engine' });
  expect(screen.getByRole('button', { name: 'Purchase coming soon' })).toBeDisabled();
});

test('AdminWorkflowCatalogue renders pending queue and approval controls', async () => {
  mockApi.get.mockResolvedValue({ items: [{ ...catalogueItem, reviewStatus: 'pending', validationWarnings: ['External URL reference present.'] }] });
  renderWithProviders(<AdminWorkflowCatalogue />, { route: '/app/admin/workflow-catalogue' });

  await screen.findByText('30-Day Content Engine');
  expect(screen.getByText('External URL reference present.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
});
