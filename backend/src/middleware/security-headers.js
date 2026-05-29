import { buildCSP } from './csp.js';

export const DEFAULT_SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function isHttpsLikeRequest(context) {
  const forwardedProto = context.req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwardedProto) {
    return forwardedProto === 'https';
  }

  try {
    return new URL(context.req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function securityHeaders(headers = DEFAULT_SECURITY_HEADERS) {
  return async (context, next) => {
    await next();

    for (const [name, value] of Object.entries(headers)) {
      if (!context.res.headers.has(name)) {
        context.header(name, value);
      }
    }

    if (isHttpsLikeRequest(context) && !context.res.headers.has('Strict-Transport-Security')) {
      context.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const ct = context.res.headers.get('Content-Type') ?? '';
    if (!ct.includes('text/event-stream') && !context.res.headers.has('Content-Security-Policy')) {
      context.header('Content-Security-Policy', buildCSP(process.env.NODE_ENV));
    }
  };
}
