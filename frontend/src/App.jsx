import { Suspense, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ClerkProvider,
  RedirectToSignIn,
  SignIn,
  SignUp,
  useAuth,
} from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import AppLayout from './components/AppLayout';
import { BrandMark, Button, InlineNotice, LoadingPanel, ThemeToggle } from './components/ui';
import { MotionPage, MotionPresence } from './components/motion';
import { ThemeProvider, getClerkAppearance, useTheme } from './components/theme';
import { api, configureApi } from './lib/api';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { useAppStore } from './stores/useAppStore';

const lazyPage = (importer, key) => lazyWithRetry(importer, `route:${key}`);

const Admin = lazyPage(() => import('./pages/Admin'), 'admin');
const AdminWorkflowCatalogue = lazyPage(() => import('./pages/AdminWorkflowCatalogue'), 'admin-workflow-catalogue');
const AgentChat = lazyPage(() => import('./pages/AgentChat'), 'agent-chat');
const AgentProfile = lazyPage(() => import('./pages/AgentProfile'), 'agent-profile');
const Changelog = lazyPage(() => import('./pages/Changelog'), 'changelog');
const Cookies = lazyPage(() => import('./pages/Cookies'), 'cookies');
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'dashboard');
const ForAgencies = lazyPage(() => import('./pages/ForAgencies'), 'for-agencies');
const ForSmallBusiness = lazyPage(() => import('./pages/ForSmallBusiness'), 'for-small-business');
const Integrations = lazyPage(() => import('./pages/Integrations'), 'integrations');
const Landing = lazyPage(() => import('./pages/Landing'), 'landing');
const Lore = lazyPage(() => import('./pages/Lore'), 'lore');
const Memory = lazyPage(() => import('./pages/Memory'), 'memory');
const Onboarding = lazyPage(() => import('./pages/Onboarding'), 'onboarding');
const Privacy = lazyPage(() => import('./pages/Privacy'), 'privacy');
const Pricing = lazyPage(() => import('./pages/Pricing'), 'pricing');
const Settings = lazyPage(() => import('./pages/Settings'), 'settings');
const Terms = lazyPage(() => import('./pages/Terms'), 'terms');
const Workflows = lazyPage(() => import('./pages/Workflows'), 'workflows');
const WorkflowCatalogue = lazyPage(() => import('./pages/WorkflowCatalogue'), 'workflow-catalogue');
const WorkflowCatalogueCreate = lazyPage(() => import('./pages/WorkflowCatalogueCreate'), 'workflow-catalogue-create');
const WorkflowCatalogueDetail = lazyPage(() => import('./pages/WorkflowCatalogueDetail'), 'workflow-catalogue-detail');
const WorkflowCatalogueSubmissions = lazyPage(() => import('./pages/WorkflowCatalogueSubmissions'), 'workflow-catalogue-submissions');

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
const SIGNUP_ALLOWED_REDIRECTS = [
  '/app/workflows',
  '/app/dashboard',
  '/app/dashboard?intent=simple',
  '/app/workflows/catalogue?mode=simple',
  '/app/workflows/catalogue?mode=advanced',
  '/app/workflows/catalogue/30-day-content-engine',
];

export function resolveSignupOnboardingUrl(search = '') {
  const params = new URLSearchParams(search);
  const intent = params.get('intent');
  const redirectUrl = params.get('redirect_url');
  const onboardingParams = new URLSearchParams();
  if (['simple', 'advanced'].includes(intent)) onboardingParams.set('intent', intent);
  if (SIGNUP_ALLOWED_REDIRECTS.includes(redirectUrl)) {
    onboardingParams.set('redirect_url', redirectUrl);
  }

  return onboardingParams.toString()
    ? `/app/onboarding?${onboardingParams.toString()}`
    : '/app/onboarding';
}

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

  if (!CLERK_KEY || CLERK_KEY === 'pk_test_placeholder' || CLERK_KEY.length < 20) {
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
        <ClerkApiBinding />
        <RoutedApp />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

/** Must render under ClerkProvider before any route can call `api` with the live session. */
function ClerkApiBinding() {
  const { getToken } = useAuth();
  bindClerkApi(getToken);
  return null;
}

function bindClerkApi(getToken) {
  configureApi({
    getToken,
    getOrgId: () => useAppStore.getState().org?.id ?? null,
  });
}

function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}

