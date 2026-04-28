export function compactText(value, max = 900) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export function buildSuccessfulPatternsPrompt(patterns = []) {
  if (!patterns.length) return null;

  return [
    'PREVIOUS SUCCESSFUL PATTERNS',
    'Treat these as weak weighted priors from this organisation. Learn from the pattern and outcome, but do not copy blindly or override the user request, LORE, policy, or agent contract.',
    patterns
      .map((pattern, index) => [
        `[${index + 1}] ${pattern.contentType} performed well on ${pattern.metric}.`,
        pattern.notes ? `Outcome notes: ${compactText(pattern.notes, 240)}` : null,
        `Pattern excerpt: ${pattern.body}`,
      ].filter(Boolean).join('\n'))
      .join('\n\n'),
  ].join('\n\n');
}
