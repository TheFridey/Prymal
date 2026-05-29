import { db } from '../../db/index.js';
import { wardenAuditEvents } from '../../db/schema.js';
import { hashContent } from './prompt-injection-detector.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ component: 'warden-audit' });

export async function recordWardenAuditEvent({
  orgId = null,
  userId = null,
  surface = 'unknown',
  sourceType = 'USER',
  action = 'scan',
  verdict,
  riskLevel,
  categories = [],
  reasons = [],
  content = '',
  redactionCount = 0,
  sourceUrl = null,
  fileId = null,
  toolName = null,
  provider = null,
  metadata = {},
  dbClient = db,
} = {}) {
  const contentHash = content ? hashContent(content) : null;
  const safeMetadata = sanitizeAuditMetadata(metadata);

  try {
    const [event] = await dbClient
      .insert(wardenAuditEvents)
      .values({
        orgId,
        userId,
        surface,
        sourceType,
        action,
        verdict,
        riskLevel,
        categories,
        reasons,
        contentHash,
        redactionCount,
        sourceUrl,
        fileId,
        toolName,
        provider,
        metadata: safeMetadata,
      })
      .returning();

    return event;
  } catch (error) {
    log.warn({ err: error }, 'warden.audit_record_failed');
    return {
      id: `warden-local-${Date.now()}`,
      fallback: true,
    };
  }
}

export function sanitizeAuditMetadata(metadata = {}) {
  const clone = JSON.parse(JSON.stringify(metadata ?? {}));
  delete clone.content;
  delete clone.rawContent;
  delete clone.html;
  delete clone.text;
  delete clone.prompt;
  delete clone.uploadedImageText;
  return clone;
}
