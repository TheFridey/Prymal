import * as Sentry from '@sentry/node';
import { serve } from '@hono/node-server';
import { clerkMiddleware } from '@hono/clerk-auth';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import billingRoutes from './routes/billing.js';
import integrationRoutes from './routes/integrations.js';
import loreRoutes from './routes/lore.js';
import powerupRoutes from './routes/powerups.js';
import workflowRoutes from './routes/workflows.js';
import adminRoutes from './routes/admin.js';
import unsubscribeRoutes from './routes/unsubscribe.js';
import waitlistRoutes from './routes/waitlist.js';
import { db } from './db/index.js';
import { hasTriggerDevConfig } from './queue/trigger.js';
import { startInlineScheduler } from './services/inline-scheduler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestContext } from './middleware/request-context.js';
import { securityHeaders } from './middleware/security-headers.js';
import { readGeneratedImageAsset } from './services/image-generation.js';
import { readWebAsset } from './services/web-research.js';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.npm_package_version,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    beforeSend(event) {
      if (event.request?.data && typeof event.request.data === 'object') {
        const sanitised = { ...event.request.data };
        for (const key of ['password', 'apiKey', 'secret', 'token', 'key']) {
          if (sanitised[key]) {
            sanitised[key] = '[REDACTED]';
          }
        }
        event.request.data = sanitised;
      }

      return event;
    },
  });
}

const app = new Hono();
const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return /^http:\/\/localhost:517\d$/.test(origin);
}

app.use('*', timing());
app.use('*', requestContext());
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', securityHeaders());
app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : allowedOrigins[0] ?? 'http://localhost:5173'),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-Request-Id', 'Idempotency-Key', 'X-Idempotency-Key'],
    exposeHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  }),
);

app.get('/health', (context) => {
  return context.json({
    status: 'ok',
    version: process.env.npm_package_version ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/*', clerkMiddleware());

app.get('/', (context) =>
  context.json({
    status: 'ok',
    service: 'prymal-api',
    version: '1.0.0',
  }),
);

app.get('/web-assets/:fileName', async (context) => {
  const { fileName } = context.req.param();

  try {
    const buffer = await readWebAsset(fileName);
    context.header('Content-Type', 'image/png');
    context.header('Cache-Control', 'public, max-age=3600');
    return context.body(buffer);
  } catch {
    return context.json({ error: 'Asset not found' }, 404);
  }
});

app.get('/generated-assets/:fileName', async (context) => {
  const { fileName } = context.req.param();

  try {
    const buffer = await readGeneratedImageAsset(fileName);
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentType =
      ext === 'png' ? 'image/png' : ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'image/webp';
    context.header('Content-Type', contentType);
    context.header('Cache-Control', 'public, max-age=3600');
    return context.body(buffer);
  } catch {
    return context.json({ error: 'Asset not found' }, 404);
  }
});

// 20 requests per IP per minute on auth routes
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 20, message: 'Too many auth requests. Please try again shortly.' });
app.use('/api/auth/*', authLimiter);

// 5 requests per IP per 15 minutes on waitlist signup
const waitlistLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5, message: 'Too many waitlist requests. Please try again in 15 minutes.' });
app.use('/api/waitlist/*', waitlistLimiter);

// 10 requests per IP per hour on unsubscribe
const unsubscribeLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 10, message: 'Too many unsubscribe requests. Please try again later.' });
app.use('/api/unsubscribe/*', unsubscribeLimiter);

app.route('/api/auth', authRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/lore', loreRoutes);
app.route('/api/workflows', workflowRoutes);
app.route('/api/integrations', integrationRoutes);
app.route('/api/powerups', powerupRoutes);
app.route('/api/billing', billingRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/unsubscribe', unsubscribeRoutes);
app.route('/api/waitlist', waitlistRoutes);

app.notFound((context) => context.json({ error: 'Route not found' }, 404));

app.onError((error, context) => {
  console.error('[PRYMAL ERROR]', error);
  const requestId = context.get('requestId') ?? null;
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: {
        path: context.req.path,
        method: context.req.method,
        orgId: context.get('org')?.orgId ?? null,
        requestId,
      },
    });
  }

  if (requestId) {
    context.header('X-Request-Id', requestId);
  }

  return context.json(
    {
      error: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      upgrade: Boolean(error.upgrade),
      requestId,
    },
    error.status || 500,
  );
});

const port = Number(process.env.PORT ?? 3001);
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  serve(
    {
      fetch: app.fetch,
      port,
    },
    async (info) => {
      console.log(`Prymal API listening on http://localhost:${info.port}`);

      if (!hasTriggerDevConfig()) {
        try {
          await startInlineScheduler(db);
        } catch (error) {
          console.error('[SCHEDULER] Failed to start inline scheduler:', error.message);
        }
      }
    },
  );
}

export default app;
