import { detectPromptInjection } from './prompt-injection-detector.js';
import { redactSecrets } from './warden-sanitizer.js';
import {
  getToolRisk,
  WARDEN_CATEGORIES,
  WARDEN_RISK_LEVELS,
  WARDEN_SOURCE_TYPES,
  WARDEN_TOOL_RISK,
  WARDEN_VERDICTS,
} from './warden-policy.js';

const UNTRUSTED_SOURCE_TYPES = new Set([
  WARDEN_SOURCE_TYPES.EXTERNAL_URL,
  WARDEN_SOURCE_TYPES.UPLOAD,
  WARDEN_SOURCE_TYPES.OCR,
  WARDEN_SOURCE_TYPES.PASTED,
  WARDEN_SOURCE_TYPES.LORE_RETRIEVAL,
]);

export function authorizeToolCall({
  toolName,
  args = {},
  userIntent = '',
  sourceContext = {},
  userId = null,
  orgId = null,
  isAdmin = false,
  confirmed = false,
} = {}) {
  const risk = getToolRisk(toolName);
  const categories = [];
  const reasons = [];
  const redactedArgs = redactSecrets(JSON.stringify(args ?? {}));
  const sourceType = sourceContext?.sourceType ?? sourceContext?.type ?? WARDEN_SOURCE_TYPES.USER;
  const instructionOrigin = sourceContext?.instructionOrigin ?? sourceType;
  const untrustedOrigin = UNTRUSTED_SOURCE_TYPES.has(instructionOrigin) || UNTRUSTED_SOURCE_TYPES.has(sourceType);
  const injection = detectPromptInjection(`${userIntent}\n${JSON.stringify(args ?? {})}\n${sourceContext?.content ?? ''}`);

  if (!userId || !orgId) {
    categories.push(WARDEN_CATEGORIES.CROSS_ORG_ACCESS);
    reasons.push('Tool calls require authenticated user and organisation scope.');
  }

  if (injection.detected) {
    categories.push(...injection.categories);
    reasons.push(...injection.reasons);
  }

  if (untrustedOrigin && risk !== WARDEN_TOOL_RISK.LOW) {
    categories.push(WARDEN_CATEGORIES.TOOL_ABUSE);
    reasons.push('A non-read-only tool call was requested from untrusted or retrieved content.');
  }

  if (risk === WARDEN_TOOL_RISK.HIGH && !confirmed && untrustedOrigin) {
    categories.push(WARDEN_CATEGORIES.DESTRUCTIVE_ACTION);
    reasons.push('High-risk tool calls from untrusted content require explicit human confirmation.');
  }

  if (risk === WARDEN_TOOL_RISK.CRITICAL) {
    categories.push(WARDEN_CATEGORIES.BILLING_ADMIN_ACTION);
    if (!confirmed) {
      reasons.push('Critical billing/admin/export/permission actions require explicit confirmation.');
    }
    if (!isAdmin) {
      reasons.push('Critical tool calls require admin permission.');
    }
  }

  if (redactedArgs.redactions.length > 0) {
    categories.push(WARDEN_CATEGORIES.SECRET_LEAK);
    reasons.push('Tool arguments contained secrets or credentials and were redacted for audit.');
  }

  let verdict = WARDEN_VERDICTS.ALLOW;
  let riskLevel = WARDEN_RISK_LEVELS.LOW;

  if (risk === WARDEN_TOOL_RISK.CRITICAL && (!confirmed || !isAdmin)) {
    verdict = WARDEN_VERDICTS.REQUIRE_CONFIRMATION;
    riskLevel = WARDEN_RISK_LEVELS.CRITICAL;
  } else if (untrustedOrigin && risk !== WARDEN_TOOL_RISK.LOW) {
    verdict = WARDEN_VERDICTS.BLOCK;
    riskLevel = WARDEN_RISK_LEVELS.HIGH;
  } else if (redactedArgs.redactions.length > 0) {
    verdict = WARDEN_VERDICTS.REDACT;
    riskLevel = WARDEN_RISK_LEVELS.MEDIUM;
  } else if (injection.detected) {
    verdict = WARDEN_VERDICTS.REQUIRE_CONFIRMATION;
    riskLevel = WARDEN_RISK_LEVELS.HIGH;
  }

  return {
    verdict,
    riskLevel,
    toolRisk: risk,
    categories: [...new Set(categories)],
    reasons,
    redactions: redactedArgs.redactions,
    safeArgs: safeJsonParse(redactedArgs.content, args),
    requiresHumanConfirmation: verdict === WARDEN_VERDICTS.REQUIRE_CONFIRMATION,
    canTriggerTools: verdict === WARDEN_VERDICTS.ALLOW || verdict === WARDEN_VERDICTS.REDACT,
  };
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
