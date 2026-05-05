import { PrymalWebhookVerificationError } from './errors.js';
import type { PrymalWebhookOptions, WebhookEvent, WebhookEventType } from './types.js';

type WebhookHandler<T = unknown> = (event: WebhookEvent<T>) => void | Promise<void>;

/**
 * PrymalWebhook verifies inbound webhook signatures and dispatches typed events.
 *
 * Signature format: HMAC-SHA256 hex digest of the raw body,
 * sent in the `X-Prymal-Signature` header as `sha256=<hex>`.
 */
export class PrymalWebhook {
  private readonly secret: string;
  private readonly handlers = new Map<WebhookEventType, WebhookHandler[]>();

  constructor(options: PrymalWebhookOptions) {
    if (!options.secret?.trim()) {
      throw new Error('PrymalWebhook requires a non-empty secret.');
    }
    this.secret = options.secret.trim();
  }

  on<T = unknown>(eventType: WebhookEventType, handler: WebhookHandler<T>): this {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as WebhookHandler);
    return this;
  }

  async constructEvent(rawBody: string | Buffer, signature: string): Promise<WebhookEvent> {
    await this.verifySignature(rawBody, signature);
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    return JSON.parse(body) as WebhookEvent;
  }

  async dispatch(rawBody: string | Buffer, signature: string): Promise<void> {
    const event = await this.constructEvent(rawBody, signature);
    const handlers = this.handlers.get(event.type as WebhookEventType) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }

  private async verifySignature(rawBody: string | Buffer, signature: string): Promise<void> {
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = await hmacSha256Hex(this.secret, body);
    const provided = signature.replace(/^sha256=/, '');

    if (!timingSafeEqual(expected, provided)) {
      throw new PrymalWebhookVerificationError();
    }
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Node.js fallback
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(message).digest('hex');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
