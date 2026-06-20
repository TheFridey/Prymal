import { Suspense, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/theme';
import { AnalyticsPageView } from './components/AnalyticsPageView';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { resolveSignupOnboardingUrl } from './auth/signup-routing';

export { resolveSignupOnboardingUrl };

const lazyPage = (importer, key) => lazyWithRetry(importer, `route:${key}`);

const AgentProfile = lazyPage(() => import('./pages/AgentProfile'), 'agent-profile');
const AuthRuntime = lazyPage(() => import('./auth/AuthRuntime'), 'auth-runtime');
const Blog = lazyPage(() => import('./pages/Blog'), 'blog');
const BlogPost = lazyPage(() => import('./pages/BlogPost'), 'blog-post');
const Changelog = lazyPage(() => import('./pages/Changelog'), 'changelog');
const Compare = lazyPage(() => import('./pages/Compare'), 'compare');
const ComparisonPage = lazyPage(() => import('./pages/ComparisonPage'), 'comparison-page');
const Cookies = lazyPage(() => import('./pages/Cookies'), 'cookies');
const EducationHub = lazyPage(() => import('./pages/EducationHub'), 'education-hub');
const EducationPage = lazyPage(() => import('./pages/EducationPage'), 'education-page');
const EntityHub = lazyPage(() => import('./pages/EntityHub'), 'entity-hub');
const EntityPage = lazyPage(() => import('./pages/EntityPage'), 'entity-page');
const FeaturePage = lazyPage(() => import('./pages/FeaturePage'), 'feature-page');
const Features = lazyPage(() => import('./pages/Features'), 'features');
const ForAgencies = lazyPage(() => import('./pages/ForAgencies'), 'for-agencies');
const ForSmallBusiness = lazyPage(() => import('./pages/ForSmallBusiness'), 'for-small-business');
const GeneratedBlogArticle = lazyPage(() => import('./pages/GeneratedBlogArticle'), 'generated-blog-article');
const GeneratedBlogHub = lazyPage(() => import('./pages/GeneratedBlogHub'), 'generated-blog-hub');
const IndustryHub = lazyPage(() => import('./pages/IndustryHub'), 'industry-hub');
const IndustryPage = lazyPage(() => import('./pages/IndustryPage'), 'industry-page');
const Landing = lazyPage(() => import('./pages/Landing'), 'landing');
const Privacy = lazyPage(() => import('./pages/Privacy'), 'privacy');
const Pricing = lazyPage(() => import('./pages/Pricing'), 'pricing');
const SeoGrowthPage = lazyPage(() => import('./pages/SeoGrowthPage'), 'seo-growth-page');
const Terms = lazyPage(() => import('./pages/Terms'), 'terms');
const Trust = lazyPage(() => import('./pages/Trust'), 'trust');
const UseCaseHub = lazyPage(() => import('./pages/UseCaseHub'), 'use-case-hub');
const UseCasePage = lazyPage(() => import('./pages/UseCasePage'), 'use-case-page');

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const RoutedApp = import.meta.env.VITE_SENTRY_DSN
    ? Sentry.withErrorBoundary(AppRouter, { fallback: <AppErrorFallback /> })
    : AppRouter;

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (ref) sessionStorage.setItem('prymal_referral', ref);
  }, []);

  return <RoutedApp />;
}

