import { eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '../db/index.js';
import { loreChunks, loreDocuments } from '../db/schema.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const APPROX_CHUNK_TOKENS = 450;
const CHUNK_OVERLAP_TOKENS = 80;
const SIMILARITY_THRESHOLD = 0.72;
const EMBEDDING_BATCH_SIZE = 64;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is required for LORE indexing and search.');
    error.status = 503;
    error.code = 'LORE_EMBEDDINGS_NOT_CONFIGURED';
    throw error;
  }

  return new OpenAI({ apiKey });
}

export async function ingestDocument({ documentId, orgId, content, metadata = {} }) {
  const text = normalizeText(content);
  const document = await db.query.loreDocuments.findFirst({
    where: eq(loreDocuments.id, documentId),
  });

  if (!text) {
    await markDocument(documentId, { status: 'failed' });
    throw new Error('Document content is empty.');
  }

  await markDocument(documentId, {
    status: 'indexing',
    rawContent: text,
    wordCount: text.split(/\s+/).length,
  });

  try {
    await db.delete(loreChunks).where(eq(loreChunks.documentId, documentId));

    const sourceType = document?.sourceType ?? inferSourceType(metadata);
    const trust = buildTrustMetadata({
      sourceType,
      sourceUrl: document?.sourceUrl,
      metadata: document?.metadata ?? metadata,
    });
    const chunks = splitIntoChunks(text, { sourceType, title: document?.title ?? metadata.fileName ?? 'Untitled' });
    const embeddings = await embedBatch(chunks.map((chunk) => chunk.content));

    for (let index = 0; index < chunks.length; index += 50) {
      const rows = chunks.slice(index, index + 50).map((chunk, offset) => ({
        documentId,
        orgId,
        chunkIndex: index + offset,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[index + offset],
        metadata: {
          ...metadata,
          ...chunk.metadata,
          sourceType,
          documentVersion: document?.version ?? 1,
          trustScore: trust.score,
          trustLabel: trust.label,
          authorityScore: trust.authorityScore,
          verified: trust.verified,
          verifiedAt: trust.verifiedAt,
          versionChainId: metadata.versionChainId ?? document?.metadata?.versionChainId ?? documentId,
          supersedesDocumentId: metadata.supersedesDocumentId ?? document?.metadata?.supersedesDocumentId ?? null,
          isLatestVersion: metadata.isLatestVersion ?? document?.metadata?.isLatestVersion ?? true,
        },
      }));

      await db.insert(loreChunks).values(rows);
    }

    await markDocument(documentId, { status: 'indexed' });

    return {
      chunkCount: chunks.length,
    };
  } catch (error) {
    await markDocument(documentId, { status: 'failed' });
    throw error;
  }
}

