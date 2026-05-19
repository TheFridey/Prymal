function clamp01(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function confidenceLevel(score) {
  const numeric = clamp01(score, 0);
  if (numeric >= 0.8) return 'high';
  if (numeric >= 0.55) return 'medium';
  return 'low';
}

const CATEGORY_RULES = [
  {
    key: 'icp',
    label: 'ICP confidence',
    safeLabel: 'ideal customer profile',
    match: (row) => /ideal_customer_profile|target_customers|icp/i.test(row.key ?? ''),
    suggestion: 'Add client research, win-loss notes, or a short ICP description.',
  },
  {
    key: 'brand_voice',
    label: 'Brand voice confidence',
    safeLabel: 'brand voice',
    match: (row) => /brand_voice|tone|style/i.test(row.key ?? '') || row.memoryType === 'brand_voice',
    suggestion: 'Upload brand guidelines or describe how Prymal should sound.',
  },
  {
    key: 'offer',
    label: 'Offer confidence',
    safeLabel: 'offer',
    match: (row) => /product_description|offer|service|company/i.test(row.key ?? ''),
    suggestion: 'Add a clear offer summary, deliverables, and proof points.',
  },
  {
    key: 'pricing',
    label: 'Pricing confidence',
    safeLabel: 'pricing',
    match: (row) => /pricing|price/i.test(row.key ?? ''),
    suggestion: 'Confirm your current pricing, packaging, and minimum deal size.',
  },
  {
    key: 'target_market',
    label: 'Target market confidence',
    safeLabel: 'target market',
    match: (row) => /target_market|target_customers|industry/i.test(row.key ?? ''),
    suggestion: 'Clarify the industries, geographies, and buyer types you target most.',
  },
  {
    key: 'active_projects',
    label: 'Active projects confidence',
    safeLabel: 'active projects',
    match: (row) => row.metadata?.contextLayer === 'project',
    suggestion: 'Create or confirm the active launch, campaign, or delivery initiative.',
  },
  {
    key: 'support_policy',
    label: 'Support policy confidence',
    safeLabel: 'support policy',
    match: (row) => /support|refund|escalation|policy/i.test(row.key ?? ''),
    suggestion: 'Describe refund boundaries, escalation rules, and support tone.',
  },
  {
    key: 'seo_strategy',
    label: 'SEO strategy confidence',
    safeLabel: 'SEO strategy',
    match: (row) => /seo|keyword|site|audit/i.test(row.key ?? '') || /seo/i.test(row.metadata?.summary ?? ''),
    suggestion: 'Upload keyword targets, site URLs, or current SEO priorities.',
  },
];

function statusBucket(row) {
  const status = String(row.memoryItemStatus ?? 'active').toLowerCase();
  if (status === 'conflicted') return 'contradiction';
  if (status === 'pending_review') return 'unsupported';
  if (status === 'archived' || row.supersededAt || row.supersededBy) return 'stale';
  return 'active';
}

function computeCategorySummary(rows = [], rule, { internal = false } = {}) {
  const matched = rows.filter((row) => rule.match(row));
  if (matched.length === 0) {
    return {
      key: rule.key,
      label: rule.label,
      confidenceLevel: 'low',
      statusLabel: `Prymal still needs stronger ${rule.safeLabel} context.`,
      staleFactsCount: 0,
      contradictionsCount: 0,
      unsupportedClaimsCount: 0,
      lastUpdatedAt: null,
      topMissingContext: rule.suggestion,
      ...(internal ? { confidenceScore: 0, factCount: 0 } : {}),
    };
  }

  const weighted = matched.reduce((sum, row) => {
    const score = clamp01(row.confidence ?? 0.5, 0.5);
    const provenanceBoost = (row.provenanceKind ?? 'inferred') === 'confirmed' ? 0.08 : 0;
    const stalePenalty = statusBucket(row) === 'stale' ? 0.12 : 0;
    const contradictionPenalty = row.contradictionDetected ? 0.1 : 0;
    return sum + Math.max(0, Math.min(1, score + provenanceBoost - stalePenalty - contradictionPenalty));
  }, 0) / matched.length;

  const contradictionsCount = matched.filter((row) => row.contradictionDetected || row.memoryItemStatus === 'conflicted').length;
  const staleFactsCount = matched.filter((row) => statusBucket(row) === 'stale').length;
  const unsupportedClaimsCount = matched.filter((row) => statusBucket(row) === 'unsupported').length;
  const latest = matched
    .map((row) => row.updatedAt ?? row.lastSeenAt ?? row.createdAt ?? null)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const level = confidenceLevel(weighted);

  const safeCopy = level === 'high'
    ? `Prymal has strong context for your ${rule.safeLabel}.`
    : level === 'medium'
      ? `Prymal has workable context for your ${rule.safeLabel}, but some details still need confirmation.`
      : `Prymal still needs stronger ${rule.safeLabel} context.`;

  return {
    key: rule.key,
    label: rule.label,
    confidenceLevel: level,
    statusLabel: contradictionsCount > 0
      ? 'A recent change may need review.'
      : safeCopy,
    staleFactsCount,
    contradictionsCount,
    unsupportedClaimsCount,
    lastUpdatedAt: latest,
    topMissingContext: level === 'high' ? null : rule.suggestion,
    ...(internal ? {
      confidenceScore: Number(weighted.toFixed(4)),
      factCount: matched.length,
    } : {}),
  };
}

export function buildMemoryIntelligenceSummary(rows = [], { internal = false } = {}) {
  const visibleRows = (Array.isArray(rows) ? rows : []).filter((row) => row.memoryItemStatus !== 'deleted');
  const categories = CATEGORY_RULES.map((rule) => computeCategorySummary(visibleRows, rule, { internal }));
  const staleFactsCount = visibleRows.filter((row) => statusBucket(row) === 'stale').length;
  const contradictionsCount = visibleRows.filter((row) => row.contradictionDetected || row.memoryItemStatus === 'conflicted').length;
  const unsupportedClaimsCount = visibleRows.filter((row) => statusBucket(row) === 'unsupported').length;
  const lastUpdatedAt = visibleRows
    .map((row) => row.updatedAt ?? row.lastSeenAt ?? row.createdAt ?? null)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const topMissingContext = categories
    .filter((entry) => entry.confidenceLevel !== 'high' && entry.topMissingContext)
    .slice(0, 4)
    .map((entry) => ({ key: entry.key, label: entry.label, suggestion: entry.topMissingContext }));

  const activeProjects = visibleRows.filter((row) => row.metadata?.contextLayer === 'project' && row.metadata?.projectStatus === 'active');

  return {
    overview: {
      confidenceLevel: confidenceLevel(
        categories.reduce((sum, entry) => sum + (internal ? entry.confidenceScore : (entry.confidenceLevel === 'high' ? 0.9 : entry.confidenceLevel === 'medium' ? 0.65 : 0.35)), 0)
          / Math.max(categories.length, 1),
      ),
      staleFactsCount,
      contradictionsCount,
      unsupportedClaimsCount,
      activeProjectsCount: activeProjects.length,
      lastUpdatedAt,
      topMissingContext,
      suggestedNextSteps: topMissingContext.map((entry) => entry.suggestion),
      safeSummary:
        contradictionsCount > 0
          ? 'Some business context needs confirmation.'
          : topMissingContext.length === 0
            ? 'Prymal has strong shared business context.'
            : 'Prymal has workable context, but a few business details still need confirmation.',
    },
    categories,
  };
}
