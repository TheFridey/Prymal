const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 10;
const UPSTASH_WARNING_PREFIX = '[RATE LIMIT]';

let warnedAboutUpstash = false;

class MemoryRateLimitStore {
  constructor() {
    this.store = new Map();
    this.pruneInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (entry.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, 60_000);

    if (this.pruneInterval.unref) {
      this.pruneInterval.unref();
    }
  }

  async increment(key, windowMs) {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      const entry = { count: 1, resetAt: now + windowMs };
      this.store.set(key, entry);
      return entry;
    }

    existing.count += 1;
    return existing;
  }
}

class UpstashRateLimitStore {
  constructor({ url, token, fallbackStore }) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.fallbackStore = fallbackStore;
  }

  async increment(key, windowMs) {
    try {
      const count = Number(await this.execute(['INCR', key]));

      if (!Number.isFinite(count)) {
        throw new Error('Upstash returned a non-numeric INCR result.');
      }

      if (count === 1) {
        await this.execute(['PEXPIRE', key, String(windowMs)]);
      }

      const ttlMs = Math.max(Number(await this.execute(['PTTL', key])) || windowMs, 1);
      return {
        count,
        resetAt: Date.now() + ttlMs,
      };
    } catch (error) {
      if (!warnedAboutUpstash) {
        warnedAboutUpstash = true;
        console.warn(`${UPSTASH_WARNING_PREFIX} Redis-backed limiting failed, falling back to memory:`, error.message);
      }

      return this.fallbackStore.increment(key, windowMs);
    }
  }

  async execute(args) {
    const encodedPath = args.map((part) => encodeURIComponent(part)).join('/');
    const response = await fetch(`${this.url}/${encodedPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Upstash responded with ${response.status}.`);
    }

    const payload = await response.json().catch(() => ({}));

    if (payload?.error) {
      throw new Error(payload.error);
    }

    return payload?.result;
  }
}

const defaultMemoryStore = new MemoryRateLimitStore();

function createDefaultStore() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (upstashUrl && upstashToken) {
    return new UpstashRateLimitStore({
      url: upstashUrl,
      token: upstashToken,
      fallbackStore: defaultMemoryStore,
    });
  }

  return defaultMemoryStore;
}

function resolveClientIdentifier(context) {
  const forwardedFor = context.req.header('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  return (
    context.req.header('cf-connecting-ip') ??
    forwardedIp ??
    context.req.header('x-real-ip') ??
    'unknown'
  );
}

function sanitizeWindowMs(windowMs) {
  const value = Number(windowMs);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_WINDOW_MS;
}

function sanitizeMax(max) {
  const value = Number(max);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX;
}

function secondsUntil(resetAt) {
  return Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);
}

/**
 * @param {{
 *   windowMs?: number,
 *   max?: number,
 *   limit?: number,
 *   message?: string,
 *   code?: string,
 *   upgrade?: boolean,
 *   keyPrefix?: string,
 *   identifier?: (context: import('hono').Context) => string | Promise<string>,
 *   store?: { increment: (key: string, windowMs: number) => Promise<{ count: number, resetAt: number }> },
 * }} options
 * @returns {import('hono').MiddlewareHandler}
 */
export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  limit,
  message = 'Too many requests',
  code = null,
  upgrade = false,
  keyPrefix = 'global',
  identifier = resolveClientIdentifier,
  store = createDefaultStore(),
} = {}) {
  const sanitizedWindowMs = sanitizeWindowMs(windowMs);
  const sanitizedMax = sanitizeMax(limit ?? max);

  return async (context, next) => {
    const rawIdentifier = await identifier(context);
    const identifierValue = String(rawIdentifier ?? 'unknown').slice(0, 200);
    const key = `${keyPrefix}:${identifierValue}`;
    const { count, resetAt } = await store.increment(key, sanitizedWindowMs);
    const remaining = Math.max(sanitizedMax - count, 0);

    context.header('X-RateLimit-Limit', String(sanitizedMax));
    context.header('X-RateLimit-Remaining', String(remaining));
    context.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > sanitizedMax) {
      const retryAfter = secondsUntil(resetAt);
      context.header('Retry-After', String(retryAfter));
      const responseBody = {
        error: message,
        retryAfter,
        ...(code ? { code } : {}),
        ...(upgrade ? { upgrade: true } : {}),
      };
      return context.json(
        responseBody,
        429,
      );
    }

    await next();
  };
}

export function rateLimitMiddleware(options = {}) {
  return createRateLimiter(options);
}

export function planAwareRateLimit(options = {}) {
  const limits = {
    free: options.free ?? 20,
    solo: options.solo ?? 60,
    pro: options.pro ?? 120,
    teams: options.teams ?? 200,
    agency: options.agency ?? null,
  };
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  return async (context, next) => {
    const org = context.get('org');
    const plan = org?.orgPlan ?? 'free';
    const limit = Object.prototype.hasOwnProperty.call(limits, plan) ? limits[plan] : limits.free;

    if (limit === null) {
      return next();
    }

    return rateLimitMiddleware({
      limit,
      windowMs,
      message: 'Rate limit exceeded. Upgrade your plan for higher limits.',
      code: 'RATE_LIMITED',
      upgrade: true,
      keyPrefix: options.keyPrefix ?? 'org-plan',
      store: options.store,
      identifier:
        options.identifier
        ?? ((ctx) => ctx.get('org')?.orgId ?? resolveClientIdentifier(ctx)),
    })(context, next);
  };
}

export { MemoryRateLimitStore };
