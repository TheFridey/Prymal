import { Suspense, lazy, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ClerkProvider,
  RedirectToSignIn,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  useAuth,
} from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import AppLayout from './components/AppLayout';
import { BrandMark, Button, InlineNotice, LoadingPanel, ThemeToggle } from './components/ui';
import { MotionPage } from './components/motion';
import { ThemeProvider, getClerkAppearance, useTheme } from './components/theme';
import { api, configureApi } from './lib/api';
import { useAppStore } from './stores/useAppStore';

const Admin = lazy(() => import('./pages/Admin'));
const AgentChat = lazy(() => import('./pages/AgentChat'));
const AgentProfile = lazy(() => import('./pages/AgentProfile'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Cookies = lazy(() => import('./pages/Cookies'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ForAgencies = lazy(() => import('./pages/ForAgencies'));
const ForSmallBusiness = lazy(() => import('./pages/ForSmallBusiness'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Landing = lazy(() => import('./pages/Landing'));
const Lore = lazy(() => import('./pages/Lore'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Settings = lazy(() => import('./pages/Settings'));
const Terms = lazy(() => import('./pages/Terms'));
const Workflows = lazy(() => import('./pages/Workflows'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { theme } = useTheme();
  const RoutedApp = import.meta.env.VITE_SENTRY_DSN
    ? Sentry.withErrorBoundary(AppRouter, { fallback: <AppErrorFallback /> })
    : AppRouter;

  // Capture ?ref= referral code from any page into sessionStorage
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (ref) sessionStorage.setItem('prymal_referral', ref);
  }, []);

  if (!CLERK_KEY) {
    return (
      <div className="auth-screen">
        <div className="setup-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
            <BrandMark />
            <ThemeToggle />
          </div>
          <div className="setup-screen__header">
            <div className="eyebrow" style={{ '--eyebrow-accent': 'var(--accent)' }}>Frontend setup</div>
            <h1 className="setup-screen__title">Set `VITE_CLERK_PUBLISHABLE_KEY` to start Prymal.</h1>
            <p className="setup-screen__copy">
              The frontend now guards this at runtime so the build still succeeds even when auth secrets are absent locally.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY} appearance={getClerkAppearance(theme)}>
      <QueryClientProvider client={queryClient}>
        <RoutedApp />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary label="Application">
        <Routes>
          <Route path="/" element={<LazyPage label="Loading Prymal..."><Landing /></LazyPage>} />
          <Route path="/for-agencies" element={<LazyPage label="Loading agency story..."><ForAgencies /></LazyPage>} />
          <Route path="/for-small-business" element={<LazyPage label="Loading small-business story..."><ForSmallBusiness /></LazyPage>} />
          <Route path="/privacy" element={<LazyPage label="Loading privacy policy..."><Privacy /></LazyPage>} />
          <Route path="/terms" element={<LazyPage label="Loading terms..."><Terms /></LazyPage>} />
          <Route path="/cookies" element={<LazyPage label="Loading cookie policy..."><Cookies /></LazyPage>} />
          <Route path="/changelog" element={<LazyPage label="Loading changelog..."><Changelog /></LazyPage>} />
          <Route path="/agents/:agentId" element={<LazyPage label="Loading agent profile..."><AgentProfile /></LazyPage>} />
          <Route path="/login/*" element={<AuthPage mode="sign-in" />} />
          <Route path="/signup/*" element={<AuthPage mode="sign-up" />} />
          <Route
            path="/app/onboarding"
            element={
              <ProtectedOnly>
                <LazyPage label="Preparing onboarding..."><OnboardingGate /></LazyPage>
              </ProtectedOnly>
            }
          />
          <Route
            path="/app"
            element={
              <ProtectedOnly>
                <ProtectedWorkspace />
              </ProtectedOnly>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<LazyPage label="Loading dashboard..."><Dashboard /></LazyPage>} />
            <Route path="admin" element={<LazyPage label="Loading admin console..."><Admin /></LazyPage>} />
            <Route path="agents/:agentId" element={<LazyPage label="Loading agent workspace..."><AgentChat /></LazyPage>} />
            <Route path="lore" element={<LazyPage label="Loading LORE workspace..."><Lore /></LazyPage>} />
            <Route path="workflows" element={<LazyPage label="Loading workflows..."><Workflows /></LazyPage>} />
            <Route path="integrations" element={<LazyPage label="Loading integrations..."><Integrations /></LazyPage>} />
            <Route path="settings" element={<LazyPage label="Loading settings..."><Settings /></LazyPage>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

function LazyPage({ label, children }) {
  return (
    <Suspense fallback={<LoadingPanel label={label} />}>
      <MotionPage className="app-route-stage">{children}</MotionPage>
    </Suspense>
  );
}

function AuthPage({ mode }) {
  const panel =
    mode === 'sign-up' ? (
      <SignUp routing="path" path="/signup" afterSignUpUrl="/app/onboarding" />
    ) : (
      <SignIn routing="path" path="/login" afterSignInUrl="/app/dashboard" />
    );

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
          <BrandMark />
          <ThemeToggle />
        </div>
        <div className="setup-screen__header">
          <div className="eyebrow" style={{ '--eyebrow-accent': 'var(--accent)' }}>
            {mode === 'sign-up' ? 'Create workspace' : 'Welcome back'}
          </div>
          <h1 className="setup-screen__title" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)' }}>
            {mode === 'sign-up' ? 'Start your Prymal workspace.' : 'Enter the command layer.'}
          </h1>
          <p className="setup-screen__copy">
            Dark by default, glassy by design, and wired into the same Clerk-backed auth flow as the product.
          </p>
        </div>
        {panel}
      </div>
    </div>
  );
}

function AppErrorFallback() {
  return (
    <div className="auth-screen">
      <div className="setup-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
          <BrandMark />
          <ThemeToggle />
        </div>
        <div className="setup-screen__header">
          <div className="eyebrow" style={{ '--eyebrow-accent': '#ff7a3c' }}>Application error</div>
          <h1 className="setup-screen__title">Prymal hit an unexpected error.</h1>
          <p className="setup-screen__copy">
            The issue was captured for investigation. Reload the app to continue.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <Button tone="accent" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button tone="ghost" onClick={() => window.location.assign('/')}>
            Back to landing
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProtectedOnly({ children }) {
  const { isLoaded, getToken } = useAuth();

  useEffect(() => {
    configureApi({
      getToken,
      getOrgId: () => useAppStore.getState().org?.id ?? null,
    });
  }, [getToken]);

  if (!isLoaded) {
    return <LoadingPanel label="Checking session..." />;
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function ProtectedWorkspace() {
  const setSession = useAppStore((state) => state.setSession);
  const viewerQuery = useQuery({
    queryKey: ['viewer'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  });

  useEffect(() => {
    if (viewerQuery.data) {
      setSession(viewerQuery.data);
    }
  }, [setSession, viewerQuery.data]);

  if (viewerQuery.isLoading) {
    return <LoadingPanel label="Resolving workspace..." />;
  }

  if (viewerQuery.error?.status === 403 || viewerQuery.error?.status === 404) {
    return <Navigate to="/app/onboarding" replace />;
  }

  if (viewerQuery.error) {
    return (
      <SetupErrorScreen
        title="Workspace check failed"
        description="Prymal could not load your workspace from the backend."
        error={viewerQuery.error}
        onRetry={() => viewerQuery.refetch()}
      />
    );
  }

  return <AppLayout viewer={viewerQuery.data} />;
}

function OnboardingGate() {
  const viewerQuery = useQuery({
    queryKey: ['viewer'],
    queryFn: () => api.get('/auth/me'),
    retry: false,
  });

  if (viewerQuery.isLoading) {
    return <LoadingPanel label="Preparing workspace setup..." />;
  }

  if (viewerQuery.data?.organisation?.id) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (viewerQuery.error && ![403, 404].includes(viewerQuery.error.status)) {
    return (
      <SetupErrorScreen
        title="Setup check failed"
        description="Prymal could not reach the backend to determine whether onboarding is needed."
        error={viewerQuery.error}
        onRetry={() => viewerQuery.refetch()}
      />
    );
  }

  return <Onboarding />;
}

function SetupErrorScreen({ title, description, error, onRetry }) {
  const message =
    error?.data?.error ||
    error?.message ||
    'The backend may be offline, missing environment variables, or still starting.';

  return (
    <div className="auth-screen">
      <div className="setup-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
          <BrandMark />
          <ThemeToggle />
        </div>
        <div className="setup-screen__header">
          <div className="eyebrow" style={{ '--eyebrow-accent': '#ff7a3c' }}>{title}</div>
          <h1 className="setup-screen__title">{title}</h1>
          <p className="setup-screen__copy">{description}</p>
        </div>
        <InlineNotice tone="warning">{message}</InlineNotice>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <Button tone="accent" onClick={onRetry}>Retry</Button>
          <Button tone="ghost" onClick={() => window.location.assign('/')}>Back to landing</Button>
        </div>
      </div>
    </div>
  );
}
