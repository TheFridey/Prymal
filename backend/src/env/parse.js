import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

export const DEFAULT_BACKEND_ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url));

let lastLoadState = {
  attempted: false,
  loaded: false,
  mode: null,
  path: DEFAULT_BACKEND_ENV_PATH,
};

export function getEnvironmentMode(rawNodeEnv = process.env.NODE_ENV) {
  if (rawNodeEnv === 'production') {
    return 'production';
  }

  if (rawNodeEnv === 'test') {
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
