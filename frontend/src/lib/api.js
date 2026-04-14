const FALLBACK_API_BASE_URL = 'http://localhost:3001/api';
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

let authBindings = {
  getToken: async () => null,
  getOrgId: () => null,
};

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 500;
    this.data = options.data ?? null;
    this.code = options.code ?? options.data?.code ?? null;
    this.upgrade = Boolean(options.upgrade ?? options.data?.upgrade);
    this.retryAfter = Number(options.retryAfter ?? options.data?.retryAfter ?? 60);
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

export function configureApi(nextBindings) {
  authBindings = {
    ...authBindings,
    ...nextBindings,
  };
}

async function request(path, init = {}, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const headers = new Headers(init.headers ?? {});
  const isFormData = init.body instanceof FormData;
  const payload =
    init.body == null || isFormData || typeof init.body === 'string'
      ? init.body
      : JSON.stringify(init.body);

  if (payload && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const token = await authBindings.getToken?.();
  const orgId = authBindings.getOrgId?.();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (orgId) {
    headers.set('X-Org-Id', orgId);
  }

  const timeout =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
      : null;

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body: payload,
      signal: options.signal ?? controller.signal,
    });
  } catch (error) {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (error.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms. Check that the Prymal API is running.`, {
        status: 504,
      });
    }

    throw new ApiError(error.message || 'Network request failed.', {
      status: 503,
    });
  }

  if (timeout) {
    clearTimeout(timeout);
  }

  if (options.raw) {
    if (!response.ok) {
      throw await createApiError(response);
    }

    return response;
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError(data?.error ?? 'Rate limit reached.', {
        status: 429,
        code: 'RATE_LIMITED',
        upgrade: data?.upgrade ?? false,
        retryAfter: data?.retryAfter ?? 60,
        data,
      });
    }

    throw new ApiError(data?.error || data?.message || 'Request failed.', {
      status: response.status,
      data,
    });
  }

  return data;
}

async function upload(path, formData, options = {}) {
  if (!(formData instanceof FormData)) {
    throw new ApiError('Upload payload must be a FormData instance.', {
      status: 400,
    });
  }

  const token = await authBindings.getToken?.();
  const orgId = authBindings.getOrgId?.();
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? 'POST', `${API_BASE_URL}${path}`);
    xhr.responseType = 'text';
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Accept', 'application/json');

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (orgId) {
      xhr.setRequestHeader('X-Org-Id', orgId);
    }

    const extraHeaders = new Headers(options.headers ?? {});
    extraHeaders.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        options.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percent: null,
        });
        return;
      }

      options.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    });

    xhr.addEventListener('load', async () => {
      const response = new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: {
          'content-type': xhr.getResponseHeader('content-type') ?? 'application/json',
        },
      });

      try {
        const data = await parseResponse(response);

        if (xhr.status >= 400) {
          if (xhr.status === 429) {
            reject(
              new ApiError(data?.error ?? 'Rate limit reached.', {
                status: 429,
                code: 'RATE_LIMITED',
                upgrade: data?.upgrade ?? false,
                retryAfter: data?.retryAfter ?? 60,
                data,
              }),
            );
            return;
          }

          reject(
            new ApiError(data?.error || data?.message || 'Upload failed.', {
              status: xhr.status,
              data,
            }),
          );
          return;
        }

        resolve(data);
      } catch (error) {
        reject(
          new ApiError(error?.message || 'Upload failed.', {
            status: xhr.status || 500,
          }),
        );
      }
    });

    xhr.addEventListener('error', () => {
      reject(
        new ApiError('Network request failed.', {
          status: 503,
        }),
      );
    });

    xhr.addEventListener('timeout', () => {
      reject(
        new ApiError(`Request timed out after ${timeoutMs}ms. Check that the Prymal API is running.`, {
          status: 504,
        }),
      );
    });

    xhr.send(formData);
  });
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

async function createApiError(response) {
  const data = await parseResponse(response);
  if (response.status === 429) {
    return new ApiError(data?.error ?? 'Rate limit reached.', {
      status: 429,
      code: 'RATE_LIMITED',
      upgrade: data?.upgrade ?? false,
      retryAfter: data?.retryAfter ?? 60,
      data,
    });
  }

  return new ApiError(data?.error || data?.message || 'Request failed.', {
    status: response.status,
    data,
  });
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (!configured) {
    return FALLBACK_API_BASE_URL;
  }

  return configured.endsWith('/api') ? configured : `${configured.replace(/\/$/, '')}/api`;
}

export const api = {
  get: (path, init) => request(path, { ...init, method: 'GET' }),
  post: (path, body, init) => request(path, { ...init, method: 'POST', body }),
  put: (path, body, init) => request(path, { ...init, method: 'PUT', body }),
  patch: (path, body, init) => request(path, { ...init, method: 'PATCH', body }),
  delete: (path, init) => request(path, { ...init, method: 'DELETE' }),
  upload,
  sdp: (path, body, init) =>
    request(
      path,
      {
        ...init,
        method: 'POST',
        body,
        headers: {
          Accept: 'application/sdp',
          'Content-Type': 'application/sdp',
          ...(init?.headers ?? {}),
        },
      },
      { raw: true, timeoutMs: 20_000 },
    ),
  stream: (path, init) => request(path, init, { raw: true, timeoutMs: 20_000 }),
};

export function createIdempotentRequestInit(prefix = 'mutation') {
  return {
    headers: {
      'Idempotency-Key': `${prefix}-${crypto.randomUUID()}`,
    },
  };
}
