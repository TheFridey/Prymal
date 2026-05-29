const CLERK_ORIGINS = [
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://clerk.prymal.io',
].join(' ');

const CLOUDINARY_ORIGINS = [
  'https://res.cloudinary.com',
  'https://api.cloudinary.com',
].join(' ');

export function buildCSP(env = 'production') {
  const self = "'self'";
  const none = "'none'";
  const unsafeInline = "'unsafe-inline'";

  const directives = {
    'default-src': [self],
    'script-src': [self, CLERK_ORIGINS, unsafeInline],
    'style-src': [self, unsafeInline, 'https://fonts.googleapis.com'],
    'font-src': [self, 'https://fonts.gstatic.com'],
    'img-src': [self, CLOUDINARY_ORIGINS, 'data:', 'blob:'],
    'media-src': [self, CLOUDINARY_ORIGINS, 'blob:'],
    'connect-src': [
      self,
      CLERK_ORIGINS,
      CLOUDINARY_ORIGINS,
      'https://api.anthropic.com',
      'https://api.openai.com',
      'wss://api.openai.com',
      'https://api.stripe.com',
      env === 'development' ? 'http://localhost:3001' : null,
    ].filter(Boolean),
    'frame-src': [CLERK_ORIGINS],
    'object-src': [none],
    'base-uri': [self],
    'form-action': [self],
    'upgrade-insecure-requests': [],
  };

  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(' ')}` : key))
    .join('; ');
}
