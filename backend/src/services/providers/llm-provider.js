export class LlmProvider {
  constructor({ providerId }) {
    this.providerId = providerId;
  }

  async generateText() {
    throw new Error('generateText must be implemented by the provider.');
  }

  async streamText() {
    throw new Error('streamText must be implemented by the provider.');
  }
}

export function normalizeProviderError(error, { provider, defaultCode, defaultStatus = 503 }) {
  if (!error) {
    const normalized = new Error(`The ${provider} provider failed.`);
    normalized.code = defaultCode;
    normalized.status = defaultStatus;
    return normalized;
  }

  const normalized = new Error(error.message || `The ${provider} provider failed.`);
  normalized.code = error.code ?? defaultCode;
  normalized.status = error.status ?? error.statusCode ?? defaultStatus;
  normalized.cause = error;
  return normalized;
}
