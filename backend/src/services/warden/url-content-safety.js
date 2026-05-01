import { detectPromptInjection, hashContent, stripZeroWidthChars } from './prompt-injection-detector.js';
import { sanitizeExternalContent, wrapUntrustedEvidence } from './warden-sanitizer.js';
import { createWardenDecision } from './warden-service.js';
import { WARDEN_SOURCE_TYPES, WARDEN_VERDICTS } from './warden-policy.js';

const EXTRACTOR_VERSION = 'warden-url-v1';
const TAG_STRIP_RE = /<(script|style|noscript|iframe|form|template|svg|canvas)\b[\s\S]*?<\/\1>/gi;
const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const HIDDEN_ELEMENT_RE = /<([a-z0-9-]+)\b[^>]*(?:hidden|aria-hidden=["']?true|style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0|left\s*:\s*-\d{2,})[^"']*)[^>]*>[\s\S]*?<\/\1>/gi;
const EVENT_HANDLER_ATTR_RE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_DESCRIPTION_RE = /<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["'][^>]*>/i;
const CANONICAL_RE = /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i;
const ALT_RE = /\balt=["']([^"']*)["']/gi;
const TITLE_ATTR_RE = /\btitle=["']([^"']*)["']/gi;
const STRUCTURED_DATA_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function extractReadableUrlContent({ html = '', url = '' } = {}) {
  const raw = stripZeroWidthChars(String(html ?? ''));
  const comments = [...raw.matchAll(COMMENT_RE)].map((match) => match[1]?.trim()).filter(Boolean);
  const altText = [...raw.matchAll(ALT_RE)].map((match) => decodeHtmlEntities(match[1])).filter(Boolean);
  const titleAttributes = [...raw.matchAll(TITLE_ATTR_RE)].map((match) => decodeHtmlEntities(match[1])).filter(Boolean);
  const structuredData = [...raw.matchAll(STRUCTURED_DATA_RE)].map((match) => match[1]?.trim()).filter(Boolean).join('\n').slice(0, 10_000);
  const title = decodeHtmlEntities(raw.match(TITLE_RE)?.[1] ?? '').trim();
  const metaDescription = decodeHtmlEntities(raw.match(META_DESCRIPTION_RE)?.[1] ?? '').trim();
  const canonicalUrl = decodeHtmlEntities(raw.match(CANONICAL_RE)?.[1] ?? '').trim() || null;
  const hiddenMatches = [
    ...raw.matchAll(HIDDEN_ELEMENT_RE),
    ...raw.matchAll(/style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0|left\s*:\s*-\d{2,})[^"']*["']/gi),
  ];
  const hiddenText = hiddenMatches.map((match) => stripTags(match[0])).filter(Boolean);
  const cleaned = raw
    .replace(STRUCTURED_DATA_RE, ' ')
    .replace(COMMENT_RE, ' ')
    .replace(HIDDEN_ELEMENT_RE, ' ')
    .replace(TAG_STRIP_RE, ' ')
    .replace(EVENT_HANDLER_ATTR_RE, ' ')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeHtmlEntities(cleaned)
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text,
    title,
    metaDescription,
    altText,
    titleAttributes,
    comments,
    hiddenText,
    canonicalUrl,
    structuredData,
    metadata: {
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      contentHash: hashContent(raw),
      extractorVersion: EXTRACTOR_VERSION,
      canonicalUrl,
      title,
      metaDescription,
      altTextCount: altText.length,
      commentCount: comments.length,
      hiddenElementCount: hiddenMatches.length,
      structuredDataPresent: Boolean(structuredData),
    },
  };
}

export async function prepareUrlContentForLore({ url, html, userId, orgId, dbClient } = {}) {
  const extracted = extractReadableUrlContent({ html, url });
  const scan = scanUrlContent({ url, html, text: extracted.text, metadata: extracted.metadata, userId, orgId });
  const decision = await createWardenDecision(scan, { dbClient });

  if (decision.verdict === WARDEN_VERDICTS.BLOCK) {
    return {
      allowed: false,
      sanitizedText: '',
      chunks: [],
      metadata: {
        ...extracted.metadata,
        warden: buildUrlWardenMetadata(decision),
      },
      wardenDecision: decision,
    };
  }

  const sanitized = sanitizeExternalContent(extracted.text, { maxChars: Number(process.env.WARDEN_MAX_URL_TEXT_CHARS ?? 240_000) });
  const evidenceText = decision.verdict === WARDEN_VERDICTS.ALLOW_WITH_SANDBOX
    ? wrapUntrustedEvidence(sanitized.content, { sourceUrl: url, wardenAuditId: decision.auditId })
    : sanitized.content;
  const chunks = splitTextIntoChunks(evidenceText);

  return {
    allowed: true,
    sanitizedText: evidenceText,
    chunks,
    metadata: {
      ...extracted.metadata,
      contentHash: sanitized.contentHash,
      warden: buildUrlWardenMetadata(decision),
      sourceType: 'EXTERNAL_URL',
      trustLevel: decision.verdict === WARDEN_VERDICTS.ALLOW_WITH_SANDBOX ? 'SANDBOXED' : 'UNTRUSTED',
      allowAsInstruction: false,
    },
    wardenDecision: decision,
  };
}

export function scanUrlContent({ url, html = '', text = '', metadata = {}, userId = null, orgId = null } = {}) {
  const combinedMetadata = [
    metadata.title,
    metadata.metaDescription,
    ...(metadata.altText ?? []),
    ...(metadata.comments ?? []),
    ...(metadata.hiddenText ?? []),
    metadata.structuredData,
  ].filter(Boolean).join('\n');
  const injection = detectPromptInjection(`${text}\n${combinedMetadata}\n${html}`);
  const categories = [...injection.categories];
  const reasons = [...injection.reasons];

  if (metadata.hiddenElementCount > 0) {
    categories.push('hidden_prompt');
    reasons.push('URL content contained hidden or offscreen elements.');
  }

  return {
    input: text,
    surface: 'url_ingest',
    action: 'scan_url_content',
    sourceType: WARDEN_SOURCE_TYPES.EXTERNAL_URL,
    sourceUrl: url,
    userId,
    orgId,
    categories,
    reasons,
    verdict: categories.length > 0 ? WARDEN_VERDICTS.ALLOW_WITH_SANDBOX : WARDEN_VERDICTS.ALLOW,
    metadata,
  };
}

function buildUrlWardenMetadata(decision) {
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

function splitTextIntoChunks(text, size = 6000) {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length ? chunks : [''];
}

function stripTags(input = '') {
  return decodeHtmlEntities(String(input).replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim());
}

function decodeHtmlEntities(input = '') {
  return String(input)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
