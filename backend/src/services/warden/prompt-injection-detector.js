import crypto from 'node:crypto';
import { WARDEN_CATEGORIES } from './warden-policy.js';

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060\u180E]/g;
const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;
const ROLE_HEADER_RE = /(^|\n)\s*(system|developer|assistant|tool|function)\s*:/i;
const MARKDOWN_HTML_COMMENT_RE = /<!--[\s\S]{0,1200}-->/g;
const HIDDEN_STYLE_RE = /(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0|left\s*:\s*-\d{2,}|position\s*:\s*absolute[^>]{0,200}(left|top)\s*:\s*-\d{2,})/i;
const BASE64_LONG_RE = /(?:^|[^A-Za-z0-9+/=])([A-Za-z0-9+/]{120,}={0,2})(?:$|[^A-Za-z0-9+/=])/;

const HOMOGLYPH_MAP = new Map([
  ['а', 'a'], ['е', 'e'], ['о', 'o'], ['р', 'p'], ['с', 'c'], ['у', 'y'], ['х', 'x'],
  ['і', 'i'], ['ї', 'i'], ['ј', 'j'], ['ѕ', 's'], ['ӏ', 'l'], ['ԁ', 'd'],
  ['Α', 'a'], ['Β', 'b'], ['Ε', 'e'], ['Η', 'h'], ['Ι', 'i'], ['Κ', 'k'], ['Μ', 'm'],
  ['Ν', 'n'], ['Ο', 'o'], ['Ρ', 'p'], ['Τ', 't'], ['Χ', 'x'], ['Υ', 'y'], ['Ζ', 'z'],
]);

const INSTRUCTION_OVERRIDE_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?/i,
  /disregard\s+(?:your\s+)?(?:system|developer|previous)\s+(?:prompt|message|instructions?)/i,
  /reveal\s+(?:your\s+)?system\s+prompt/i,
  /print\s+(?:the\s+)?hidden\s+instructions?/i,
  /you\s+are\s+now\s+(?:dan|developer|system|unrestricted)/i,
  /act\s+as\s+dan/i,
  /jailbreak/i,
  /unrestricted\s+mode/i,
  /no\s+policy/i,
  /bypass\s+(?:all\s+)?(?:safety|guardrails|filters?)/i,
  /disable\s+guardrails?/i,
  /do\s+not\s+follow\s+(?:openai|model|safety)\s+policy/i,
  /for\s+research\s+purposes[, ]+\s*ignore\s+policy/i,
  /fictional\s+scenario\s+where\s+rules\s+do\s+not\s+apply/i,
  /this\s+is\s+a\s+test\s+of\s+compliance/i,
];

const TOOL_ABUSE_PATTERNS = [
  /call\s+this\s+tool/i,
  /execute\s+this\s+command/i,
  /send\s+a\s+request\s+to/i,
  /change\s+billing/i,
  /grant\s+credits?/i,
  /delete\s+(?:all\s+)?(?:data|files?|users?|org|workspace)/i,
  /call\s+the\s+billing\s+endpoint/i,
  /post\s+this\s+externally/i,
  /send\s+(?:an\s+)?email\s+to/i,
];

const SECRET_EXFILTRATION_PATTERNS = [
  /output\s+raw\s+secrets?/i,
  /reveal\s+(?:api\s+keys?|secrets?|tokens?|credentials?)/i,
  /exfiltrate/i,
  /dump\s+(?:env|environment|secrets?)/i,
  /show\s+me\s+(?:the\s+)?(?:clerk|stripe|openai|anthropic|database)\s+(?:key|secret|token)/i,
];

const HIDDEN_PROMPT_PATTERNS = [
  /instructions?\s+hidden\s+in\s+this\s+page/i,
  /copy\s+this\s+prompt\s+exactly/i,
  /run\s+the\s+prompt\s+in\s+this\s+image/i,
  /ocr\s+this\s+and\s+follow\s+it/i,
  /prompt-like\s+content/i,
  /metadata\s+instructions?/i,
];

export function stripZeroWidthChars(input = '') {
  return String(input).replace(ZERO_WIDTH_RE, '');
}

