import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import Integrations from './Integrations';
import { renderWithProviders } from '../test/renderWithProviders';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  API_BASE_URL: 'http://localhost:3001/api',
  api: mockApi,
}));

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.get.mockResolvedValue({
    available: [
      {
        id: 'slack',
        name: 'Slack',
        category: 'Messaging',
        section: 'messaging',
        authMode: 'oauth',
        configured: false,
        color: '#4CC9F0',
        supportsPublish: true,
      },
    ],
    connected: [],
  });
});

test('Integrations route module renders without lazy import errors', async () => {
  renderWithProviders(<Integrations />, { route: '/app/integrations' });

  expect(screen.getByRole('heading', { name: 'Link the full account stack without losing the plot' })).toBeInTheDocument();
  expect(await screen.findByText('Recommended linking flow')).toBeInTheDocument();
  expect((await screen.findAllByText('Slack')).length).toBeGreaterThan(0);
});
