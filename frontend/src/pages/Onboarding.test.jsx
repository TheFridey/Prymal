import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Onboarding from './Onboarding';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

const { api } = await import('../lib/api');

test('Onboarding submits the first-win workspace payload', async () => {
  api.post.mockResolvedValue({ organisation: { id: 'org_1' } });
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding?ref=launch' });

  await user.type(view.getByPlaceholderText('Prymal Labs'), 'Launch Ops');
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  await user.selectOptions(view.getByDisplayValue('Marketing agency'), 'Consultancy');
  await user.selectOptions(view.getByDisplayValue('Win and progress more leads'), 'Build repeatable workflows');
  await user.click(view.getByRole('button', { name: /create workspace and open/i }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/onboard', expect.objectContaining({
    orgName: 'Launch Ops',
    businessType: 'Consultancy',
    primaryGoal: 'Build repeatable workflows',
    workspaceFocus: 'agency',
    referralCode: 'launch',
  })));
});
