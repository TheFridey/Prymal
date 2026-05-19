function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, number));
}

function mapOrigin(source = {}) {
  const type = String(source.sourceType ?? source.mode ?? '').toLowerCase();
  if (type === 'web' || type === 'search' || type === 'external_url') {
    return 'live_research';
  }
  if (type === 'upload' || type === 'pdf' || type === 'docx' || type === 'txt' || type === 'markdown' || type === 'csv') {
    return 'uploaded_files';
  }
  return 'workspace_knowledge';
}

function toFreshnessLabel(source = {}) {
  if (source.staleWarning) {
    return 'stale';
  }
  const score = Number(source.freshnessScore ?? source.citation?.freshnessScore);
  if (!Number.isFinite(score)) {
    return 'unknown';
  }
  if (score >= 0.7) return 'fresh';
  if (score >= 0.4) return 'mixed';
  return 'stale';
}

function toConfidenceLabel(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['high', 'medium', 'low'].includes(normalized)) {
    return normalized;
  }
  if (normalized === 'ungrounded') {
    return 'low';
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric >= 0.75) return 'high';
    if (numeric >= 0.45) return 'medium';
    return 'low';
  }
  return null;
}

function contradictionSeverityForSource(source = {}) {
  const contradictionSignals = Array.isArray(source.contradictionSignals) ? source.contradictionSignals : [];
  if (contradictionSignals.length >= 2) return 'high';
  if (contradictionSignals.length === 1) return 'medium';
  return 'none';
}

export function sanitizeSourceForUser(source = {}) {
  const title = source.documentTitle ?? source.title ?? source.documentId ?? 'Source';
  const contradictionSeverity = contradictionSeverityForSource(source);

  return {
    title,
    sourceUrl: source.sourceUrl ?? null,
    origin: mapOrigin(source),
    freshness: toFreshnessLabel(source),
    confidenceLevel: toConfidenceLabel(
      source.confidence?.level
      ?? source.confidenceLabel
      ?? source.trustLabel
      ?? source.citation?.confidenceLabel
      ?? source.citation?.trustLabel
      ?? null,
    ),
    contradictionSeverity,
    contradictionWarning: contradictionSeverity !== 'none'
      ? 'Some source evidence conflicts and should be reviewed carefully.'
      : null,
    summary: typeof source.summary === 'string' ? source.summary.slice(0, 260) : null,
    snippet: typeof source.snippet === 'string' ? source.snippet.slice(0, 260) : null,
    error: source.error ? 'This source could not be fully checked.' : null,
  };
}

function deriveCitationCoverageScore(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return 0;
  }

  const rated = sources.filter((source) => Number.isFinite(Number(source.similarity)) || Number.isFinite(Number(source.finalScore)));
  if (rated.length === 0) {
    return Math.min(1, sources.length / 4);
  }

  const avg = rated.reduce((sum, source) => {
    const score = Number.isFinite(Number(source.finalScore))
      ? Number(source.finalScore)
      : clamp01(source.similarity);
    return sum + clamp01(score);
  }, 0) / rated.length;

  return Number(Math.max(0, Math.min(1, avg)).toFixed(4));
}

function deriveSourceFreshness(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return 'unknown';
  const labels = sources.map((source) => toFreshnessLabel(source));
  if (labels.every((label) => label === 'fresh')) return 'fresh';
  if (labels.some((label) => label === 'stale')) return 'stale';
  return 'mixed';
}

function deriveContradictionSeverity(sources = []) {
  const severities = sources.map((source) => contradictionSeverityForSource(source));
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'none';
}

function deriveConfidenceLevel({ sources = [], normalizedConfidence = null, enforcementSummary = null }) {
  const explicit = toConfidenceLabel(
    normalizedConfidence?.level
    ?? normalizedConfidence?.score
    ?? null,
  );
  if (explicit) {
    return explicit;
  }

  if (enforcementSummary?.missingEvidenceReason) {
    return 'low';
  }

  const sourceConfidence = sources
    .map((source) => toConfidenceLabel(source.confidenceLevel))
    .filter(Boolean);

  if (sourceConfidence.includes('low')) return 'low';
  if (sourceConfidence.includes('medium')) return 'medium';
  if (sourceConfidence.includes('high')) return 'high';
  return sources.length > 0 ? 'medium' : 'low';
}

function deriveMissingEvidenceReason({ sources = [], enforcementSummary = null }) {
  if (Array.isArray(sources) && sources.length > 0) {
    return null;
  }

  if (enforcementSummary?.semanticBlocks?.length) {
    return 'Prymal held back unsupported claims during validation.';
  }

  return 'Not enough evidence was available to support stronger claims.';
}

