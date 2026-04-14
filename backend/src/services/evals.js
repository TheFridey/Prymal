import { getAgentContract } from '../agents/contracts.js';

const JSON_OUTPUT_TYPES = new Set([
  'json_scorecard',
  'workflow_state',
  'seo_audit',
  'decision_memo',
  'market_scan',
]);

export function evaluateAgentOutput({
  agentId,
  text = '',
  sources = [],
  usedTools = [],
  structuredOutput = null,
}) {
  const contract = getAgentContract(agentId);
  const citationRate = computeCitationRate(sources);
  const structuredOutputPass = evaluateStructuredOutput({
    text,
    structuredOutput: structuredOutput ?? contract?.structuredOutput ?? null,
  });
  const toolUse = evaluateToolUse({
    usedTools,
    allowedTools: contract?.allowedTools ?? [],
    disallowedTools: contract?.disallowedTools ?? [],
  });
  const instructionAdherence = evaluateInstructionAdherence({
    text,
    outputStyle: contract?.outputStyle ?? '',
    structuredOutputPass,
  });
  const hallucinationRisk = detectHallucinationRisk({
    text,
    citationRate,
    contract,
    sources,
  });
  const groundedness = evaluateGroundedness({
    sources,
    citationRate,
    hallucinationRisk,
  });

  return {
    citationRate,
    citationCount: sources.length,
    groundedness,
    structuredOutputPass,
    toolUsePass: toolUse.pass,
    disallowedToolsUsed: toolUse.disallowedToolsUsed,
    missingExpectedTools: toolUse.missingExpectedTools,
    instructionAdherence,
    hallucinationRisk,
    score: computeCompositeScore({
      citationRate,
      groundedness,
      structuredOutputPass,
      toolUsePass: toolUse.pass,
      instructionAdherence,
      hallucinationRisk,
    }),
  };
}

export function evaluateGroundedness({ sources = [], citationRate = 0, hallucinationRisk = 'medium' }) {
  if (sources.length === 0) {
    return hallucinationRisk === 'low' ? 'ungrounded_but_low_risk' : 'ungrounded';
  }

  if (citationRate >= 0.75 && hallucinationRisk === 'low') {
    return 'well_grounded';
  }

  if (citationRate >= 0.4 && hallucinationRisk !== 'high') {
    return 'partially_grounded';
  }

  return 'weak_grounding';
}

export function evaluateStructuredOutput({ text = '', structuredOutput = null }) {
  if (!structuredOutput) {
    return null;
  }

  const trimmed = text.trim();

  if (JSON_OUTPUT_TYPES.has(structuredOutput)) {
    return /```json[\s\S]+```/i.test(trimmed) || looksLikeJson(trimmed);
  }

  if (structuredOutput === 'sequence_summary') {
    return /email\s*1|day\s*0/i.test(trimmed);
  }

  if (structuredOutput === 'support_resolution') {
    return /next step|resolution|customer/i.test(trimmed);
  }

  if (structuredOutput === 'source_digest') {
    return /source|citation|document|url/i.test(trimmed);
  }

  if (structuredOutput === 'content_brief') {
    return /headline|audience|cta|brief/i.test(trimmed);
  }

  return trimmed.length > 0;
}

export function evaluateToolUse({ usedTools = [], allowedTools = [], disallowedTools = [] }) {
  const disallowedToolsUsed = usedTools.filter((tool) => disallowedTools.includes(tool));
  const expectedGroundingTools = allowedTools.filter((tool) => ['lore_search', 'live_web_research'].includes(tool));
  const missingExpectedTools = expectedGroundingTools.length > 0 && usedTools.length === 0
    ? expectedGroundingTools
    : [];

  return {
    pass: disallowedToolsUsed.length === 0,
    disallowedToolsUsed,
    missingExpectedTools,
  };
}

export function evaluateInstructionAdherence({ text = '', outputStyle = '', structuredOutputPass = null }) {
  const loweredText = text.toLowerCase();
  const loweredStyle = outputStyle.toLowerCase();

  if (!text.trim()) {
    return 'failed';
  }

  if (loweredStyle.includes('executive summary first') && !/summary|finding|recommend/i.test(loweredText)) {
    return 'warn';
  }

  if (loweredStyle.includes('phase-based') && !/phase|dependency|timeline/i.test(loweredText)) {
    return 'warn';
  }

  if (structuredOutputPass === false) {
    return 'warn';
  }

  return 'pass';
}

export function detectHallucinationRisk({ text = '', citationRate = 0, contract = null, sources = [] }) {
  const groundedAgent = contract?.evalCriteria?.includes('groundedness') || contract?.evalCriteria?.includes('citation_rate');
  const assertiveClaims = (text.match(/\b(will|always|definitely|guaranteed|proves)\b/gi) ?? []).length;

  if (groundedAgent && sources.length === 0) {
    return 'high';
  }

  if (citationRate === 0 && assertiveClaims >= 3) {
    return 'high';
  }

  if (citationRate < 0.25 || assertiveClaims >= 1) {
    return 'medium';
  }

  return 'low';
}

export function compareModelRuns(runs = []) {
  const groups = new Map();

  for (const run of runs) {
    const key = `${run.provider}:${run.model}`;
    const current = groups.get(key) ?? {
      provider: run.provider,
      model: run.model,
      runs: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      groundedRuns: 0,
    };

    current.runs += 1;
    current.successCount += run.outcomeStatus === 'succeeded' ? 1 : 0;
    current.failureCount += run.outcomeStatus === 'failed' ? 1 : 0;
    current.totalLatencyMs += run.latencyMs ?? 0;
    current.totalTokens += run.totalTokens ?? 0;
    current.totalCostUsd += run.estimatedCostUsd ?? 0;
    current.groundedRuns += ['well_grounded', 'partially_grounded'].includes(run.metadata?.evaluation?.groundedness)
      ? 1
      : 0;

    groups.set(key, current);
  }

  return [...groups.values()].map((group) => ({
    provider: group.provider,
    model: group.model,
    runs: group.runs,
    successRate: safeRatio(group.successCount, group.runs),
    failureRate: safeRatio(group.failureCount, group.runs),
    groundedRate: safeRatio(group.groundedRuns, group.runs),
    averageLatencyMs: Math.round(group.totalLatencyMs / Math.max(group.runs, 1)),
    averageTokens: Math.round(group.totalTokens / Math.max(group.runs, 1)),
    averageCostUsd: Number((group.totalCostUsd / Math.max(group.runs, 1)).toFixed(6)),
  }));
}

function computeCitationRate(sources = []) {
  if (sources.length === 0) {
    return 0;
  }

  const sourced = sources.filter((source) => source?.documentTitle || source?.sourceUrl || source?.title).length;
  return Number((sourced / sources.length).toFixed(4));
}

function computeCompositeScore({
  citationRate,
  groundedness,
  structuredOutputPass,
  toolUsePass,
  instructionAdherence,
  hallucinationRisk,
}) {
  let score = 55;

  score += citationRate * 20;
  score += groundedness === 'well_grounded' ? 12 : groundedness === 'partially_grounded' ? 6 : 0;
  score += structuredOutputPass === true ? 6 : structuredOutputPass === false ? -6 : 0;
  score += toolUsePass ? 4 : -10;
  score += instructionAdherence === 'pass' ? 5 : instructionAdherence === 'warn' ? -4 : -12;
  score += hallucinationRisk === 'low' ? 8 : hallucinationRisk === 'medium' ? 0 : -14;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function looksLikeJson(value) {
  if (!value) {
    return false;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function safeRatio(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}
