import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SimpleAdvancedModeSection } from './SimpleAdvancedModeSection';
import { renderWithProviders } from '../../test/renderWithProviders';

const authState = vi.hoisted(() => ({ isSignedIn: false }));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isSignedIn: authState.isSignedIn }),
}));

beforeEach(() => {
  authState.isSignedIn = false;
  window.sessionStorage.clear();
  delete window.prymalTrack;
});

test('SimpleAdvancedModeSection defaults to Simple Mode', () => {
  window.prymalTrack = vi.fn();
  renderWithProviders(<SimpleAdvancedModeSection />);

  expect(screen.getByRole('tab', { name: 'Simple Mode' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Advanced Mode' })).toHaveAttribute('aria-selected', 'false');
  expect(screen.getByRole('heading', { name: 'Start with one task' })).toBeInTheDocument();
  expect(screen.getByText('Guided tasks for getting value quickly.')).toBeInTheDocument();
  expect(screen.getByText('Most popular starting point')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Generate a 30-day content plan' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start with this' })).toHaveAttribute('data-event', 'simple_mode_default_win_clicked');
  expect(screen.getByRole('link', { name: 'Start with a task' })).toHaveAttribute('data-event', 'simple_mode_cta_clicked');
  expect(window.prymalTrack).toHaveBeenCalledWith(
    'simple_advanced_mode_viewed',
    expect.objectContaining({ surface: 'landing', selectedMode: 'simple' }),
  );
});

test('SimpleAdvancedModeSection reveals advanced content after toggle click', async () => {
  const user = userEvent.setup();
  window.prymalTrack = vi.fn();
  renderWithProviders(<SimpleAdvancedModeSection />);

  await user.click(screen.getByRole('tab', { name: 'Advanced Mode' }));

  expect(screen.getByRole('tab', { name: 'Advanced Mode' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('heading', { name: 'Scale into the full AI operating system' })).toBeInTheDocument();
  expect(screen.getByText('Multi-Agent Workflows')).toBeInTheDocument();
  expect(screen.getByText("You're viewing the full AI operating system.")).toBeInTheDocument();
  expect(screen.getByText('Built for repeatable workflows, client work and high-volume execution.')).toBeInTheDocument();
  expect(screen.getByText("You don't need to start here, but it's ready when you need more control.")).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Used for serious execution' })).toBeInTheDocument();
  expect(screen.getByText('Running client workflows')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Build a workflow' })).toHaveAttribute('href', '/signup?intent=advanced&redirect_url=%2Fapp%2Fworkflows');
  expect(screen.getByRole('link', { name: 'Build a workflow' })).toHaveAttribute('data-event', 'advanced_mode_cta_clicked');
  expect(window.prymalTrack).toHaveBeenCalledWith(
    'advanced_mode_selected',
    expect.objectContaining({ surface: 'landing', selectedMode: 'advanced' }),
  );
});

test('SimpleAdvancedModeSection keeps Advanced Mode reassurance out of Simple Mode', () => {
  renderWithProviders(<SimpleAdvancedModeSection />);

  expect(screen.getByRole('tab', { name: 'Simple Mode' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText("You don't need to start here, but it's ready when you need more control.")).not.toBeInTheDocument();
});

test('compact SimpleAdvancedModeSection surfaces onboarding paths', async () => {
  const user = userEvent.setup();
  renderWithProviders(<SimpleAdvancedModeSection variant="compact" />);

  expect(screen.getByRole('heading', { name: 'Choose how you want to start' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Start with a guided task' })).toBeInTheDocument();
  expect(screen.getByText('Pick a simple workflow and get a useful result fast.')).toBeInTheDocument();
  expect(screen.getByText('Website audit')).toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Advanced Mode' }));

  expect(screen.getByRole('heading', { name: 'Build a custom workflow' })).toBeInTheDocument();
  expect(screen.getByText('Start with agents, memory and workflow logic from day one.')).toBeInTheDocument();
  expect(screen.getByText('LORE setup')).toBeInTheDocument();
});

test('SimpleAdvancedModeSection tracks CTA clicks', async () => {
  const user = userEvent.setup();
  window.prymalTrack = vi.fn();
  renderWithProviders(<SimpleAdvancedModeSection />);

  await user.click(screen.getByRole('link', { name: 'Start with this' }));

  expect(window.prymalTrack).toHaveBeenCalledWith(
    'simple_mode_default_win_clicked',
    expect.objectContaining({
      surface: 'landing',
      selectedMode: 'simple',
      ctaType: 'default_win',
      route: '/signup?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple',
    }),
  );
  expect(window.sessionStorage.getItem('prymal_start_intent')).toBe('simple');
  expect(window.sessionStorage.getItem('prymal_start_redirect')).toBe('/app/dashboard?intent=simple');
});

test('SimpleAdvancedModeSection routes signed-out CTAs through signup with intent', async () => {
  const user = userEvent.setup();
  renderWithProviders(<SimpleAdvancedModeSection />);

  expect(screen.getByRole('link', { name: 'Start with a task' })).toHaveAttribute(
    'href',
    '/signup?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple',
  );

  await user.click(screen.getByRole('tab', { name: 'Advanced Mode' }));

  expect(screen.getByRole('link', { name: 'Build a workflow' })).toHaveAttribute(
    'href',
    '/signup?intent=advanced&redirect_url=%2Fapp%2Fworkflows',
  );
});

test('SimpleAdvancedModeSection routes signed-in CTAs directly into the app', async () => {
  const user = userEvent.setup();
  authState.isSignedIn = true;
  renderWithProviders(<SimpleAdvancedModeSection />);

  expect(screen.getByRole('link', { name: 'Start with a task' })).toHaveAttribute('href', '/app/dashboard?intent=simple');
  expect(screen.getByRole('link', { name: 'Start with this' })).toHaveAttribute('href', '/app/dashboard?intent=simple');

  await user.click(screen.getByRole('tab', { name: 'Advanced Mode' }));

  expect(screen.getByRole('link', { name: 'Build a workflow' })).toHaveAttribute('href', '/app/workflows');
});
