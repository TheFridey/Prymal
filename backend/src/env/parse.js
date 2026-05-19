import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

export const DEFAULT_BACKEND_ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url));
export const VALID_NODE_ENV_VALUES = ['development', 'staging', 'production', 'test'];

let lastLoadState = {
  attempted: false,
  loaded: false,
  mode: null,
  path: DEFAULT_BACKEND_ENV_PATH,
};

export function isRecognizedNodeEnv(rawNodeEnv = process.env.NODE_ENV) {
  const normalized = String(rawNodeEnv ?? '').trim().toLowerCase();
  return normalized === '' || VALID_NODE_ENV_VALUES.includes(normalized);
}

export function getEnvironmentMode(rawNodeEnv = process.env.NODE_ENV) {
  const normalized = String(rawNodeEnv ?? '').trim().toLowerCase();

  if (normalized === 'staging') {
    return 'staging';
  }

  if (normalized === 'production') {
    return 'production';
  }

  if (normalized === 'test') {
    return 'test';
  }

  return 'development';
}

export function shouldLoadEnvFile(mode = getEnvironmentMode()) {
  return mode !== 'test';
}

export function loadBackendEnv({
  mode = getEnvironmentMode(),
  path = DEFAULT_BACKEND_ENV_PATH,
  override = false,
  force = false,
} = {}) {
  if (lastLoadState.attempted && !force) {
    return {
      ...lastLoadState,
      env: process.env,
    };
  }

  const shouldLoad = shouldLoadEnvFile(mode);

  lastLoadState = {
    attempted: true,
    loaded: false,
    mode,
    path,
  };

  if (shouldLoad) {
    dotenv.config({ path, override });
    lastLoadState.loaded = true;
  }

  return {
    ...lastLoadState,
    env: process.env,
  };
}

export function resetEnvLoaderForTests() {
  lastLoadState = {
    attempted: false,
    loaded: false,
    mode: null,
    path: DEFAULT_BACKEND_ENV_PATH,
  };
}
