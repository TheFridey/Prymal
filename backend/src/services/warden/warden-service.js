import { randomUUID } from 'node:crypto';
import { detectPromptInjection } from './prompt-injection-detector.js';
import { classifyMediaPromptSafety } from './media-safety.js';
import { authorizeToolCall as authorizeToolCallDecision } from './tool-safety.js';
import { recordWardenAuditEvent } from './warden-audit.js';
import { sanitizeExternalContent, wrapUntrustedEvidence } from './warden-sanitizer.js';
import {
  WARDEN_CATEGORIES,
  WARDEN_RISK_LEVELS,
  WARDEN_SOURCE_TYPES,
  WARDEN_VERDICTS,
  getWardenConfig,
} from './warden-policy.js';

export async function createWardenDecision(input = {}, { dbClient } = {}) {
  const config = getWardenConfig();
  const sourceType = input.sourceType ?? WARDEN_SOURCE_TYPES.USER;
  const sanitized = sanitizeExternalContent(input.input ?? input.content ?? '', {
    maxChars: config.maxContentChars,
  });
  const categories = [...new Set(input.categories ?? [])];
  const reasons = [...(input.reasons ?? [])];

  if (sanitized.redactions.length > 0) {
    categories.push(WARDEN_CATEGORIES.SECRET_LEAK);
    reasons.push('Secrets or credentials were detected and redacted.');
  }

  const riskLevel = input.riskLevel ?? deriveRiskLevel(categories, sourceType);
  const verdict = input.verdict ?? deriveVerdict({ categories, sourceType, riskLevel });
  const sourceTrust = buildSourceTrust({ sourceType, verdict, categories });
  const audit = await recordWardenAuditEvent({
    orgId: input.orgId ?? null,
    userId: input.userId ?? null,
    surface: input.surface ?? 'unknown',
    sourceType,
    action: input.action ?? 'scan',
    verdict,
    riskLevel,
    categories,
    reasons,
    content: sanitized.content,
    redactionCount: sanitized.redactions.length,
    sourceUrl: input.sourceUrl ?? null,
    fileId: input.fileId ?? null,
    toolName: input.toolName ?? null,
    provider: input.provider ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      contentHash: sanitized.contentHash,
      truncated: sanitized.truncated,
    },
    dbClient,
  });

  return {
    verdict,
    riskLevel,
    categories,
    reasons,
    safeContent: sanitized.content,
    redactions: sanitized.redactions,
    sourceTrust,
    canReachLore: verdict !== WARDEN_VERDICTS.BLOCK,
    canReachAgentPrompt: verdict !== WARDEN_VERDICTS.BLOCK,
    canTriggerTools: verdict === WARDEN_VERDICTS.ALLOW || verdict === WARDEN_VERDICTS.REDACT,
    canTriggerMediaGeneration: verdict === WARDEN_VERDICTS.ALLOW || verdict === WARDEN_VERDICTS.REDACT,
    requiresHumanConfirmation: verdict === WARDEN_VERDICTS.REQUIRE_CONFIRMATION,
    auditId: audit?.id ?? `warden-${randomUUID()}`,
  };
}

export async function classifyUserIntent(input, context = {}) {
  const text = String(input ?? '');
  const injection = detectPromptInjection(text);
  return createWardenDecision({
    input: text,
    surface: context.surface ?? 'user_intent',
    action: 'classify_user_intent',
    sourceType: WARDEN_SOURCE_TYPES.USER,
    orgId: context.orgId,
    userId: context.userId,
    categories: injection.categories,
    reasons: injection.reasons,
    verdict: injection.detected ? WARDEN_VERDICTS.REQUIRE_CONFIRMATION : WARDEN_VERDICTS.ALLOW,
  }, context);
}

export async function classifyExternalContent(content, context = {}) {
  const injection = detectPromptInjection(content);
  return createWardenDecision({
    input: content,
    surface: context.surface ?? 'external_content',
    action: 'classify_external_content',
    sourceType: context.sourceType ?? WARDEN_SOURCE_TYPES.EXTERNAL_URL,
    orgId: context.orgId,
    userId: context.userId,
    categories: injection.categories,
    reasons: injection.reasons,
    verdict: injection.detected ? WARDEN_VERDICTS.ALLOW_WITH_SANDBOX : WARDEN_VERDICTS.ALLOW_WITH_SANDBOX,
  }, context);
}

export async function scanPastedContent({ text, userId, orgId, dbClient } = {}) {
  const injection = detectPromptInjection(text);
  return createWardenDecision({
    input: text,
    surface: 'pasted_content',
    action: 'scan_pasted_content',
    sourceType: WARDEN_SOURCE_TYPES.PASTED,
    orgId,
    userId,
    categories: injection.categories,
    reasons: injection.reasons,
    verdict: injection.detected ? WARDEN_VERDICTS.ALLOW_WITH_SANDBOX : WARDEN_VERDICTS.ALLOW_WITH_SANDBOX,
  }, { dbClient });
}

