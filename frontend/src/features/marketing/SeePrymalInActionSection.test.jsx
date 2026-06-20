import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SeePrymalInActionSection } from './SeePrymalInActionSection';
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

test('SeePrymalInActionSection renders concrete examples and trust strip', () => {
  window.prymalTrack = vi.fn();
  renderWithProviders(<SeePrymalInActionSection />);

  expect(screen.getByRole('heading', { name: 'See Prymal in action' })).toBeInTheDocument();
  expect(screen.getByText('Build me a 30-day content strategy')).toBeInTheDocument();
  expect(screen.getByText('Full content calendar')).toBeInTheDocument();
  expect(screen.getByText('Platform-specific posts')).toBeInTheDocument();
  expect(screen.getByText('Ready-to-publish content')).toBeInTheDocument();
  expect(screen.getByText('Audit my website')).toBeInTheDocument();
  expect(screen.getByText('UX improvements suggested')).toBeInTheDocument();
  expect(screen.getByText('Actionable roadmap')).toBeInTheDocument();
  expect(screen.getByText('Create a lead generation workflow for agencies.')).toBeInTheDocument();
  expect(screen.getByText('Workflow steps')).toBeInTheDocument();
  expect(screen.getByText('Built for founders, operators and agencies who need AI to execute, not just respond.')).toBeInTheDocument();
  expect(screen.getByText('Memory-aware workflows')).toBeInTheDocument();
  expect(window.prymalTrack).toHaveBeenCalledWith(
    'see_prymal_action_viewed',
    expect.objectContaining({
      selectedExample: 'content_strategy',
      surface: 'landing',
      signedIn: false,
    }),
  );
});

test('SeePrymalInActionSection routes signed-out CTA through signup with simple intent', async () => {
  const user = userEvent.setup();
  window.prymalTrack = vi.fn();
  renderWithProviders(<SeePrymalInActionSection />);

  const cta = screen.getByRole('link', { name: 'Try a guided task' });
  expect(cta).toHaveAttribute('href', '/signup?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple');
  expect(cta).toHaveAttribute('data-event', 'see_prymal_action_cta_clicked');

  await user.click(cta);

  expect(window.prymalTrack).toHaveBeenCalledWith(
    'see_prymal_action_cta_clicked',
    expect.objectContaining({
      route: '/signup?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple',
      selectedExample: 'content_strategy',
      signedIn: false,
    }),
  );
  expect(window.sessionStorage.getItem('prymal_start_intent')).toBe('simple');
  expect(window.sessionStorage.getItem('prymal_start_redirect')).toBe('/app/dashboard?intent=simple');
});

test('SeePrymalInActionSection routes signed-in CTA directly to simple dashboard start', () => {
  authState.isSignedIn = true;
  renderWithProviders(<SeePrymalInActionSection signedIn />);

  expect(screen.getByRole('link', { name: 'Try a guided task' })).toHaveAttribute('href', '/app/dashboard?intent=simple');
});

test('SeePrymalInActionSection still renders when analytics or reduced motion are constrained', () => {
  window.prymalTrack = vi.fn(() => {
    throw new Error('analytics unavailable');
  });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  expect(() => renderWithProviders(<SeePrymalInActionSection />)).not.toThrow();
  expect(screen.getByRole('heading', { name: 'See Prymal in action' })).toBeInTheDocument();
});
