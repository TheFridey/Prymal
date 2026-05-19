const SENSITIVE_KEY_RE = /(authorization|cookie|set-cookie|password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client_secret|encryption_key)/i;
const CONTENT_KEY_RE = /^(content|text|html|prompt|rawContent|uploadedImageText)$/i;
const SENSITIVE_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{16,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
];

export function redactSensitiveText(value, replacement = '[REDACTED]') {
  let redacted = String(value ?? '');

  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

export function sanitizeErrorForClient(error, {
  fallback = 'Request failed.',
  internalFallback = 'Something went wrong. Please try again.',
} = {}) {
  const rawMessage = String(error?.message ?? '').trim();
  const status = Number(error?.status ?? error?.statusCode ?? 500);

  if (!rawMessage) {
    return status >= 500 ? internalFallback : fallback;
  }

  const redacted = redactSensitiveText(rawMessage).slice(0, 500).trim();

  if (status >= 500) {
    return internalFallback;
  }

  return redacted || fallback;
}

export function sanitizeStructuredData(value, {
  stripContent = true,
  replacement = '[REDACTED]',
} = {}) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeStructuredData(entry, { stripContent, replacement }));
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? redactSensitiveText(value, replacement) : value;
  }

  const clone = {};

  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key) || (stripContent && CONTENT_KEY_RE.test(key))) {
      clone[key] = replacement;
      continue;
    }

    clone[key] = sanitizeStructuredData(entry, { stripContent, replacement });
  }

  return clone;
}
