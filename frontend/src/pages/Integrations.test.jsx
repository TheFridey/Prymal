import { fireEvent, screen, within } from '@testing-library/react';
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

test('LinkedIn card uses OAuth copy and no manual token field', async () => {
  mockApi.get.mockResolvedValueOnce({
    available: [
      {
        id: 'linkedin',
        name: 'LinkedIn',
        category: 'Social',
        section: 'socials',
        authMode: 'oauth',
        configured: true,
        color: '#0A66C2',
        supportsPublish: true,
        settingsFields: [
          {
            key: 'authorUrn',
            label: 'Author URN',
            placeholder: 'urn:li:organization:123456',
            helpText: 'Use urn:li:person:<id> for personal posting or urn:li:organization:<id> for company posting.',
          },
        ],
      },
    ],
    connected: [],
  });

  renderWithProviders(<Integrations />, { route: '/app/integrations' });

  expect((await screen.findAllByText('LinkedIn')).length).toBeGreaterThan(0);
  expect(screen.getByText('OAuth')).toBeInTheDocument();
  expect(screen.queryByText(/LinkedIn post token/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/member or organisation token/i)).not.toBeInTheDocument();
});

test('LinkedIn connected card shows author selector and reconnect warning when degraded', async () => {
  mockApi.get.mockResolvedValueOnce({
    available: [
      {
        id: 'linkedin',
        name: 'LinkedIn',
        category: 'Social',
        section: 'socials',
        authMode: 'oauth',
        configured: true,
        color: '#0A66C2',
        supportsPublish: true,
        targetLabel: 'Author URN',
        settingsFields: [
          { key: 'authorUrn', label: 'Author URN', placeholder: 'urn:li:organization:123456' },
          { key: 'defaultVisibility', label: 'Default visibility', input: 'select', options: ['PUBLIC', 'CONNECTIONS'] },
        ],
      },
    ],
    connected: [
      {
        id: 'int_1',
        service: 'linkedin',
        name: 'LinkedIn',
        authMode: 'oauth',
        accountEmail: 'owner@example.com',
        scopes: ['w_organization_social'],
        meta: {
          needsReconnect: true,
          reconnectMessage: 'LinkedIn now uses OAuth. Please reconnect LinkedIn to continue publishing.',
          settings: { authorUrn: 'urn:li:organization:115856278' },
          health: { status: 'degraded', message: 'LinkedIn now uses OAuth. Please reconnect LinkedIn to continue publishing.' },
          profile: {
            name: 'Prymal Owner',
            availableAuthors: [
              { urn: 'urn:li:person:abc123', name: 'Prymal Owner', type: 'person' },
              { urn: 'urn:li:organization:115856278', name: 'Prymal', type: 'organization' },
            ],
          },
        },
      },
    ],
  });

  renderWithProviders(<Integrations />, { route: '/app/integrations' });

  expect((await screen.findAllByText(/reconnect LinkedIn to continue publishing/i)).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /manage/i }));

  const [authorSelect] = await screen.findAllByRole('combobox', { name: /author urn/i });
  expect(within(authorSelect).getByText(/Prymal \(organization\)/i)).toBeInTheDocument();
  expect(screen.queryByText(/LinkedIn post token/i)).not.toBeInTheDocument();
});

test('LinkedIn identity-only connection is connected but publishing is not ready', async () => {
  mockApi.get.mockResolvedValueOnce({
    available: [
      {
        id: 'linkedin',
        name: 'LinkedIn',
        category: 'Social',
        section: 'socials',
        authMode: 'oauth',
        configured: true,
        color: '#0A66C2',
        supportsPublish: true,
        targetLabel: 'Author URN',
        settingsFields: [
          { key: 'authorUrn', label: 'Author URN', placeholder: 'urn:li:organization:123456' },
        ],
      },
    ],
    connected: [
      {
        id: 'int_identity',
        service: 'linkedin',
        name: 'LinkedIn',
        authMode: 'oauth',
        accountEmail: 'owner@example.com',
        scopes: ['openid', 'profile', 'email'],
        postingNotReady: true,
        publishDisabled: true,
        meta: {
          settings: { authorUrn: 'urn:li:person:abc123' },
          health: { status: 'healthy', message: 'Connected as Prymal Owner' },
          profile: { name: 'Prymal Owner' },
        },
      },
    ],
  });

  renderWithProviders(<Integrations />, { route: '/app/integrations' });

  expect(await screen.findByText(/Connected for identity/i)).toBeInTheDocument();
  expect(screen.getByText(/Posting requires LinkedIn posting permissions/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /manage/i }));
  const publishButton = await screen.findByRole('button', { name: /send live post/i });
  expect(publishButton).toBeDisabled();
  expect(screen.queryByText(/LinkedIn post token/i)).not.toBeInTheDocument();
});

test('manual integrations keep credential input UX', async () => {
  mockApi.get.mockResolvedValueOnce({
    available: [
      {
        id: 'discord',
        name: 'Discord',
        category: 'Messaging',
        section: 'messaging',
        authMode: 'manual_token',
        configured: true,
        color: '#5865F2',
        supportsPublish: true,
        secretLabel: 'Discord bot token',
        secretPlaceholder: 'Discord bot token',
        settingsFields: [{ key: 'defaultChannelId', label: 'Default channel ID', placeholder: '1234567890' }],
      },
    ],
    connected: [],
  });

  renderWithProviders(<Integrations />, { route: '/app/integrations' });

  fireEvent.click(await screen.findByRole('button', { name: /connect/i }));
  fireEvent.click(await screen.findByRole('button', { name: /open credential form/i }));
  expect(await screen.findByLabelText(/Discord bot token/i)).toBeInTheDocument();
});

test('webhook integrations show endpoint URL settings', async () => {
  mockApi.get.mockResolvedValueOnce({
    available: [
      {
        id: 'custom_webhook',
        name: 'Custom Webhook',
        category: 'Custom',
        section: 'custom',
        authMode: 'manual_token',
        configured: true,
        color: '#F97316',
        supportsPublish: true,
        secretLabel: 'Bearer token (optional)',
        secretPlaceholder: 'Optional',
        settingsFields: [{ key: 'endpointUrl', label: 'Webhook URL', placeholder: 'https://example.com/hook' }],
      },
    ],
    connected: [],
  });

  renderWithProviders(<Integrations />, { route: '/app/integrations' });

  expect((await screen.findAllByText('Custom Webhook')).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /connect/i }));
  fireEvent.click(await screen.findByRole('button', { name: /open credential form/i }));
  expect(await screen.findByText(/Webhook URL/i)).toBeInTheDocument();
});