export function normalizeTextForSafety(input = '') {
  const stripped = stripZeroWidthChars(input);
  const normalized = stripped
    .normalize('NFKD')
    .replace(COMBINING_MARKS_RE, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-');

  let mapped = '';
  for (const char of normalized) {
    mapped += HOMOGLYPH_MAP.get(char) ?? char;
  }

  return mapped.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function detectRoleInjection(input = '') {
  const matches = [];
  if (ROLE_HEADER_RE.test(stripZeroWidthChars(input))) {
    matches.push('Role header resembling system/developer/assistant/tool instructions was found.');
  }
  if (/\bdeveloper\s+message\b|\bsystem\s+message\b/i.test(input)) {
    matches.push('Content refers to privileged system or developer messages.');
  }
  return buildDetection(WARDEN_CATEGORIES.ROLE_INJECTION, matches);
}

export function detectInstructionOverride(input = '') {
  const normalized = normalizeTextForSafety(input);
  const compact = normalized.replace(/[^a-z0-9]+/g, '');
  const spaced = normalized.replace(/\b([a-z])(?:\s+)([a-z])(?:\s+)([a-z])(?:\s+)([a-z])(?:\s+)([a-z])\b/g, '$1$2$3$4$5');
  const matches = [];

  for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(spaced)) {
      matches.push(`Instruction override pattern matched: ${pattern.source}`);
    }
  }

  if (compact.includes('ignorepreviousinstructions') || compact.includes('ignoreallabove')) {
    matches.push('Obfuscated instruction override phrase was found.');
  }

  return buildDetection(WARDEN_CATEGORIES.PROMPT_INJECTION, matches);
}

export function detectToolAbuseInstruction(input = '') {
  const normalized = normalizeTextForSafety(input);
  const matches = TOOL_ABUSE_PATTERNS
    .filter((pattern) => pattern.test(normalized))
    .map((pattern) => `Tool-abuse pattern matched: ${pattern.source}`);
  return buildDetection(WARDEN_CATEGORIES.TOOL_ABUSE, matches);
}

export function detectSecretExfiltration(input = '') {
  const normalized = normalizeTextForSafety(input);
  const matches = SECRET_EXFILTRATION_PATTERNS
    .filter((pattern) => pattern.test(normalized))
    .map((pattern) => `Secret exfiltration pattern matched: ${pattern.source}`);
  return buildDetection(WARDEN_CATEGORIES.SECRET_EXFILTRATION, matches);
}

export function detectEncodedPayload(input = '') {
  const text = stripZeroWidthChars(input);
  const matches = [];
  if (BASE64_LONG_RE.test(text)) {
    matches.push('Long base64-looking payload was found.');
  }
  if (/encode\s+the\s+answer\s+in\s+base64|decode\s+and\s+run\s+this/i.test(text)) {
    matches.push('Instruction to encode/decode payload was found.');
  }
  return buildDetection(WARDEN_CATEGORIES.ENCODED_PAYLOAD, matches);
}

export function detectHiddenPromptContent(input = '') {
  const text = stripZeroWidthChars(input);
  const matches = [];
  const comments = text.match(MARKDOWN_HTML_COMMENT_RE) ?? [];
  if (comments.some((comment) => /ignore|system|developer|tool|prompt|instruction|secret/i.test(comment))) {
    matches.push('Suspicious prompt-like content was found inside an HTML or markdown comment.');
  }
  if (HIDDEN_STYLE_RE.test(text)) {
    matches.push('Hidden CSS text or offscreen content was detected.');
  }
  if (/alt\s*=\s*["'][^"']*(ignore|system prompt|developer message|call this tool|reveal secrets?)/i.test(text)) {
    matches.push('Suspicious prompt-like content was found inside image alt text.');
  }
  if (/title\s*=\s*["'][^"']*(ignore|system prompt|developer message|call this tool|reveal secrets?)/i.test(text)) {
    matches.push('Suspicious prompt-like content was found inside a title attribute.');
  }
  for (const pattern of HIDDEN_PROMPT_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(`Hidden prompt pattern matched: ${pattern.source}`);
    }
  }
  return buildDetection(WARDEN_CATEGORIES.HIDDEN_PROMPT, matches);
}

export function detectPromptInjection(input = '') {
  const detections = [
    detectRoleInjection(input),
    detectInstructionOverride(input),
    detectToolAbuseInstruction(input),
    detectSecretExfiltration(input),
    detectEncodedPayload(input),
    detectHiddenPromptContent(input),
  ].filter((detection) => detection.detected);

  return {
    detected: detections.length > 0,
    categories: [...new Set(detections.map((detection) => detection.category))],
    reasons: detections.flatMap((detection) => detection.reasons),
    detections,
  };
}

export function hashContent(content = '') {
  return crypto.createHash('sha256').update(String(content)).digest('hex');
}

function buildDetection(category, reasons) {
  return {
    category,
    detected: reasons.length > 0,
    reasons,
  };
}