export async function ragSearch({ orgId, query, limit = 5 }) {
  if (!query?.trim()) {
    return [];
  }

  const [queryEmbedding] = await embedBatch([query]);
  const result = await db.execute(sql`
    SELECT
      lc.id,
      lc.document_id AS "documentId",
      lc.content,
      lc.chunk_index AS "chunkIndex",
      lc.metadata,
      ld.title AS "documentTitle",
      ld.source_type AS "sourceType",
      ld.source_url AS "sourceUrl",
      ld.version AS "documentVersion",
      ld.updated_at AS "documentUpdatedAt",
      1 - (lc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
    FROM lore_chunks lc
    INNER JOIN lore_documents ld ON ld.id = lc.document_id
    WHERE lc.org_id = ${orgId}
      AND ld.status = 'indexed'
      AND 1 - (lc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) >= ${Math.max(SIMILARITY_THRESHOLD - 0.12, 0.5)}
    ORDER BY similarity DESC
    LIMIT ${Math.max(limit * 4, limit)}
  `);

  const queryKeywords = extractKeywords(query);
  const rankedRows = result.rows.map((row) => {
    const similarity = Number(row.similarity);
    const lexicalScore = computeLexicalScore(row.content, queryKeywords);
    const freshnessScore = computeFreshnessScore(row.documentUpdatedAt, row.metadata);
    const trust = buildTrustMetadata({
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      metadata: row.metadata,
    });
    const authorityScore = computeAuthorityScore({
      trustScore: trust.score,
      sourceType: row.sourceType,
      metadata: row.metadata,
    });
    const rankingScore = similarity * 0.58 + lexicalScore * 0.14 + freshnessScore * 0.14 + authorityScore * 0.14;

    return {
      ...row,
      similarity,
      lexicalScore: Number(lexicalScore.toFixed(4)),
      freshnessScore: Number(freshnessScore.toFixed(4)),
      authorityScore: Number(authorityScore.toFixed(4)),
      rankingScore: Number(rankingScore.toFixed(4)),
      retrievalMode: lexicalScore > 0 ? 'hybrid' : 'semantic',
      versionLineage: buildVersionLineage(row),
      citation: {
        title: row.documentTitle,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl,
        version: row.documentVersion,
        chunkIndex: row.chunkIndex,
        trustLabel: trust.label,
        trustScore: trust.score,
        authorityScore: Number(authorityScore.toFixed(4)),
        freshnessScore: Number(freshnessScore.toFixed(4)),
        verified: trust.verified,
        verifiedAt: trust.verifiedAt,
      },
    };
  });

  return rankedRows
    .map((row) => {
      const contradictionSignals = computeContradictionSignals(row, rankedRows);
      const staleWarning = buildStaleWarning(row);
      const contradictionPenalty = Math.min(contradictionSignals.length * 0.06, 0.18);
      const supersededPenalty = row.versionLineage?.isSuperseded ? 0.12 : 0;
      const finalScore = Math.max(row.rankingScore - contradictionPenalty - supersededPenalty, 0);
      const confidenceScore = computeRetrievalConfidence({
        similarity: row.similarity,
        freshnessScore: row.freshnessScore,
        authorityScore: row.authorityScore,
        contradictionSignals,
        isSuperseded: row.versionLineage?.isSuperseded,
      });

      return {
        ...row,
        contradictionSignals,
        staleWarning,
        finalScore: Number(finalScore.toFixed(4)),
        confidenceScore,
        confidenceLabel: getConfidenceLabel(confidenceScore),
      };
    })
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, limit);
}

export async function deleteDocument(documentId) {
  await db.delete(loreDocuments).where(eq(loreDocuments.id, documentId));
}

export async function detectKnowledgeGap({ orgId, query, threshold = 0.6 }) {
  const results = await ragSearch({ orgId, query, limit: 1 });

  if (results.length === 0) {
    return true;
  }

  return Number(results[0].similarity) < threshold;
}

export async function checkForContradictions({ orgId, newContent, documentId }) {
  const chunks = splitIntoChunks(newContent).slice(0, 8);
  const contradictions = [];

  for (const chunk of chunks) {
    const matches = await ragSearch({ orgId, query: chunk.content, limit: 3 });

    for (const match of matches) {
      if (match.documentId === documentId) {
        continue;
      }

      const numericConflict = detectNumericConflict(chunk.content, match.content);
      const negationConflict = detectNegationConflict(chunk.content, match.content);

      if (match.similarity >= 0.88 || numericConflict || negationConflict) {
        contradictions.push({
          existingDocumentId: match.documentId,
          existingDocumentTitle: match.documentTitle,
          similarity: match.similarity,
          type: numericConflict ? 'numeric_conflict' : negationConflict ? 'statement_conflict' : 'duplicate_or_overlap',
          staleWarning: match.staleWarning ?? null,
          excerpt: match.content.slice(0, 240),
        });
      }
    }
  }

  return contradictions;
}

function splitIntoChunks(text, context = {}) {
  const strategy = getChunkStrategy(context.sourceType);
  const paragraphs = normalizeText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks = [];
  let current = '';
  let tokenCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    if (current && tokenCount + paragraphTokens > strategy.chunkTokens) {
      chunks.push(buildChunk(current, context));

      const overlapText = current
        .split(/\s+/)
        .slice(-strategy.overlapTokens)
        .join(' ');

      current = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;
      tokenCount = estimateTokens(current);
      continue;
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;
    tokenCount += paragraphTokens;
  }

  if (current) {
    chunks.push(buildChunk(current, context));
  }

  return chunks.length > 0 ? chunks : [buildChunk(text, context)];
}

function buildChunk(content, context = {}) {
  return {
    content: content.trim(),
    tokenCount: estimateTokens(content),
    metadata: {
      charLength: content.length,
      contentFingerprint: buildContentFingerprint(content),
      chunkHeading: context.title ?? null,
    },
  };
}

