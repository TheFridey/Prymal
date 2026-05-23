import { screen } from '@testing-library/react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from './Dashboard';
import { resolveDashboardRecommendation } from '../features/dashboard/dashboard-recommendations';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { firstName: 'Alex' } }),
}));

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(async (path) => {
      if (path.startsWith('/agents/conversations')) {
        return { conversations: [] };
      }
      if (path === '/workflows') {
        return { workflows: [] };
      }
      if (path === '/billing/stats') {
        return { conversations: 0, workflowRuns: 0, loreDocuments: 0 };
      }
      if (path === '/org/learning-signals') {
        return null;
      }
      return {};
    }),
  },
}));

const baseViewer = {
  user: { id: 'user_test', firstName: 'Alex' },
  organisation: { name: 'Acme Studio', plan: 'free' },
  stats: { conversationCount: 0, trainedOnRuns: 0, loreDocuments: 0 },
  credits: {
    execution: { used: 10, limit: 100, percentUsed: 10 },
    video: { used: 0, limit: 5, percentUsed: 0 },
  },
};

function renderDashboard(viewer = baseViewer) {
  function Layout() {
    return <Outlet context={{ viewer }} />;
  }

  return renderWithProviders(
    <Routes>
      <Route element={<Layout />}>
        <Route path="/app/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>,
    { route: '/app/dashboard' },
  );
}

test('dashboard command centre renders quick actions and credits chip', () => {
  renderDashboard();

  expect(screen.getByRole('heading', { name: /What do you want Prymal to help with today/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ask a specialist/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Run a workflow/i })).toBeInTheDocument();
  expect(screen.getByText(/Execution credits/i)).toBeInTheDocument();
});

test('resolveDashboardRecommendation suggests first win for new workspaces', () => {
  const recommendation = resolveDashboardRecommendation({
    hasMeaningfulProgress: false,
    conversationCount: 0,
    workflows: [],
    loreDocumentCount: 0,
  });

  expect(recommendation.recommendation_id).toBe('first_win');
  expect(recommendation.route).toBeTruthy();
});

test('resolveDashboardRecommendation suggests upgrade after meaningful progress on free plan', () => {
  const recommendation = resolveDashboardRecommendation({
    hasMeaningfulProgress: true,
    conversationCount: 4,
    workflows: [],
    loreDocumentCount: 2,
    currentPlan: 'free',
    recentConversations: [{ agentId: 'cipher' }],
  });

  expect(recommendation.recommendation_id).toBe('upgrade_pro');
});
