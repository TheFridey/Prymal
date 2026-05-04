import { afterEach, describe, expect, test, vi } from 'vitest';
import { api, configureApi } from './api';

describe('api client timeouts', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    configureApi({
      getToken: null,
      getOrgId: () => null,
    });
  });

  test('honours per-request timeout options for long-running media calls', async () => {
    vi.useFakeTimers();
    configureApi({
      getToken: null,
      getOrgId: () => null,
    });
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(options.signal.reason ?? new Error('Aborted'));
      });
    })));

    const request = api.post('/agents/generate-image', { prompt: 'A product hero image' }, {}, { timeoutMs: 50 });
    const expectation = expect(request).rejects.toMatchObject({
      status: 504,
      message: 'Request timed out after 50ms. Check that the Prymal API is running.',
    });

    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });
});
