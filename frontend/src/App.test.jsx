import { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ProtectedOnly } from './App';
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
  global.fetch = vi.fn(async (_url, init = {}) =>
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
