import { zValidator } from '@hono/zod-validator';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { AGENT_IDS } from '../agents/config.js';
import { db } from '../db/index.js';
import { loreChunks, loreDocuments } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { planAwareRateLimit } from '../middleware/rateLimit.js';
import { parseUploadedFile, SUPPORTED_UPLOAD_ACCEPT } from '../services/ingestion/parsers.js';
import {
  checkForContradictions,
  buildRetrievalDiagnostics,
  deleteDocument,
  detectKnowledgeGap,
  ingestDocument,
  ragSearch,
} from '../services/rag.js';
import { recordLoreFeedback } from '../services/moat-feedback.js';
import {
  prepareUploadForLore,
  prepareUrlContentForLore,
  buildWardenTrace,
  scanPastedContent,
  WARDEN_VERDICTS,
} from '../services/warden/index.js';

import { recordProductEventOnce } from '../services/telemetry.js';

const router = new Hono();

const uploadTextSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(10).max(500000),
  sourceType: z.enum(['manual', 'url']).default('manual'),
  sourceUrl: z.string().url().optional(),
});

const crawlSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
});

const feedbackSchema = z.object({
  orgId: z.string().uuid().optional(),
  contentId: z.string().uuid(),
  outcomeType: z.enum(['success', 'failure', 'partial']),
  outcomeMetric: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(2000).optional(),
  sourceAgent: z.enum(AGENT_IDS).optional(),
  workflowId: z.string().uuid().optional(),
  workflowRunId: z.string().uuid().optional(),
  value: z.number().finite().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

async function maybeRecordFirstLoreDocument({ orgId, userId, documentId, source }) {
  const [{ docCount }] = await db
    .select({ docCount: count() })
    .from(loreDocuments)
    .where(eq(loreDocuments.orgId, orgId));
  if (docCount !== 1) {
    return;
  }
  await recordProductEventOnce({
    orgId,
    userId,
    eventName: 'first_lore_document_added',
    metadata: { documentId, source },
  });
}

const loreIngestRateLimit = planAwareRateLimit({
  free: 5,
  solo: 20,
  pro: 50,
  teams: 100,
  agency: null,
  keyPrefix: 'lore-ingest',
});

router.get('/', requireOrg, async (context) => {
  const org = context.get('org');

  const [documents, chunkCount] = await Promise.all([
    db.query.loreDocuments.findMany({
      where: eq(loreDocuments.orgId, org.orgId),
      orderBy: [desc(loreDocuments.createdAt)],
    }),
    db
      .select({
        count: sql`count(*)::int`,
      })
      .from(loreChunks)
      .where(eq(loreChunks.orgId, org.orgId)),
  ]);

  return context.json({
    documents,
    totalChunks: chunkCount[0]?.count ?? 0,
    acceptedUploads: SUPPORTED_UPLOAD_ACCEPT,
  });
});

router.post('/feedback', requireOrg, zValidator('json', feedbackSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');

  if (payload.orgId && payload.orgId !== org.orgId) {
    return context.json({ error: 'Feedback must be recorded for the authenticated organisation.' }, 403);
  }

  try {
    const { feedback, asset } = await recordLoreFeedback({
      orgId: org.orgId,
      userId: org.userId,
      contentId: payload.contentId,
      outcomeType: payload.outcomeType,
      outcomeMetric: payload.outcomeMetric,
      notes: payload.notes ?? null,
      sourceAgent: payload.sourceAgent ?? null,
      workflowId: payload.workflowId ?? null,
      workflowRunId: payload.workflowRunId ?? null,
      value: payload.value ?? null,
      metadata: payload.metadata ?? {},
    });

    return context.json({ feedback, content: asset }, 201);
  } catch (error) {
    return context.json({ error: error.message || 'Feedback could not be recorded.' }, 404);
  }
});

router.post('/text', requireOrg, loreIngestRateLimit, zValidator('json', uploadTextSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');
  const wardenDecision = await scanPastedContent({
    text: payload.content,
    userId: org.userId,
    orgId: org.orgId,
  });

  if (wardenDecision.verdict === WARDEN_VERDICTS.BLOCK) {
    return context.json({
      error: 'That content cannot be added to LORE.',
      message: 'The pasted content contains unsafe instructions or material that cannot be stored.',
      wardenAuditId: wardenDecision.auditId,
    }, 400);
  }

  const safeContent = wardenDecision.safeContent;
  const versioning = await resolveVersioning({
    orgId: org.orgId,
    title: payload.title,
    sourceType: payload.sourceType,
    sourceUrl: payload.sourceUrl ?? null,
  });
  const contradictions = await runContradictionCheckSafely({
    orgId: org.orgId,
    newContent: safeContent,
    sourceLabel: 'Text ingest',
  });

  const [document] = await db
    .insert(loreDocuments)
    .values({
      orgId: org.orgId,
      uploadedBy: org.userId,
      title: payload.title,
      sourceType: payload.sourceType,
      sourceUrl: payload.sourceUrl ?? null,
      status: 'pending',
      version: versioning.nextVersion,
      metadata: {
        ...versioning.metadata,
        ...buildWardenLoreMetadata({
          decision: wardenDecision,
          sourceType: payload.sourceType === 'url' ? 'EXTERNAL_URL' : 'PASTED',
        }),
      },
    })
    .returning();

  await markSupersededVersion(versioning.previousDocument, versioning.nextVersion);

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: safeContent,
    metadata: document.metadata,
  }).catch((error) => {
    console.error('[LORE] Text ingest failed:', error.message);
  });

  await maybeRecordFirstLoreDocument({
    orgId: org.orgId,
    userId: org.userId,
    documentId: document.id,
    source: 'text',
  });

  return context.json(
    {
      document,
      contradictions,
      message: 'Document queued for indexing.',
    },
    201,
  );
});

