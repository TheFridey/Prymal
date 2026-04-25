import { describe, expect, it, vi } from 'vitest';
import {
  getLazyImportRetryKey,
  isDynamicImportFailure,
  loadWithRetry,
} from './lazyWithRetry';

function createStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe('isDynamicImportFailure', () => {
  it('matches failed module fetch errors', () => {
    expect(
      isDynamicImportFailure(new TypeError('Failed to fetch dynamically imported module')),
    ).toBe(true);
    expect(isDynamicImportFailure(new Error('ChunkLoadError: Loading chunk 12 failed.'))).toBe(
      true,
    );
  });

  it('ignores unrelated import failures', () => {
    expect(isDynamicImportFailure(new Error('Unexpected token <'))).toBe(false);
  });
});

describe('loadWithRetry', () => {
  it('clears a retry marker after a successful import', async () => {
    const storage = createStorage();
    const retryKey = getLazyImportRetryKey('changelog');
    storage.setItem(retryKey, '1');

    const module = await loadWithRetry(
      async () => ({ default: 'ok' }),
      'changelog',
      { storage, reload: vi.fn() },
    );

    expect(module).toEqual({ default: 'ok' });
    expect(storage.getItem(retryKey)).toBeNull();
  });

  it('reloads once for a dynamic import fetch failure', async () => {
    const storage = createStorage();
    const reload = vi.fn();
    const pending = loadWithRetry(
      async () => {
        throw new TypeError('Failed to fetch dynamically imported module');
      },
      'changelog',
      { storage, reload },
    );

    const timeout = Symbol('timeout');
    const result = await Promise.race([pending, Promise.resolve(timeout)]);

    expect(result).toBe(timeout);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(getLazyImportRetryKey('changelog'))).toBe('1');
  });

  it('throws after the retry has already been used', async () => {
    const storage = createStorage();
    const retryKey = getLazyImportRetryKey('changelog');
    storage.setItem(retryKey, '1');
    const reload = vi.fn();

    await expect(
      loadWithRetry(
        async () => {
          throw new TypeError('Failed to fetch dynamically imported module');
        },
        'changelog',
        { storage, reload },
      ),
    ).rejects.toThrow('Failed to fetch dynamically imported module');

    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(retryKey)).toBeNull();
  });

  it('does not reload for unrelated errors', async () => {
    const storage = createStorage();
    const reload = vi.fn();

    await expect(
      loadWithRetry(
        async () => {
          throw new Error('Unexpected token <');
        },
        'changelog',
        { storage, reload },
      ),
    ).rejects.toThrow('Unexpected token <');

    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(getLazyImportRetryKey('changelog'))).toBeNull();
  });
});
