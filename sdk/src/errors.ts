import type { PrymalApiErrorBody } from './types.js';

export class PrymalError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PrymalError';
    this.code = code;
  }
}

export class PrymalApiError extends PrymalError {
  readonly status: number;
  readonly body: PrymalApiErrorBody;

  constructor(status: number, body: PrymalApiErrorBody) {
    super(body.error ?? `HTTP ${status}`, body.code);
    this.name = 'PrymalApiError';
    this.status = status;
    this.body = body;
  }
}

export class PrymalAuthError extends PrymalError {
  constructor(message = 'Invalid or missing API key.') {
    super(message, 'AUTH_ERROR');
    this.name = 'PrymalAuthError';
  }
}

export class PrymalWebhookVerificationError extends PrymalError {
  constructor(message = 'Webhook signature verification failed.') {
    super(message, 'WEBHOOK_SIGNATURE_INVALID');
    this.name = 'PrymalWebhookVerificationError';
  }
}
