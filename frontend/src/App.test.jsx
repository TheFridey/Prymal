import { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ProtectedOnly } from './auth/AuthRuntime';
import { resolveSignupOnboardingUrl } from './auth/signup-routing';
import { api } from './lib/api';

const mockGetToken = vi.fn();

vi.mock('@clerk/clerk-react', async () => {
  const actual = await vi.importActual('@clerk/clerk-react');
  return {
    ...actual,
    ClerkProvider: ({ children }) => children,
    RedirectToSignIn: () => null,
    SignIn: () => null,
    SignUp: () => null,
    useAuth: () => ({
      isLoaded: true,
      isSignedIn: true,
      getToken: mockGetToken,
    }),
  };
});

function RequestProbe() {
  useEffect(() => {
    void api.get('/auth/me');
  }, []);

  return <div>Probe</div>;
}

beforeEach(() => {
  mockGetToken.mockReset();
  mockGetToken.mockResolvedValue('token-from-clerk');
  global.fetch = vi.fn(async (_url, _init = {}) =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

test('binds Clerk auth before protected child requests fire', async () => {
  render(
    <ProtectedOnly>
      <RequestProbe />
    </ProtectedOnly>,
  );

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  const [, init] = global.fetch.mock.calls[0];
  const headers = new Headers(init?.headers ?? {});
  expect(headers.get('Authorization')).toBe('Bearer token-from-clerk');
});

test('preserves signup intent and allowed redirect for onboarding', () => {
  expect(resolveSignupOnboardingUrl('?intent=advanced&redirect_url=/app/workflows')).toBe(
    '/app/onboarding?intent=advanced&redirect_url=%2Fapp%2Fworkflows',
  );
  expect(resolveSignupOnboardingUrl('?intent=simple&redirect_url=/app/dashboard?intent=simple')).toBe(
    '/app/onboarding?intent=simple&redirect_url=%2Fapp%2Fdashboard%3Fintent%3Dsimple',
  );
  expect(resolveSignupOnboardingUrl('?intent=simple&redirect_url=/app/workflows/catalogue?mode=simple')).toBe(
    '/app/onboarding?intent=simple&redirect_url=%2Fapp%2Fworkflows%2Fcatalogue%3Fmode%3Dsimple',
  );
  expect(resolveSignupOnboardingUrl('?intent=simple&redirect_url=/app/workflows/catalogue/30-day-content-engine')).toBe(
    '/app/onboarding?intent=simple&redirect_url=%2Fapp%2Fworkflows%2Fcatalogue%2F30-day-content-engine',
  );
  expect(resolveSignupOnboardingUrl('?intent=advanced&redirect_url=https://example.com')).toBe(
    '/app/onboarding?intent=advanced',
  );
});
