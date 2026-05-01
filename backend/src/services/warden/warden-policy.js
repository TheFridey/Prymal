export const WARDEN_VERDICTS = {
  ALLOW: 'ALLOW',
  ALLOW_WITH_SANDBOX: 'ALLOW_WITH_SANDBOX',
  REDACT: 'REDACT',
  REQUIRE_CONFIRMATION: 'REQUIRE_CONFIRMATION',
  BLOCK: 'BLOCK',
};

export const WARDEN_RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const WARDEN_SOURCE_TYPES = {
  USER: 'USER',
  EXTERNAL_URL: 'EXTERNAL_URL',
  UPLOAD: 'UPLOAD',
  OCR: 'OCR',
  PASTED: 'PASTED',
  LORE_RETRIEVAL: 'LORE_RETRIEVAL',
  SYSTEM: 'SYSTEM',
};

export const WARDEN_CATEGORIES = {
  PROMPT_INJECTION: 'prompt_injection',
  ROLE_INJECTION: 'role_injection',
  TOOL_ABUSE: 'tool_abuse',
  SECRET_EXFILTRATION: 'secret_exfiltration',
  SECRET_LEAK: 'secret_leak',
  ENCODED_PAYLOAD: 'encoded_payload',
  HIDDEN_PROMPT: 'hidden_prompt',
  DANGEROUS_UPLOAD: 'dangerous_upload',
  MEDIA_ILLEGAL_SEXUAL: 'media_illegal_sexual',
  MEDIA_HATE_EXTREMISM: 'media_hate_extremism',
  MEDIA_ILLEGAL_HARM: 'media_illegal_harm',
  PROVIDER_JAILBREAK: 'provider_jailbreak',
  CROSS_ORG_ACCESS: 'cross_org_access',
  DESTRUCTIVE_ACTION: 'destructive_action',
  BILLING_ADMIN_ACTION: 'billing_admin_action',
};

export const WARDEN_TOOL_RISK = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const LOW_RISK_TOOLS = new Set([
  'lore_search',
  'knowledge_gap_check',
  'memory_read',
  'live_web_research',
  'vision_input',
  'file_input',
]);

export const MEDIUM_RISK_TOOLS = new Set([
  'create_draft',
  'external_request',
]);

export const HIGH_RISK_TOOLS = new Set([
  'email_send',
  'workflow_execute',
  'workflow_run',
  'post_external',
  'integration_write',
  'file_delete',
]);

export const CRITICAL_RISK_TOOLS = new Set([
  'billing_update',
  'billing_credit_grant',
  'admin_action',
  'delete_org',
  'delete_user',
  'permission_change',
  'export_data',
  'env_access',
  'secret_read',
]);

export const DANGEROUS_UPLOAD_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.dll',
  '.scr',
  '.jar',
  '.msi',
  '.vbs',
  '.js',
  '.com',
  '.pif',
  '.docm',
  '.xlsm',
  '.pptm',
]);

export const DEFAULT_WARDEN_CONFIG = {
  enabled: true,
  strictMode: false,
  maxContentChars: 500_000,
  maxUrlTextChars: 240_000,
  maxAuditExcerptChars: 500,
  mediaStrictness: 'standard',
  modelClassifierEnabled: true,
  modelClassifierMode: 'auto',
  modelClassifierModel: 'gpt-5-mini',
  modelClassifierTimeoutMs: 3000,
  modelClassifierMaxChars: 12000,
  modelClassifierCacheTtlSeconds: 900,
  modelClassifierCacheMax: 1000,
};

export function getWardenConfig(env = process.env) {
  return {
    enabled: String(env.WARDEN_ENABLED ?? 'true').toLowerCase() !== 'false',
    strictMode: String(env.WARDEN_STRICT_MODE ?? 'false').toLowerCase() === 'true',
    maxContentChars: Number(env.WARDEN_MAX_CONTENT_CHARS ?? DEFAULT_WARDEN_CONFIG.maxContentChars),
    maxUrlTextChars: Number(env.WARDEN_MAX_URL_TEXT_CHARS ?? DEFAULT_WARDEN_CONFIG.maxUrlTextChars),
    maxAuditExcerptChars: Number(env.WARDEN_AUDIT_EXCERPT_CHARS ?? DEFAULT_WARDEN_CONFIG.maxAuditExcerptChars),
    mediaStrictness: String(env.WARDEN_MEDIA_SAFETY_STRICTNESS ?? DEFAULT_WARDEN_CONFIG.mediaStrictness),
    modelClassifierEnabled: String(env.WARDEN_MODEL_CLASSIFIER_ENABLED ?? DEFAULT_WARDEN_CONFIG.modelClassifierEnabled).toLowerCase() !== 'false',
    modelClassifierMode: String(env.WARDEN_MODEL_CLASSIFIER_MODE ?? DEFAULT_WARDEN_CONFIG.modelClassifierMode).toLowerCase(),
    modelClassifierModel: String(env.WARDEN_MODEL_CLASSIFIER_MODEL ?? DEFAULT_WARDEN_CONFIG.modelClassifierModel),
    modelClassifierTimeoutMs: Number(env.WARDEN_MODEL_CLASSIFIER_TIMEOUT_MS ?? DEFAULT_WARDEN_CONFIG.modelClassifierTimeoutMs),
    modelClassifierMaxChars: Number(env.WARDEN_MODEL_CLASSIFIER_MAX_CHARS ?? DEFAULT_WARDEN_CONFIG.modelClassifierMaxChars),
    modelClassifierCacheTtlSeconds: Number(env.WARDEN_MODEL_CLASSIFIER_CACHE_TTL_SECONDS ?? DEFAULT_WARDEN_CONFIG.modelClassifierCacheTtlSeconds),
    modelClassifierCacheMax: Number(env.WARDEN_MODEL_CLASSIFIER_CACHE_MAX ?? DEFAULT_WARDEN_CONFIG.modelClassifierCacheMax),
  };
}

export function getToolRisk(toolName) {
  const normalized = String(toolName ?? '').trim();

  if (!normalized) {
    return WARDEN_TOOL_RISK.HIGH;
  }

  if (CRITICAL_RISK_TOOLS.has(normalized) || /billing|admin|permission|delete_org|delete_user|secret|env/i.test(normalized)) {
    return WARDEN_TOOL_RISK.CRITICAL;
  }
  if (HIGH_RISK_TOOLS.has(normalized) || /send|post|delete|execute|workflow|integration.*write/i.test(normalized)) {
    return WARDEN_TOOL_RISK.HIGH;
  }
  if (MEDIUM_RISK_TOOLS.has(normalized) || /request|create|draft/i.test(normalized)) {
    return WARDEN_TOOL_RISK.MEDIUM;
  }

  return WARDEN_TOOL_RISK.HIGH;
}
