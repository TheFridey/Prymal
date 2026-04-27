const SECRET_PATTERNS = [
  /\bsk-[a-zA-Z0-9_-]{20,}\b/,
  /\bxox[baprs]-[a-zA-Z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bBEGIN (RSA |OPENSSH )?PRIVATE KEY\b/,
  /\bapi[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{12,}/i,
  /\bBearer\s+[a-zA-Z0-9._-]{20,}\b/,
];

const INJECTION_MARKERS = [
  /ignore (all )?(previous|prior) instructions/i,
  /system\s*:\s*you are now/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
];

function looksLikePaymentPan(text) {
  const digits = String(text).replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 && /^[0-9]+$/.test(digits);
}

/**
 * Review a candidate memory before persistence (SENTINEL / gatekeeper layer).
 */
export function reviewMemoryCandidate(candidate = {}) {
  const text = `${candidate.content ?? candidate.value ?? ''} ${candidate.summary ?? ''} ${candidate.title ?? ''}`;
  const reasons = [];
  const redactions = [];
  let riskLevel = 'low';
  let sentinelRequired = false;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push('possible_secret_or_credential');
      riskLevel = 'critical';
      sentinelRequired = true;
      redactions.push('[REDACTED_SECRET]');
    }
  }

  if (looksLikePaymentPan(text)) {
    reasons.push('possible_payment_card_number');
    riskLevel = riskLevel === 'low' ? 'high' : riskLevel;
    sentinelRequired = true;
  }

  for (const pattern of INJECTION_MARKERS) {
    if (pattern.test(text)) {
      reasons.push('prompt_injection_marker');
      riskLevel = riskLevel === 'low' ? 'high' : riskLevel;
      sentinelRequired = true;
    }
  }

  const authorityHint = candidate.authorityHint ?? candidate.metadata?.authorityHint;
  const sourceKind = candidate.memorySourceKind ?? candidate.sourceKind ?? 'conversation';

  if (sourceKind === 'untrusted_document' || sourceKind === 'scraped') {
    reasons.push('untrusted_source_low_authority');
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  if (authorityHint === 'user_correction') {
    // corrections are trusted — downgrade injection paranoia unless secrets found
    reasons.push('user_correction_high_authority');
  }

  let status = 'active';

  if (riskLevel === 'critical' || (sentinelRequired && reasons.includes('possible_secret_or_credential'))) {
    status = 'rejected';
  } else if (sentinelRequired || riskLevel === 'high') {
    status = 'pending_review';
  }

  return {
    status,
    riskLevel,
    reasons,
    redactions,
    sentinelRequired,
  };
}
