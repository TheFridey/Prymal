import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import { MotionProvider } from './components/motion.jsx';
import './styles/tokens.css';
import './styles/agents.css';
import './index.css';
import './styles/motion-system.css';
import './styles/premium-overrides.css';

function trackPlausible(eventName, props = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props });
    }
  } catch {
    // Analytics should never block the product UI if Plausible is absent or misconfigured.
  }
}

if (typeof window !== 'undefined') {
  window.prymalTrack = trackPlausible;
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.05 : 0,
    replaysOnErrorSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </React.StrictMode>,
);
