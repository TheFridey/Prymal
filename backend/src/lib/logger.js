import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  base: { service: 'prymal-api', env: process.env.NODE_ENV },
  redact: {
    paths: [
      '*.apiKey', '*.secret', '*.password', '*.token',
      '*.ENCRYPTION_KEY', 'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});

export function createRouteLogger(routeName) {
  return logger.child({ component: routeName });
}

export function createProviderLogger(provider, policyClass) {
  return logger.child({ provider, policy_class: policyClass });
}
