import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { MotionProvider } from './components/motion.jsx';
import { initSentry } from './lib/sentry.js';
import './styles/tokens.css';
import './styles/agents.css';
import './index.css';
import './styles/motion-system.css';
import './styles/premium-overrides.css';
import './styles/app-rebuild.css';
import './styles/rebuild/core-system.css';
import './styles/rebuild/marketing-usecase.css';
import './styles/rebuild/premium-motion.css';

initSentry();

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

/** Plausible loads only in production so local dev is not noisy when ad blockers block plausible.io (ERR_BLOCKED_BY_CLIENT). */
if (import.meta.env.PROD) {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim() || 'prymal.io';
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = domain;
  s.src = 'https://plausible.io/js/script.js';
  s.onerror = () => {};
  document.head.appendChild(s);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </React.StrictMode>,
);
