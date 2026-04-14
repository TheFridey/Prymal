const DEFAULT_SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export function securityHeaders(headers = DEFAULT_SECURITY_HEADERS) {
  return async (context, next) => {
    await next();

    for (const [name, value] of Object.entries(headers)) {
      if (!context.res.headers.has(name)) {
        context.header(name, value);
      }
    }
  };
}