async function embedBatch(texts) {
  const client = getClient();
  const embeddings = [];

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    embeddings.push(...response.data.sort((left, right) => left.index - right.index).map((entry) => entry.embedding));
  }

  return embeddings;
}

async function markDocument(documentId, values) {
  await db
    .update(loreDocuments)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(loreDocuments.id, documentId));
}

function normalizeText(value) {
  return value
    ?.replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / 4);
}

function inferSourceType(metadata) {
  const fileName = String(metadata.fileName ?? '').toLowerCase();

  if (fileName.endsWith('.csv')) return 'csv';
  if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) return 'markdown';
  if (fileName.endsWith('.pdf')) return 'pdf';
  if (fileName.endsWith('.docx')) return 'docx';
  if (metadata.sourceUrl) return 'url';
  return 'text';
}

function getChunkStrategy(sourceType) {
  if (sourceType === 'csv') {
    return { chunkTokens: 240, overlapTokens: 30 };
  }

  if (sourceType === 'markdown' || sourceType === 'docx') {
    return { chunkTokens: 520, overlapTokens: 90 };
  }

  if (sourceType === 'pdf') {
    return { chunkTokens: 380, overlapTokens: 70 };
  }

  return {
    chunkTokens: APPROX_CHUNK_TOKENS,
    overlapTokens: CHUNK_OVERLAP_TOKENS,
  };
}

function buildTrustMetadata({ sourceType, sourceUrl, metadata = {} }) {
  if (metadata?.trustScore != null && metadata?.trustLabel) {
    return {
      score: Number(metadata.trustScore),
      label: metadata.trustLabel,
      authorityScore: Number(metadata.authorityScore ?? metadata.trustScore),
      verified: Boolean(metadata.verified ?? metadata.verifiedAt),
      verifiedAt: metadata.verifiedAt ?? null,
    };
  }

  if (sourceType === 'manual' || sourceType === 'text' || sourceType === 'markdown' || sourceType === 'docx' || sourceType === 'pdf') {
    return {
      score: 0.92,
      label: 'internal',
      authorityScore: 0.94,
      verified: true,
      verifiedAt: metadata?.verifiedAt ?? metadata?.lastVerifiedAt ?? null,
    };
  }

  if (sourceType === 'csv') {
    return {
      score: 0.88,
      label: 'structured_internal',
      authorityScore: 0.9,
      verified: true,
      verifiedAt: metadata?.verifiedAt ?? metadata?.lastVerifiedAt ?? null,
    };
  }

  if (sourceType === 'url' && sourceUrl) {
    return {
      score: 0.78,
      label: 'web_import',
      authorityScore: sourceUrl.includes('.gov') || sourceUrl.includes('.edu') ? 0.88 : 0.74,
      verified: Boolean(metadata?.verified ?? metadata?.verifiedAt),
      verifiedAt: metadata?.verifiedAt ?? metadata?.lastVerifiedAt ?? null,
    };
  }

  return {
    score: 0.7,
    label: 'unknown',
    authorityScore: 0.68,
    verified: Boolean(metadata?.verified ?? metadata?.verifiedAt),
    verifiedAt: metadata?.verifiedAt ?? metadata?.lastVerifiedAt ?? null,
  };
}

function extractKeywords(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .slice(0, 8);
}

function computeLexicalScore(content, keywords) {
  if (!keywords.length) {
    return 0;
  }

  const haystack = content.toLowerCase();
  let matches = 0;

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      matches += 1;
    }
  }

  return matches / keywords.length;
}

export function computeFreshnessScore(dateValue, metadata = {}) {
  const verifiedAt = metadata?.verifiedAt ?? metadata?.lastVerifiedAt ?? null;
  const referenceDate = verifiedAt || dateValue;

  if (!referenceDate) {
    return 0.15;
  }

  const ageDays = Math.max((Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24), 0);

  if (ageDays <= 7) {
    return 1;
  }

  if (ageDays <= 30) {
    return 0.72;
  }

  if (ageDays <= 90) {
    return 0.44;
  }

  return 0.18;
}

