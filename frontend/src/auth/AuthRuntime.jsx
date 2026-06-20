import { Suspense, useEffect } from 'react';
import {
  ClerkProvider,
  RedirectToSignIn,
  SignIn,
  SignUp,
  useAuth,
} from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BrandMark, Button, InlineNotice, LoadingPanel, ThemeToggle } from '../components/ui';
import { MotionPage, MotionProvider } from '../components/motion';
import { getClerkAppearance, useTheme } from '../components/theme';
import { api, configureApi } from '../lib/api';
import { trackSignupStarted } from '../lib/analytics';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { useAppStore } from '../stores/useAppStore';
import { resolveSignupOnboardingUrl } from './signup-routing';
import '../styles/motion-system.css';
import '../styles/app-rebuild.css';
import '../styles/rebuild/premium-motion.css';

const lazyPage = (importer, key) => lazyWithRetry(importer, `route:${key}`);

const Admin = lazyPage(() => import('../pages/Admin'), 'admin');
const AppLayout = lazyPage(() => import('../components/AppLayout'), 'app-layout');
const AdminWorkflowCatalogue = lazyPage(() => import('../pages/AdminWorkflowCatalogue'), 'admin-workflow-catalogue');
const AgentPerformance = lazyPage(() => import('../pages/AgentPerformance'), 'agent-performance');
const AgentChat = lazyPage(() => import('../pages/AgentChat'), 'agent-chat');
const Dashboard = lazyPage(() => import('../pages/Dashboard'), 'dashboard');
const Integrations = lazyPage(() => import('../pages/Integrations'), 'integrations');
const Lore = lazyPage(() => import('../pages/Lore'), 'lore');
const Memory = lazyPage(() => import('../pages/Memory'), 'memory');
const Onboarding = lazyPage(() => import('../pages/Onboarding'), 'onboarding');
const Settings = lazyPage(() => import('../pages/Settings'), 'settings');
const Workflows = lazyPage(() => import('../pages/Workflows'), 'workflows');
const WorkflowCatalogue = lazyPage(() => import('../pages/WorkflowCatalogue'), 'workflow-catalogue');
const WorkflowCatalogueCreate = lazyPage(() => import('../pages/WorkflowCatalogueCreate'), 'workflow-catalogue-create');
const WorkflowCatalogueDetail = lazyPage(() => import('../pages/WorkflowCatalogueDetail'), 'workflow-catalogue-detail');
const WorkflowCatalogueSubmissions = lazyPage(() => import('../pages/WorkflowCatalogueSubmissions'), 'workflow-catalogue-submissions');

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

export default function AuthRuntime() {
  const { theme } = useTheme();

  if (!CLERK_KEY || CLERK_KEY === 'pk_test_placeholder' || CLERK_KEY.length < 20) {
    return <SetupRequiredScreen />;
  }

  return (
    <MotionProvider>
      <ClerkProvider publishableKey={CLERK_KEY} appearance={getClerkAppearance(theme)}>
        <QueryClientProvider client={queryClient}>
          <ClerkApiBinding />
          <Routes>
            <Route path="/login/*" element={<AuthPage mode="sign-in" />} />
            <Route path="/signup/*" element={<AuthPage mode="sign-up" />} />
            <Route
              path="/app/onboarding"
              element={(
                <ProtectedOnly>
                  <LazyPage label="Preparing onboarding..."><OnboardingGate /></LazyPage>
                </ProtectedOnly>
              )}
            />
            <Route
              path="/app"
              element={(
                <ProtectedOnly>
                  <ProtectedWorkspace />
                </ProtectedOnly>
              )}
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<LazyPage label="Loading dashboard..."><Dashboard /></LazyPage>} />
              <Route path="admin" element={<LazyPage label="Loading admin console..."><Admin /></LazyPage>} />
              <Route path="admin/workflow-catalogue" element={<LazyPage label="Loading catalogue review..."><AdminWorkflowCatalogue /></LazyPage>} />
              <Route path="admin/agent-performance" element={<LazyPage label="Loading agent performance..."><AgentPerformance /></LazyPage>} />
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
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </QueryClientProvider>
      </ClerkProvider>
    </MotionProvider>
  );
}

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

  useEffect(() => {
    if (mode !== 'sign-up') {
      return;
    }

    const offer = new URLSearchParams(location.search).get('offer')?.trim();
    trackSignupStarted({
      surface: 'signup_page',
      ...(offer ? { offer } : {}),
    });
  }, [location.search, mode]);

  const panel =
    mode === 'sign-up' ? (
      <>
        <SignUp routing="path" path="/signup" afterSignUpUrl={onboardingUrl} />
        <p style={{ fontSize: '12px', color: 'var(--muted, #9aa4b2)', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
          By creating an account you agree to our{' '}
          <Link to="/terms" style={{ color: 'var(--accent, #00FFD1)', textDecoration: 'none' }}>Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" style={{ color: 'var(--accent, #00FFD1)', textDecoration: 'none' }}>Privacy Policy</Link>.
          {' '}Review how Prymal handles safety and data in the{' '}
          <Link to="/trust" style={{ color: 'var(--accent, #00FFD1)', textDecoration: 'none' }}>Trust Centre</Link>.
        </p>
      </>
    ) : (
      <SignIn routing="path" path="/login" afterSignInUrl="/app/dashboard" />
    );

  return (
    <div className="auth-screen auth-screen--gate">
      <div className="auth-card auth-card--gate">
        <div className="auth-card__top">
          <BrandMark />
          <ThemeToggle />
        </div>
        <div className="auth-card__hero setup-screen__header">
          <div className="eyebrow" style={{ '--eyebrow-accent': 'var(--accent)' }}>
            {mode === 'sign-up' ? 'Create workspace' : 'Welcome back'}
          </div>
          <h1 className="setup-screen__title auth-card__title">
            {mode === 'sign-up' ? 'Start your Prymal workspace.' : 'Enter the command layer.'}
          </h1>
          <p className="setup-screen__copy auth-card__copy">
            Dark by default, glassy by design, and wired into the same Clerk-backed auth flow as the product.
          </p>
        </div>
        <div className="auth-card__panel">{panel}</div>
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

  return (
    <Suspense fallback={<LoadingPanel label="Loading workspace shell..." />}>
      <AppLayout viewer={viewerQuery.data} />
    </Suspense>
  );
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

function SetupRequiredScreen() {
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