// Inner component so useLocation has access to BrowserRouter context.
// AnimatePresence wraps Routes keyed to the top-level path segment so that
// navigating between /app/dashboard → /app/lore → /admin etc. produces a
// coordinated exit + enter transition rather than an instant swap.
function AppRoutes() {
  const location = useLocation();
  // Key only on the first two path segments so nested workspace tab changes
  // (e.g. /app/agents/cipher → /app/agents/herald) don't re-trigger full-page
  // transitions — only genuine top-level route changes do.
  const routeKey = location.pathname.split('/').slice(0, 3).join('/') || '/';

  return (
    <ErrorBoundary label="Application">
      <MotionPresence mode="wait" initial={false}>
        <Routes location={location} key={routeKey}>
          <Route path="/" element={<LazyPage label="Loading Prymal..."><Landing /></LazyPage>} />
          <Route path="/for-agencies" element={<LazyPage label="Loading agency story..."><ForAgencies /></LazyPage>} />
          <Route path="/for-small-business" element={<LazyPage label="Loading small-business story..."><ForSmallBusiness /></LazyPage>} />
          <Route path="/privacy" element={<LazyPage label="Loading privacy policy..."><Privacy /></LazyPage>} />
          <Route path="/terms" element={<LazyPage label="Loading terms..."><Terms /></LazyPage>} />
          <Route path="/cookies" element={<LazyPage label="Loading cookie policy..."><Cookies /></LazyPage>} />
          <Route path="/changelog" element={<LazyPage label="Loading changelog..."><Changelog /></LazyPage>} />
          <Route path="/pricing" element={<LazyPage label="Loading pricing..."><Pricing /></LazyPage>} />
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
            <Route path="admin/workflow-catalogue" element={<LazyPage label="Loading catalogue review..."><AdminWorkflowCatalogue /></LazyPage>} />
            <Route path="agents/:agentId" element={<LazyPage label="Loading agent workspace..."><AgentChat /></LazyPage>} />
            <Route path="lore" element={<LazyPage label="Loading LORE workspace..."><Lore /></LazyPage>} />
            <Route path="memory" element={<LazyPage label="Loading Memory Centre..."><Memory /></LazyPage>} />
            <Route path="workflows" element={<LazyPage label="Loading workflows..."><Workflows /></LazyPage>} />
            <Route path="workflows/catalogue" element={<LazyPage label="Loading workflow catalogue..."><WorkflowCatalogue /></LazyPage>} />
            <Route path="workflows/catalogue/create" element={<LazyPage label="Loading workflow sharing..."><WorkflowCatalogueCreate /></LazyPage>} />
            <Route path="workflows/catalogue/submissions" element={<LazyPage label="Loading workflow submissions..."><WorkflowCatalogueSubmissions /></LazyPage>} />
            <Route path="workflows/catalogue/:slug" element={<LazyPage label="Loading workflow catalogue item..."><WorkflowCatalogueDetail /></LazyPage>} />
            <Route path="integrations" element={<LazyPage label="Loading integrations..."><Integrations /></LazyPage>} />
            <Route path="settings" element={<LazyPage label="Loading settings..."><Settings /></LazyPage>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MotionPresence>
    </ErrorBoundary>
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
  const location = useLocation();
  const onboardingUrl = resolveSignupOnboardingUrl(location.search);
  const panel =
    mode === 'sign-up' ? (
      <SignUp routing="path" path="/signup" afterSignUpUrl={onboardingUrl} />
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

export function ProtectedOnly({ children }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  bindClerkApi(getToken);

  if (!isLoaded || typeof isSignedIn === 'undefined') {
    return <LoadingPanel label="Checking session..." />;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return children;
}

function ProtectedWorkspace() {
  const setSession = useAppStore((state) => state.setSession);
  const { isLoaded, userId } = useAuth();
  const viewerQuery = useQuery({
    queryKey: ['viewer'],
    queryFn: () => api.get('/auth/me'),
    enabled: isLoaded && Boolean(userId),
    retry: (failureCount, error) => failureCount === 0 && Number(error?.status) === 401,
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
  const { isLoaded, userId } = useAuth();
  const viewerQuery = useQuery({
    queryKey: ['viewer'],
    queryFn: () => api.get('/auth/me'),
    enabled: isLoaded && Boolean(userId),
    retry: (failureCount, error) => failureCount === 0 && Number(error?.status) === 401,
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
