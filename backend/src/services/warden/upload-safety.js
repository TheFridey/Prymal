import path from 'node:path';
import { detectPromptInjection } from './prompt-injection-detector.js';
import { sanitizeExternalContent } from './warden-sanitizer.js';
import { createWardenDecision } from './warden-service.js';
import {
  DANGEROUS_UPLOAD_EXTENSIONS,
  WARDEN_CATEGORIES,
  WARDEN_SOURCE_TYPES,
  WARDEN_VERDICTS,
} from './warden-policy.js';

const ALLOWED_MIME_PREFIXES = [
  'text/',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
];

export async function prepareUploadForLore({ file, extractedText = '', mimeType, userId, orgId, dbClient } = {}) {
  const scan = scanUploadedFile({ file, extractedText, mimeType, userId, orgId });
  const decision = await createWardenDecision(scan, { dbClient });

  if (decision.verdict === WARDEN_VERDICTS.BLOCK) {
    return {
      allowed: false,
      sanitizedText: '',
      chunks: [],
      metadata: {
        fileName: file?.name ?? null,
        fileSize: file?.size ?? null,
        mimeType,
        warden: buildUploadWardenMetadata(decision),
      },
      wardenDecision: decision,
    };
  }

  const sanitized = sanitizeExternalContent(extractedText);
  const evidenceText = sanitized.content;

  return {
    allowed: true,
    sanitizedText: evidenceText,
    chunks: [evidenceText],
    metadata: {
      fileName: file?.name ?? null,
      fileSize: file?.size ?? null,
      mimeType,
      contentHash: sanitized.contentHash,
      warden: buildUploadWardenMetadata(decision),
      sourceType: 'UPLOAD',
      trustLevel: decision.verdict === WARDEN_VERDICTS.ALLOW_WITH_SANDBOX ? 'SANDBOXED' : 'UNTRUSTED',
      allowAsInstruction: false,
    },
    wardenDecision: decision,
  };
}

export function scanUploadedFile({ file, extractedText = '', mimeType, userId = null, orgId = null } = {}) {
  const fileName = String(file?.name ?? '');
  const extension = path.extname(fileName).toLowerCase();
  const categories = [];
  const reasons = [];

  if (DANGEROUS_UPLOAD_EXTENSIONS.has(extension)) {
    categories.push(WARDEN_CATEGORIES.DANGEROUS_UPLOAD);
    reasons.push(`Dangerous upload extension is blocked: ${extension}`);
  }

  const normalizedMime = String(mimeType ?? file?.type ?? '').toLowerCase();
  if (normalizedMime && !ALLOWED_MIME_PREFIXES.some((allowed) => normalizedMime.startsWith(allowed))) {
    categories.push(WARDEN_CATEGORIES.DANGEROUS_UPLOAD);
    reasons.push(`Upload MIME type is not supported for LORE ingestion: ${normalizedMime}`);
  }

  const injection = detectPromptInjection([
    extractedText,
    fileName,
    file?.altText,
    file?.caption,
    file?.metadata?.text,
  ].filter(Boolean).join('\n'));
  categories.push(...injection.categories);
  reasons.push(...injection.reasons);

  return {
    input: extractedText,
    surface: 'upload_ingest',
    action: 'scan_uploaded_file',
    sourceType: WARDEN_SOURCE_TYPES.UPLOAD,
    userId,
    orgId,
    fileId: file?.id ?? null,
    metadata: {
      fileName,
      fileSize: file?.size ?? null,
      mimeType: normalizedMime,
    },
    categories,
    reasons,
    verdict: categories.includes(WARDEN_CATEGORIES.DANGEROUS_UPLOAD)
      ? WARDEN_VERDICTS.BLOCK
      : categories.length > 0
        ? WARDEN_VERDICTS.ALLOW_WITH_SANDBOX
        : WARDEN_VERDICTS.ALLOW_WITH_SANDBOX,
  };
}

function buildUploadWardenMetadata(decision) {
  return {
    auditId: decision.auditId,
    verdict: decision.verdict,
    riskLevel: decision.riskLevel,
    categories: decision.categories,
    trustScore: decision.sourceTrust?.trustScore ?? 0,
    containsPromptInjection: decision.categories.includes('prompt_injection') || decision.categories.includes('role_injection'),
    containsToolInstruction: decision.categories.includes('tool_abuse'),
    containsPolicyBypass: decision.categories.includes('prompt_injection'),
    allowAsInstruction: false,
  };
}
