import { PrymalApiError, PrymalAuthError } from './errors.js';
import type { PrymalClientOptions } from './types.js';

const DEFAULT_BASE_URL = 'https://api.prymal.io';
const DEFAULT_TIMEOUT_MS = 30_000;

export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: PrymalClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new PrymalAuthError('apiKey is required to create a PrymalClient.');
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const combinedSignal = signal ?? controller.signal;

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Prymal-SDK': '0.1.0',
        },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: combinedSignal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let errorBody: { error: string; code?: string; status?: number };
      try {
        errorBody = (await response.json()) as typeof errorBody;
      } catch {
        errorBody = { error: `HTTP ${response.status}` };
      }
      throw new PrymalApiError(response.status, errorBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, undefined, signal);
  }

  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('POST', path, body, signal);
  }

  patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('PATCH', path, body, signal);
  }

  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', path, undefined, signal);
  }
}