router.post('/upload', requireOrg, loreIngestRateLimit, async (context) => {
  const org = context.get('org');
  const formData = await context.req.formData();
  const file = formData.get('file');
  const explicitTitle = String(formData.get('title') ?? '').trim();

  if (!(file instanceof File)) {
    return context.json({ error: 'No file provided.' }, 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return context.json({ error: 'File too large. Maximum size is 10MB.' }, 400);
  }

  const parsed = await parseUploadedFile(file);
  const uploadSafety = await prepareUploadForLore({
    file,
    extractedText: parsed.text,
    mimeType: parsed.metadata?.mimeType,
    userId: org.userId,
    orgId: org.orgId,
  });

  if (!uploadSafety.allowed) {
    return context.json({
      error: 'That file cannot be added to LORE.',
      message: 'The uploaded file type or contents were blocked by Prymal safety checks.',
      wardenAuditId: uploadSafety.wardenDecision.auditId,
    }, 400);
  }

  const versioning = await resolveVersioning({
    orgId: org.orgId,
    title: explicitTitle || file.name,
    sourceType: parsed.sourceType,
    sourceUrl: parsed.metadata?.sourceUrl ?? null,
  });
  const contradictions = await runContradictionCheckSafely({
    orgId: org.orgId,
    newContent: uploadSafety.sanitizedText,
    sourceLabel: 'File upload',
  });

  const [document] = await db
    .insert(loreDocuments)
    .values({
      orgId: org.orgId,
      uploadedBy: org.userId,
      title: explicitTitle || file.name,
      sourceType: parsed.sourceType,
      status: 'pending',
      version: versioning.nextVersion,
      metadata: {
        ...parsed.metadata,
        ...uploadSafety.metadata,
        ...versioning.metadata,
      },
    })
    .returning();

  await markSupersededVersion(versioning.previousDocument, versioning.nextVersion);

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: uploadSafety.sanitizedText,
    metadata: document.metadata,
  }).catch((error) => {
    console.error('[LORE] Upload ingest failed:', error.message);
  });

  await maybeRecordFirstLoreDocument({
    orgId: org.orgId,
    userId: org.userId,
    documentId: document.id,
    source: 'upload',
  });

  return context.json(
    {
      document,
      contradictions,
      message: 'File queued for indexing.',
    },
    201,
  );
});

router.post('/crawl', requireOrg, loreIngestRateLimit, zValidator('json', crawlSchema), async (context) => {
  const org = context.get('org');
  const { url, title } = context.req.valid('json');
  const versioning = await resolveVersioning({
    orgId: org.orgId,
    title: title ?? new URL(url).hostname,
    sourceType: 'url',
    sourceUrl: url,
  });

  let responseText = '';

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PRYMAL-LORE/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    responseText = await response.text();
  } catch (error) {
    return context.json({ error: `Could not fetch URL: ${error.message}` }, 400);
  }

  const preparedUrl = await prepareUrlContentForLore({
    url,
    html: responseText,
    userId: org.userId,
    orgId: org.orgId,
  });

  if (!preparedUrl.allowed) {
    return context.json({
      error: 'That URL cannot be added to LORE.',
      message: 'The page contains unsafe content that cannot be ingested.',
      wardenAuditId: preparedUrl.wardenDecision.auditId,
    }, 400);
  }

  const contradictions = await runContradictionCheckSafely({
    orgId: org.orgId,
    newContent: preparedUrl.sanitizedText,
    sourceLabel: 'URL crawl',
  });

  const [document] = await db
    .insert(loreDocuments)
    .values({
      orgId: org.orgId,
      uploadedBy: org.userId,
      title: title ?? new URL(url).hostname,
      sourceType: 'url',
      sourceUrl: url,
      status: 'pending',
      version: versioning.nextVersion,
      metadata: {
        ...versioning.metadata,
        ...preparedUrl.metadata,
      },
    })
    .returning();

  await markSupersededVersion(versioning.previousDocument, versioning.nextVersion);

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: preparedUrl.sanitizedText,
    metadata: document.metadata,
  }).catch((error) => {
    console.error('[LORE] URL ingest failed:', error.message);
  });

  await maybeRecordFirstLoreDocument({
    orgId: org.orgId,
    userId: org.userId,
    documentId: document.id,
    source: 'crawl',
  });

  return context.json({ document, contradictions, message: 'URL queued for indexing.' }, 201);
});

