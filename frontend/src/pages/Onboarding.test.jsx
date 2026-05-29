import { fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Onboarding from './Onboarding';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  STARTER_OUTCOMES,
  recommendStarterOutcome,
} from '../lib/first-run-outcomes';

vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isSignedIn: true }),
}));

const { api } = await import('../lib/api');

// ─── Route rendering ──────────────────────────────────────────────────────────

test('step 1 renders the workspace type options', () => {
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });
  expect(view.getByTestId('onboarding-org-name')).toBeInTheDocument();
  expect(view.getByRole('button', { name: /agency/i })).toBeInTheDocument();
  expect(view.getByRole('button', { name: /continue to first win/i })).toBeDisabled();
});

test('continue button enables once org name has 2+ chars', async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });
  const input = view.getByTestId('onboarding-org-name');
  await user.type(input, 'AB');
  await waitFor(() =>
    expect(view.getByRole('button', { name: /continue to first win/i })).not.toBeDisabled(),
  );
});

test('step 2 renders all 5 starter outcomes', async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });
  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  for (const outcome of STARTER_OUTCOMES) {
    expect(view.getByTestId(`starter-outcome-${outcome.id}`)).toBeInTheDocument();
  }
});

test('step 2 renders source of truth field with paste text and URL tabs', async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });
  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  expect(view.getByTestId('onboarding-source-of-truth-text')).toBeInTheDocument();
  await user.click(view.getByRole('button', { name: /url/i }));
  expect(view.getByTestId('onboarding-source-of-truth-url')).toBeInTheDocument();
});

// ─── Outcome selection ────────────────────────────────────────────────────────

test('clicking a starter outcome marks it as selected', async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });
  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  const leadAuditBtn = view.getByTestId('starter-outcome-lead_audit');
  await user.click(leadAuditBtn);
  expect(leadAuditBtn.className).toContain('pm-onboarding__option--selected');
});

test('auto-recommends weekly_business_report for run-weekly-reporting goal', async () => {
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });
  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  // Change primary goal to "Run weekly reporting"
  fireEvent.change(view.getByDisplayValue('Win and progress more leads'), {
    target: { value: 'Run weekly reporting' },
  });

  await waitFor(() => {
    const btn = view.getByTestId('starter-outcome-weekly_business_report');
    expect(btn.className).toContain('pm-onboarding__option--selected');
  });
});

// ─── API payload safety ───────────────────────────────────────────────────────

test('submits starter outcome ID in the API payload', async () => {
  api.post.mockClear();
  api.post.mockResolvedValue({ organisation: { id: 'org_1' } });
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });

  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  await user.click(view.getByTestId('starter-outcome-client_proposal'));
  await user.click(view.getByRole('button', { name: /create workspace and open/i }));

  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/auth/onboard',
      expect.objectContaining({ starterOutcomeId: 'client_proposal' }),
    ),
  );
});

test('truncates sourceOfTruth value to 1000 chars in payload', async () => {
  api.post.mockClear();
  api.post.mockResolvedValue({ organisation: { id: 'org_1' } });
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });

  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));

  // maxLength attr limits textarea input; we test the slice in the payload
  fireEvent.change(view.getByTestId('onboarding-source-of-truth-text'), {
    target: { value: 'a'.repeat(999) },
  });
  await user.click(view.getByRole('button', { name: /create workspace and open/i }));

  await waitFor(() => {
    const matchingCall = api.post.mock.calls.find(
      (call) => call[0] === '/auth/onboard' && call[1]?.sourceOfTruth?.type === 'text',
    );
    expect(matchingCall).toBeDefined();
    expect(matchingCall[1].sourceOfTruth.value.length).toBeLessThanOrEqual(1000);
  });
});

test('omits sourceOfTruth from payload when left empty', async () => {
  api.post.mockClear();
  api.post.mockResolvedValue({ organisation: { id: 'org_1' } });
  const user = userEvent.setup();
  const view = renderWithProviders(<Onboarding />, { route: '/app/onboarding' });

  fireEvent.change(view.getByTestId('onboarding-org-name'), { target: { value: 'Test Org' } });
  await user.click(view.getByRole('button', { name: /continue to first win/i }));
  await user.click(view.getByRole('button', { name: /create workspace and open/i }));

  await waitFor(() => {
    const call = api.post.mock.calls.at(-1);
    expect(call[1].sourceOfTruth).toBeUndefined();
  });
});

test('invite-token path skips to step 2 without org name', () => {
  const view = renderWithProviders(<Onboarding />, {
    route: '/app/onboarding?invite=abc1234567890xyz',
  });
  expect(view.queryByTestId('onboarding-org-name')).not.toBeInTheDocument();
  expect(view.getByTestId('onboarding-submit')).toBeInTheDocument();
});

// ─── recommendStarterOutcome unit tests ──────────────────────────────────────

test('recommendStarterOutcome returns lead_audit for Recruitment + Win leads', () => {
  const result = recommendStarterOutcome('Recruitment', 'Win and progress more leads');
  expect(result.id).toBe('lead_audit');
});

test('recommendStarterOutcome returns seo_aeo_brief for SaaS + Ship content', () => {
  const result = recommendStarterOutcome('SaaS', 'Ship content faster');
  expect(result.id).toBe('seo_aeo_brief');
});

test('recommendStarterOutcome returns weekly_business_report for run-reporting goal regardless of business type', () => {
  const result = recommendStarterOutcome('Unknown corp', 'Run weekly reporting');
  expect(result.id).toBe('weekly_business_report');
});

test('recommendStarterOutcome returns support_knowledge_base for SaaS + Centralise knowledge', () => {
  const result = recommendStarterOutcome('SaaS', 'Centralise knowledge and SOPs');
  expect(result.id).toBe('support_knowledge_base');
});

test('recommendStarterOutcome falls back to first outcome for unknown inputs', () => {
  const result = recommendStarterOutcome('', '');
  expect(result).toBe(STARTER_OUTCOMES[0]);
});

test('all STARTER_OUTCOMES have required fields', () => {
  for (const outcome of STARTER_OUTCOMES) {
    expect(outcome.id).toBeTruthy();
    expect(outcome.title).toBeTruthy();
    expect(outcome.route).toBeTruthy();
    expect(outcome.recommendedAgentId).toBeTruthy();
    expect(Array.isArray(outcome.starterPrompts)).toBe(true);
    expect(outcome.starterPrompts.length).toBeGreaterThan(0);
    expect(outcome.fitFor.businessTypes.length).toBeGreaterThan(0);
    expect(outcome.fitFor.primaryGoals.length).toBeGreaterThan(0);
  }
});
