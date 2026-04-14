import { truncate } from '../../../lib/utils';

export const SOURCE_BADGE_META = {
  manual: { label: 'text', color: '#C77DFF' },
  text: { label: 'text', color: '#C77DFF' },
  url: { label: 'url', color: '#4CC9F0' },
  pdf: { label: 'pdf', color: '#F59E0B' },
  docx: { label: 'docx', color: '#7C3AED' },
  csv: { label: 'csv', color: '#00C2A8' },
  markdown: { label: 'md', color: '#94A3B8' },
  md: { label: 'md', color: '#94A3B8' },
};

export const TRUST_META = {
  internal: { label: 'Internal', color: '#18c7a0' },
  structured_internal: { label: 'Structured', color: '#4CC9F0' },
  web_import: { label: 'Web import', color: '#F59E0B' },
  unknown: { label: 'Unknown', color: '#94A3B8' },
};

export function nextUploadId() {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeDocumentSource(sourceType) {
  if (sourceType === 'manual') {
    return 'text';
  }

  if (sourceType === 'markdown') {
    return 'md';
  }

  return sourceType;
}

export function formatSimilarity(value) {
  return `${Math.round(Math.max(Math.min(Number(value ?? 0), 1), 0) * 100)}% match`;
}

export function formatPercent(value) {
  if (value == null) {
    return 'n/a';
  }

  return `${Math.round(Math.max(Math.min(Number(value), 1), 0) * 100)}%`;
}

export function buildExcerpt(content) {
  return truncate(String(content ?? '').replace(/\s+/g, ' ').trim(), 220);
}

export function getTrustMeta(label) {
  return TRUST_META[label] ?? TRUST_META.unknown;
}

export function formatAge(dateValue) {
  if (!dateValue) return null;
  const ageDays = Math.max((Date.now() - new Date(dateValue).getTime()) / (1000 * 60 * 60 * 24), 0);
  if (ageDays < 1) return 'Updated today';
  if (ageDays < 7) return `Updated ${Math.round(ageDays)}d ago`;
  if (ageDays < 30) return `Updated ${Math.round(ageDays / 7)}w ago`;
  if (ageDays < 365) return `Updated ${Math.round(ageDays / 30)}mo ago`;
  return `Updated ${Math.round(ageDays / 365)}y ago`;
}

export function humanizeContradictionType(value) {
  switch (value) {
    case 'numeric_conflict':
      return 'Numeric conflict';
    case 'statement_conflict':
      return 'Statement conflict';
    case 'duplicate_or_overlap':
      return 'Duplicate or overlap';
    default:
      return 'Potential conflict';
  }
}