function collectOrigins(sources = []) {
  return [...new Set((Array.isArray(sources) ? sources : []).map((source) => mapOrigin(source)))];
}

export function buildUserSafeEvidenceSummary({
  sources = [],
  enforcementSummary = null,
  confidence = null,
} = {}) {
  const safeSources = (Array.isArray(sources) ? sources : []).map((source) => sanitizeSourceForUser(source));
  const contradictionSeverity = deriveContradictionSeverity(safeSources);
  const missingEvidenceReason = deriveMissingEvidenceReason({
    sources: safeSources,
    enforcementSummary,
  });

  return {
    confidenceLevel: deriveConfidenceLevel({
      sources: safeSources,
      normalizedConfidence: confidence,
      enforcementSummary,
    }),
    citationCoverageScore: deriveCitationCoverageScore(sources),
    sourceFreshness: deriveSourceFreshness(safeSources),
    contradictionSeverity,
    missingEvidenceReason,
    origins: collectOrigins(safeSources),
    sourceCount: safeSources.length,
    notEnoughEvidence: Boolean(missingEvidenceReason),
  };
}

export function sanitizeUsedMemoryPreviewForUser(memories = []) {
  return (Array.isArray(memories) ? memories : []).map((memory) => ({
    id: memory.id,
    title: memory.title ?? 'Memory',
    type: memory.type ?? memory.memoryType ?? 'memory',
    scope: memory.scope ?? 'org',
    redacted: Boolean(memory.redacted),
    confidenceScore: clamp01(memory.confidenceScore ?? memory.confidence ?? 0.5, 0.5),
    lastUsedAt: memory.lastUsedAt ?? null,
    agentId: memory.agentId ?? null,
  }));
}

export function sanitizeAssistantMessageMetadataForUser(metadata = {}) {
  const safeSources = (metadata.sources ?? []).map((source) => sanitizeSourceForUser(source));
  const evidenceSummary = buildUserSafeEvidenceSummary({
    sources: metadata.sources ?? [],
    enforcementSummary: metadata.enforcementSummary ?? null,
    confidence: metadata.structuredConfidence ?? metadata.confidence ?? null,
  });

  return {
    sources: safeSources,
    evidenceSummary,
    schemaValidation: metadata.schemaValidation ?? null,
    sentinelReview: metadata.sentinelReview ?? null,
    usedMemories: sanitizeUsedMemoryPreviewForUser(metadata.usedMemories ?? []),
    generatedImages: (metadata.generatedImages ?? []).map((image) => ({
      url: image.url ?? null,
      fileName: image.fileName ?? null,
      prompt: image.prompt ?? null,
      revisedPrompt: image.revisedPrompt ?? null,
      size: image.size ?? 'auto',
      quality: image.quality ?? 'medium',
      outputFormat: image.outputFormat ?? 'webp',
    })),
    generatedVideos: (metadata.generatedVideos ?? []).map((video) => ({
      url: video.url ?? video.outputUrl ?? null,
      fileName: video.fileName ?? video.outputFileName ?? null,
      prompt: video.prompt ?? null,
      durationSeconds: video.durationSeconds ?? 4,
      resolution: video.resolution ?? '720p',
      aspectRatio: video.aspectRatio ?? '16:9',
      mode: video.mode ?? 'lite',
      laneLabel: video.mode === 'standard' ? 'Cinematic' : 'Fast draft',
      referenceImageCount: Number(video.referenceImageCount ?? 0),
      creditsUsed: Number(video.creditsUsed ?? video.creditsCommitted ?? 0),
    })),
    held: Boolean(metadata.held),
    warden: metadata.warden ?? null,
  };
}

export function sanitizeAssistantDoneEventForUser(event = {}) {
  const safeSources = (event.sources ?? []).map((source) => sanitizeSourceForUser(source));
  const structuredConfidence = event.schemaValidation?.parsed?.confidence ?? null;
  return {
    sources: safeSources,
    evidenceSummary: buildUserSafeEvidenceSummary({
      sources: event.sources ?? [],
      enforcementSummary: event.enforcementSummary ?? null,
      confidence: structuredConfidence,
    }),
    schemaValidation: event.schemaValidation ?? null,
    sentinelReview: event.sentinelReview ?? null,
    enforcementSummary: null,
    geminiGrounding: null,
    usedMemories: sanitizeUsedMemoryPreviewForUser(event.usedMemories ?? []),
  };
}