function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <ErrorBoundary label="Application">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <AnalyticsPageView />
      <Routes>
        <Route
          path="/"
          element={(
            <Suspense fallback={null}>
              <Landing />
            </Suspense>
          )}
        />
        <Route path="/features" element={<LazyPage label="Loading feature library..."><Features /></LazyPage>} />
        <Route path="/features/:slug" element={<LazyPage label="Loading feature page..."><FeaturePage /></LazyPage>} />
        <Route path="/blog" element={<LazyPage label="Loading blog..."><Blog /></LazyPage>} />
        <Route path="/blog/:slug" element={<LazyPage label="Loading article..."><BlogPost /></LazyPage>} />
        <Route path="/compare" element={<LazyPage label="Loading comparisons..."><Compare /></LazyPage>} />
        <Route path="/compare/:slug" element={<LazyPage label="Loading comparison..."><ComparisonPage /></LazyPage>} />
        <Route path="/what-is" element={<LazyPage label="Loading education hub..."><EducationHub /></LazyPage>} />
        <Route path="/what-is/:slug" element={<LazyPage label="Loading explainer..."><EducationPage /></LazyPage>} />
        <Route path="/content/blog" element={<LazyPage label="Loading generated blog..."><GeneratedBlogHub /></LazyPage>} />
        <Route path="/content/blog/:slug" element={<LazyPage label="Loading generated article..."><GeneratedBlogArticle /></LazyPage>} />
        <Route path="/content/entities" element={<LazyPage label="Loading entity graph..."><EntityHub /></LazyPage>} />
        <Route path="/content/entities/:slug" element={<LazyPage label="Loading entity..."><EntityPage /></LazyPage>} />
        <Route path="/content/industries" element={<LazyPage label="Loading industry library..."><IndustryHub /></LazyPage>} />
        <Route path="/content/industries/:slug" element={<LazyPage label="Loading industry page..."><IndustryPage /></LazyPage>} />
        <Route path="/ai-operating-system-for-business" element={<LazyPage label="Loading guide..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/ai-agent-orchestration" element={<LazyPage label="Loading guide..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/shared-business-memory-ai" element={<LazyPage label="Loading guide..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/governed-ai-agents" element={<LazyPage label="Loading guide..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/secure-ai-workflows" element={<LazyPage label="Loading guide..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/use-cases" element={<LazyPage label="Loading use cases..."><UseCaseHub /></LazyPage>} />
        <Route path="/use-cases/:slug" element={<LazyPage label="Loading use case..."><UseCasePage /></LazyPage>} />
        <Route path="/architecture" element={<LazyPage label="Loading architecture..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/glossary" element={<LazyPage label="Loading glossary..."><SeoGrowthPage /></LazyPage>} />
        <Route path="/for-agencies" element={<LazyPage label="Loading agency story..."><ForAgencies /></LazyPage>} />
        <Route path="/for-small-business" element={<LazyPage label="Loading small-business story..."><ForSmallBusiness /></LazyPage>} />
        <Route path="/privacy" element={<LazyPage label="Loading privacy policy..."><Privacy /></LazyPage>} />
        <Route path="/terms" element={<LazyPage label="Loading terms..."><Terms /></LazyPage>} />
        <Route path="/cookies" element={<LazyPage label="Loading cookie policy..."><Cookies /></LazyPage>} />
        <Route path="/changelog" element={<LazyPage label="Loading changelog..."><Changelog /></LazyPage>} />
        <Route path="/trust" element={<LazyPage label="Loading trust page..."><Trust /></LazyPage>} />
        <Route path="/pricing" element={<LazyPage label="Loading pricing..."><Pricing /></LazyPage>} />
        <Route path="/agents/:agentId" element={<LazyPage label="Loading agent profile..."><AgentProfile /></LazyPage>} />
        <Route path="/login/*" element={<AuthRoute />} />
        <Route path="/signup/*" element={<AuthRoute />} />
        <Route path="/app/*" element={<AuthRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

function AuthRoute() {
  return (
    <Suspense fallback={<RouteLoadingPanel label="Loading secure runtime..." />}>
      <AuthRuntime />
    </Suspense>
  );
}

function RouteLoadingPanel({ label = 'Loading Prymal...' }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="loading-panel__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function PageNotFoundMeta() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Page not found | Prymal';

    let robotsMeta = document.querySelector('meta[name="robots"]');
    const previousRobots = robotsMeta?.getAttribute('content') ?? null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex,follow');

    return () => {
      document.title = previousTitle;
      if (previousRobots === null) {
        robotsMeta.remove();
      } else {
        robotsMeta.setAttribute('content', previousRobots);
      }
    };
  }, []);

  return null;
}

function NotFoundPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="pm-page"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px',
      }}
    >
      <PageNotFoundMeta />
      <section style={{ width: 'min(620px, 100%)' }}>
        <div className="eyebrow" style={{ '--eyebrow-accent': 'var(--accent)' }}>404</div>
        <h1 style={{ margin: '12px 0', fontSize: 'clamp(2.5rem, 8vw, 5rem)', lineHeight: 0.95 }}>
          Page not found.
        </h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '20px' }}>
          This URL is not part of the public Prymal site.
        </p>
        <Link to="/">
          <span className="btn btn--accent">Open Prymal home</span>
        </Link>
      </section>
    </main>
  );
}

function LazyPage({ label, children }) {
  return (
    <Suspense fallback={<RouteLoadingPanel label={label} />}>
      <div className="app-route-stage">{children}</div>
    </Suspense>
  );
}

function AppErrorFallback() {
  return (
    <div className="auth-screen">
      <div className="setup-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div className="brand-mark">
            <div className="brand-mark__copy">
              <div className="brand-mark__name">PRYMAL</div>
              <div className="brand-mark__tag">Instinctive AI operations</div>
            </div>
          </div>
        </div>
        <div className="setup-screen__header">
          <div className="eyebrow" style={{ '--eyebrow-accent': '#ff7a3c' }}>Application error</div>
          <h1 className="setup-screen__title">Prymal hit an unexpected error.</h1>
          <p className="setup-screen__copy">
            The issue was captured for investigation. Reload the app to continue.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <button type="button" className="btn btn--accent" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.location.assign('/')}>
            Back to landing
          </button>
        </div>
      </div>
    </div>
  );
}
