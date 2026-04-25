import { lazy } from 'react';

const DYNAMIC_IMPORT_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i;

function getRetryStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function getLazyImportRetryKey(key) {
  return `prymal:lazy-import-retry:${key}`;
}

export function isDynamicImportFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return DYNAMIC_IMPORT_ERROR_RE.test(message);
}

export async function loadWithRetry(importer, key, options = {}) {
  const storage = getRetryStorage(options.storage);
  const retryKey = getLazyImportRetryKey(key);

  try {
    const module = await importer();
    storage?.removeItem(retryKey);
    return module;
  } catch (error) {
    const alreadyRetried = storage?.getItem(retryKey) === '1';

    if (storage && isDynamicImportFailure(error) && !alreadyRetried) {
      storage.setItem(retryKey, '1');
      const reload = options.reload ?? (() => window.location.reload());
      reload();

      // Keep Suspense mounted until the reload takes over instead of
      // surfacing an immediate error boundary flash.
      return new Promise(() => {});
    }

    storage?.removeItem(retryKey);
    throw error;
  }
}

export function lazyWithRetry(importer, key) {
  return lazy(() => loadWithRetry(importer, key));
}
