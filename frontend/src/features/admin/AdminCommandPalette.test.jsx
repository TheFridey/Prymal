import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AdminCommandPalette } from './AdminCommandPalette';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const { api } = await import('../../lib/api');

function buildProps(overrides = {}) {
  return {
    organisations: [{ id: 'org_1', name: 'Prymal Labs', slug: 'prymal', plan: 'pro' }],
    users: [{ id: 'user_1', email: 'ops@prymal.ai', firstName: 'Ops', lastName: 'Lead', role: 'admin' }],
    onNavigateTab: vi.fn(),
    onSelectOrg: vi.fn(),
    onSelectUser: vi.fn(),
    onSelectTrace: vi.fn(),
    onSelectWorkflowRun: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

test('AdminCommandPalette shows default tab shortcuts before searching', async () => {
  api.get.mockResolvedValue({ results: [] });
  const props = buildProps();

  const view = renderWithProviders(<AdminCommandPalette {...props} />);

  expect(await view.findByText('Overview dashboard')).toBeInTheDocument();
  expect(view.getByText('Organisations')).toBeInTheDocument();
});

test('AdminCommandPalette routes a trace search result into the traces surface', async () => {
  api.get.mockResolvedValue({
    results: [
      {
        kind: 'trace',
        id: 'trace_1',
        traceId: 'trace_1',
        title: 'cipher via gpt-5.4',
        subtitle: 'succeeded | premium_reasoning',
        targetTab: 'traces',
      },
    ],
  });

  const props = buildProps();
  const user = userEvent.setup();
  const view = renderWithProviders(<AdminCommandPalette {...props} />);

  const input = view.getByPlaceholderText(/jump to a tab, organisation, user, trace/i);
  await user.type(input, 'cipher');

  await waitFor(() => expect(api.get).toHaveBeenCalled());
  const traceResult = await view.findByText('cipher via gpt-5.4');
  await user.click(traceResult);

  expect(props.onNavigateTab).toHaveBeenCalledWith('traces');
  expect(props.onSelectTrace).toHaveBeenCalledWith('trace_1');
  expect(props.onClose).toHaveBeenCalled();
});

test('AdminCommandPalette routes a billing entity search result into billing', async () => {
  api.get.mockResolvedValue({
    results: [
      {
        kind: 'billing_entity',
        id: 'cus_123',
        title: 'Stripe customer cus_123',
        subtitle: 'Prymal Labs | active subscription',
        targetTab: 'billing',
      },
    ],
  });

  const props = buildProps();
  const user = userEvent.setup();
  const view = renderWithProviders(<AdminCommandPalette {...props} />);

  const input = view.getByPlaceholderText(/jump to a tab, organisation, user, trace/i);
  await user.type(input, 'stripe');

  await waitFor(() => expect(api.get).toHaveBeenCalled());
  await user.click(await view.findByText('Stripe customer cus_123'));

  expect(props.onNavigateTab).toHaveBeenCalledWith('billing');
  expect(props.onClose).toHaveBeenCalled();
});
