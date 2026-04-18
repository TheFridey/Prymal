import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { loreChunks, loreDocuments } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { planAwareRateLimit } from '../middleware/rateLimit.js';
import { parseUploadedFile, SUPPORTED_UPLOAD_ACCEPT } from '../services/ingestion/parsers.js';
import {
  checkForContradictions,
  deleteDocument,
  detectKnowledgeGap,
  ingestDocument,
  ragSearch,
} from '../services/rag.js';

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

router.post('/text', requireOrg, loreIngestRateLimit, zValidator('json', uploadTextSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');
  const versioning = await resolveVersioning({
    orgId: org.orgId,
    title: payload.title,
    sourceType: payload.sourceType,
    sourceUrl: payload.sourceUrl ?? null,
  });
  const contradictions = await runContradictionCheckSafely({
    orgId: org.orgId,
    newContent: payload.content,
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
      metadata: versioning.metadata,
    })
    .returning();

  await markSupersededVersion(versioning.previousDocument, versioning.nextVersion);

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: payload.content,
  }).catch((error) => {
    console.error('[LORE] Text ingest failed:', error.message);
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
  const versioning = await resolveVersioning({
    orgId: org.orgId,
    title: explicitTitle || file.name,
    sourceType: parsed.sourceType,
    sourceUrl: parsed.metadata?.sourceUrl ?? null,
  });
  const contradictions = await runContradictionCheckSafely({
    orgId: org.orgId,
    newContent: parsed.text,
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
        ...versioning.metadata,
      },
    })
    .returning();

  await markSupersededVersion(versioning.previousDocument, versioning.nextVersion);

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: parsed.text,
    metadata: parsed.metadata,
  }).catch((error) => {
    console.error('[LORE] Upload ingest failed:', error.message);
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

  const normalized = responseText
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const contradictions = await runContradictionCheckSafely({
    orgId: org.orgId,
    newContent: normalized,
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
      metadata: versioning.metadata,
    })
    .returning();

  await markSupersededVersion(versioning.previousDocument, versioning.nextVersion);

  ingestDocument({
    documentId: document.id,
    orgId: org.orgId,
    content: normalized,
  }).catch((error) => {
    console.error('[LORE] URL ingest failed:', error.message);
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

  return context.json({ results, knowledgeGap });
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