router.get('/search', requireOrg, async (context) => {
  const org = context.get('org');
  const query = context.req.query('q');
  const limit = Number.parseInt(context.req.query('limit') ?? '5', 10);

  if (!query) {
    return context.json({ error: 'Query parameter "q" is required.' }, 400);
  }

  const [results, knowledgeGap] = await Promise.all([
    ragSearch({ orgId: org.orgId, query, limit: Math.min(Math.max(limit, 1), 10) }),
    detectKnowledgeGap({ orgId: org.orgId, query }),
  ]);

  const diagnostics = buildRetrievalDiagnostics({ results, knowledgeGap });

  return context.json({
    results,
    knowledgeGap,
    diagnostics,
  });
});

router.get('/:id', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const document = await db.query.loreDocuments.findFirst({
    where: and(eq(loreDocuments.id, id), eq(loreDocuments.orgId, org.orgId)),
  });

  if (!document) {
    return context.json({ error: 'Document not found.' }, 404);
  }

  return context.json({ document });
});

router.delete('/:id', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const document = await db.query.loreDocuments.findFirst({
    where: and(eq(loreDocuments.id, id), eq(loreDocuments.orgId, org.orgId)),
  });

  if (!document) {
    return context.json({ error: 'Document not found.' }, 404);
  }

  await deleteDocument(document.id);
  return context.json({ success: true });
});

router.post('/:id/reindex', requireOrg, async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const document = await db.query.loreDocuments.findFirst({
    where: and(eq(loreDocuments.id, id), eq(loreDocuments.orgId, org.orgId)),
  });

  if (!document) {
    return context.json({ error: 'Document not found.' }, 404);
  }

  if (!document.rawContent) {
    return context.json({ error: 'This document has no stored content to re-index.' }, 400);
  }

  await db
    .update(loreDocuments)
    .set({
      version: document.version + 1,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(loreDocuments.id, document.id));

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: document.rawContent,
    metadata: document.metadata,
  }).catch((error) => {
    console.error('[LORE] Reindex failed:', error.message);
  });

  return context.json({ message: 'Re-indexing started.' });
});

export default router;

async function resolveVersioning({ orgId, title, sourceType, sourceUrl = null }) {
  const previousDocument = await db.query.loreDocuments.findFirst({
    where: and(
      eq(loreDocuments.orgId, orgId),
      sourceUrl
        ? eq(loreDocuments.sourceUrl, sourceUrl)
        : and(eq(loreDocuments.title, title), eq(loreDocuments.sourceType, sourceType)),
    ),
    orderBy: [desc(loreDocuments.updatedAt)],
  });

  if (!previousDocument) {
    return {
      previousDocument: null,
      nextVersion: 1,
      metadata: {
        versionChainId: null,
        supersedesDocumentId: null,
        isLatestVersion: true,
        latestVersion: 1,
      },
    };
  }

  const versionChainId = previousDocument.metadata?.versionChainId ?? previousDocument.id;
  const nextVersion = Math.max(Number(previousDocument.version ?? 1) + 1, Number(previousDocument.metadata?.latestVersion ?? 1) + 1);

  return {
    previousDocument,
    nextVersion,
    metadata: {
      versionChainId,
      supersedesDocumentId: previousDocument.id,
      isLatestVersion: true,
      latestVersion: nextVersion,
    },
  };
}

async function markSupersededVersion(previousDocument, latestVersion) {
  if (!previousDocument) {
    return;
  }

  await db
    .update(loreDocuments)
    .set({
      metadata: {
        ...(previousDocument.metadata ?? {}),
        versionChainId: previousDocument.metadata?.versionChainId ?? previousDocument.id,
        isLatestVersion: false,
        latestVersion,
      },
      updatedAt: new Date(),
    })
    .where(eq(loreDocuments.id, previousDocument.id));
}

async function runContradictionCheckSafely({ orgId, newContent, documentId, sourceLabel }) {
  try {
    return await checkForContradictions({ orgId, newContent, documentId });
  } catch (error) {
    if (error?.status || error?.code === 'LORE_EMBEDDINGS_NOT_CONFIGURED') {
      throw error;
    }

    console.warn(`[LORE] ${sourceLabel} contradiction pre-check skipped:`, error.message);
    return [];
  }
}

function buildWardenLoreMetadata({ decision, sourceType }) {
  return {
    sourceType,
    trustLevel: decision.verdict === WARDEN_VERDICTS.ALLOW_WITH_SANDBOX ? 'SANDBOXED' : 'UNTRUSTED',
    trustScore: decision.sourceTrust?.trustScore ?? 0,
    wardenAuditId: decision.auditId,
    containsPromptInjection: decision.categories.includes('prompt_injection') || decision.categories.includes('role_injection'),
    containsToolInstruction: decision.categories.includes('tool_abuse'),
    containsPolicyBypass: decision.categories.includes('prompt_injection'),
    allowAsInstruction: false,
    ingestedAt: new Date().toISOString(),
    redactionCount: decision.redactions?.length ?? 0,
    warden: buildWardenTrace(decision),
  };
}