export async function scanMediaPrompt({ prompt, uploadedImageText = '', imageMetadata = {}, userId, orgId, dbClient, provider = null } = {}) {
  const media = classifyMediaPromptSafety({ prompt, uploadedImageText, imageMetadata });
  return createWardenDecision({
    input: [prompt, uploadedImageText].filter(Boolean).join('\n\n'),
    surface: 'media_generation',
    action: 'scan_media_prompt',
    sourceType: uploadedImageText ? WARDEN_SOURCE_TYPES.OCR : WARDEN_SOURCE_TYPES.USER,
    orgId,
    userId,
    provider,
    categories: media.categories,
    reasons: media.reasons,
    verdict: media.verdict,
    riskLevel: media.riskLevel,
    metadata: { imageMetadata },
  }, { dbClient });
}

export async function scanToolRequest({ toolName, arguments: args = {}, sourceContext = {}, userIntent = '', userId, orgId, isAdmin, confirmed, dbClient } = {}) {
  const tool = authorizeToolCallDecision({
    toolName,
    args,
    userIntent,
    sourceContext,
    userId,
    orgId,
    isAdmin,
    confirmed,
  });
  return createWardenDecision({
    input: JSON.stringify({ toolName, args: tool.safeArgs, userIntent }),
    surface: 'tool_execution',
    action: 'authorize_tool_call',
    sourceType: sourceContext?.sourceType ?? WARDEN_SOURCE_TYPES.USER,
    orgId,
    userId,
    toolName,
    categories: tool.categories,
    reasons: tool.reasons,
    verdict: tool.verdict,
    riskLevel: tool.riskLevel,
    metadata: { toolRisk: tool.toolRisk },
  }, { dbClient });
}

export { sanitizeExternalContent, wrapUntrustedEvidence };

function deriveRiskLevel(categories = [], sourceType) {
  if (categories.some((category) => [
    WARDEN_CATEGORIES.MEDIA_ILLEGAL_SEXUAL,
    WARDEN_CATEGORIES.MEDIA_HATE_EXTREMISM,
    WARDEN_CATEGORIES.MEDIA_ILLEGAL_HARM,
    WARDEN_CATEGORIES.BILLING_ADMIN_ACTION,
  ].includes(category))) {
    return WARDEN_RISK_LEVELS.CRITICAL;
  }

  if (categories.some((category) => [
    WARDEN_CATEGORIES.PROMPT_INJECTION,
    WARDEN_CATEGORIES.ROLE_INJECTION,
    WARDEN_CATEGORIES.TOOL_ABUSE,
    WARDEN_CATEGORIES.SECRET_EXFILTRATION,
    WARDEN_CATEGORIES.HIDDEN_PROMPT,
    WARDEN_CATEGORIES.DANGEROUS_UPLOAD,
  ].includes(category))) {
    return WARDEN_RISK_LEVELS.HIGH;
  }

  if (categories.includes(WARDEN_CATEGORIES.SECRET_LEAK) || sourceType !== WARDEN_SOURCE_TYPES.USER) {
    return WARDEN_RISK_LEVELS.MEDIUM;
  }

  return WARDEN_RISK_LEVELS.LOW;
}

function deriveVerdict({ categories, sourceType, riskLevel }) {
  if (categories.includes(WARDEN_CATEGORIES.DANGEROUS_UPLOAD) || riskLevel === WARDEN_RISK_LEVELS.CRITICAL) {
    return WARDEN_VERDICTS.BLOCK;
  }

  if (categories.includes(WARDEN_CATEGORIES.SECRET_LEAK)) {
    return WARDEN_VERDICTS.REDACT;
  }

  if (sourceType !== WARDEN_SOURCE_TYPES.USER) {
    return WARDEN_VERDICTS.ALLOW_WITH_SANDBOX;
  }

  if (riskLevel === WARDEN_RISK_LEVELS.HIGH) {
    return WARDEN_VERDICTS.REQUIRE_CONFIRMATION;
  }

  return WARDEN_VERDICTS.ALLOW;
}

function buildSourceTrust({ sourceType, verdict, categories }) {
  const trusted = sourceType === WARDEN_SOURCE_TYPES.SYSTEM || sourceType === WARDEN_SOURCE_TYPES.USER;
  const suspicious = categories.length > 0;
  let trustScore = trusted ? 0.85 : 0.35;
  if (verdict === WARDEN_VERDICTS.ALLOW_WITH_SANDBOX) trustScore = 0.25;
  if (verdict === WARDEN_VERDICTS.BLOCK) trustScore = 0;
  if (suspicious) trustScore = Math.min(trustScore, 0.2);

  return {
    type: sourceType,
    trusted: trusted && !suspicious,
    trustScore,
  };
}