export function computeAuthorityScore({ trustScore = 0.7, sourceType = 'unknown', metadata = {} }) {
  const verificationBoost = metadata?.verified || metadata?.verifiedAt ? 0.08 : 0;
  const contradictionPenalty = Math.min(Number(metadata?.contradictionCount ?? 0) * 0.05, 0.18);
  const sourceBoost = sourceType === 'csv'
    ? 0.04
    : ['manual', 'text', 'markdown', 'docx', 'pdf'].includes(sourceType)
      ? 0.06
      : sourceType === 'url'
        ? 0.02
        : 0;

  return Number(Math.max(Math.min(trustScore + verificationBoost + sourceBoost - contradictionPenalty, 1), 0).toFixed(4));
}

export function buildVersionLineage(row) {
  const metadata = row?.metadata ?? {};
  const versionChainId = metadata.versionChainId ?? row?.documentId ?? null;
  const supersedesDocumentId = metadata.supersedesDocumentId ?? null;
  const isLatestVersion = metadata.isLatestVersion ?? true;

  return {
    versionChainId,
    supersedesDocumentId,
    isLatestVersion,
    isSuperseded: !isLatestVersion || Boolean(supersedesDocumentId && row?.documentVersion && row.documentVersion < (metadata.latestVersion ?? row.documentVersion)),
    version: row?.documentVersion ?? metadata.documentVersion ?? 1,
  };
}

export function computeContradictionSignals(candidate, rows = []) {
  const signals = [];
  const candidateLineage = candidate.versionLineage ?? buildVersionLineage(candidate);

  for (const row of rows) {
    if (row.id === candidate.id) {
      continue;
    }

    const sameLineage = candidateLineage.versionChainId && candidateLineage.versionChainId === (row.versionLineage?.versionChainId ?? row.metadata?.versionChainId ?? row.documentId);
    const sameTitle = String(candidate.documentTitle ?? '').toLowerCase() === String(row.documentTitle ?? '').toLowerCase();
    if (!sameLineage && !sameTitle) {
      continue;
    }

    if (detectNumericConflict(candidate.content, row.content)) {
      signals.push({
        type: 'numeric_conflict',
        documentId: row.documentId,
        documentTitle: row.documentTitle,
      });
      continue;
    }

    if (detectNegationConflict(candidate.content, row.content)) {
      signals.push({
        type: 'statement_conflict',
        documentId: row.documentId,
        documentTitle: row.documentTitle,
      });
      continue;
    }

    if ((row.documentVersion ?? 1) > (candidate.documentVersion ?? 1)) {
      signals.push({
        type: 'newer_version_available',
        documentId: row.documentId,
        documentTitle: row.documentTitle,
      });
    }
  }

  return signals.slice(0, 3);
}

function buildStaleWarning(row) {
  if (row.versionLineage?.isSuperseded) {
    return 'A newer version of this source exists.';
  }

  if ((row.freshnessScore ?? 0) <= 0.2) {
    return 'This source is aging and may need verification.';
  }

  return null;
}

function computeRetrievalConfidence({
  similarity,
  freshnessScore,
  authorityScore,
  contradictionSignals,
  isSuperseded = false,
}) {
  const contradictionPenalty = Math.min((contradictionSignals?.length ?? 0) * 0.08, 0.24);
  const supersededPenalty = isSuperseded ? 0.1 : 0;
  const score = (similarity * 0.54) + (freshnessScore * 0.18) + (authorityScore * 0.28) - contradictionPenalty - supersededPenalty;
  return Number(Math.max(Math.min(score, 1), 0).toFixed(4));
}

function getConfidenceLabel(score) {
  if (score >= 0.82) {
    return 'high';
  }

  if (score >= 0.58) {
    return 'medium';
  }

  return 'low';
}

function detectNumericConflict(left, right) {
  const leftNumbers = extractNumbers(left);
  const rightNumbers = extractNumbers(right);

  if (leftNumbers.length === 0 || rightNumbers.length === 0) {
    return false;
  }

  return leftNumbers.some((value) => !rightNumbers.includes(value));
}

function detectNegationConflict(left, right) {
  const leftHasNegation = /\b(no|not|never|without|none)\b/i.test(left);
  const rightHasNegation = /\b(no|not|never|without|none)\b/i.test(right);
  return leftHasNegation !== rightHasNegation;
}

function extractNumbers(text) {
  return [...new Set((String(text ?? '').match(/\b\d+(?:\.\d+)?\b/g) ?? []).slice(0, 8))];
}

function buildContentFingerprint(content) {
  return Buffer.from(content.trim().slice(0, 80)).toString('base64').slice(0, 24);
}
