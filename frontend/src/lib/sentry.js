import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENV || import.meta.env.MODE || 'production',
    release: import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_APP_VERSION,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
  });
}
