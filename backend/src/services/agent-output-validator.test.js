import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildSchemaRepairPrompt,
  createSchemaValidationError,
  extractStructuredJson,
  formatStructuredOutput,
  runSemanticValidators,
  validateAgentOutput,
} = await import('./agent-output-validator.js');

test('extractStructuredJson parses fenced JSON payloads', () => {
  const result = extractStructuredJson('```json\n{"agent":"cipher","summary":"valid summary"}\n```');

  assert.deepEqual(result.parsed, { agent: 'cipher', summary: 'valid summary' });
});

test('validateAgentOutput passes valid ledger structured output', () => {
  const validation = validateAgentOutput(
    'ledger',
    JSON.stringify({
      agent: 'ledger',
      period: '2026-Q1',
      headline: 'Revenue expanded while maintaining disciplined spend.',
      commentary: 'Revenue outperformed plan, gross margin improved, and cash remained stable through the quarter.',
      totals: {
        revenue: 120000,
        costs: 76000,
        grossMargin: 44000,
      },
      forecasts: [
        { metric: 'revenue', period: '2026-Q2', value: 135000, confidence: 'medium' },
      ],
      confidenceNotes: ['Forecast depends on current conversion rates holding steady.'],
    }),
  );

  assert.equal(validation.verdict, 'pass');
  assert.equal(validation.errors.length, 0);
});

test('validateAgentOutput repairs missing sentinel review fields', () => {
  const validation = validateAgentOutput('sentinel', '{}');

  assert.equal(validation.verdict, 'repaired');
  assert.equal(validation.parsed.verdict, 'pass');
  assert.equal(validation.parsed.riskScore, 0);
  assert.equal(validation.parsed.checks.accuracy.pass, false);
});

test('validateAgentOutput passes valid lore source digest output', () => {
  const validation = validateAgentOutput(
    'lore',
    JSON.stringify({
      agent: 'lore',
      chunksRetrieved: 2,
      sources: [
        {
          documentTitle: 'Pricing FAQ',
          sourceUrl: 'https://example.com/pricing',
          chunkIndex: 0,
          similarity: 0.92,
        },
      ],
      gapsIdentified: ['Missing enterprise SLA document'],
      contradictionsFound: [
        {
          existingDocumentTitle: 'Old Pricing Sheet',
          type: 'numeric_conflict',
          excerpt: 'Legacy pricing conflicts with current public pricing.',
        },
      ],
      knowledgeGapDetected: true,
      confidence: 'medium',
    }),
  );

  assert.equal(validation.verdict, 'pass');
  assert.equal(validation.errors.length, 0);
});

test('validateAgentOutput repairs lore output with defaults when JSON block is missing', () => {
  const validation = validateAgentOutput(
    'lore',
    'I searched the workspace but there was no structured JSON block in this response.',
  );

  assert.equal(validation.verdict, 'repaired');
  assert.deepEqual(validation.parsed, {
    agent: 'lore',
    chunksRetrieved: 0,
    sources: [],
    gapsIdentified: [],
    knowledgeGapDetected: false,
    confidence: 'ungrounded',
  });
  assert.match(validation.repairNotes ?? '', /schema defaults/i);
});

test('validateAgentOutput repairs sage strategy aliases into the decision memo schema', () => {
  const validation = validateAgentOutput(
    'sage',
    JSON.stringify({
      agent: 'sage',
      analysisType: 'strategic_position_review',
      topPriorities: [
        'Achieve 95%+ reliability on single-agent tasks',
        'Build a unit economics model for workflow cost',
      ],
      keyRisks: [
        'API cost scaling outpacing revenue',
        'Infrastructure ceiling hit during beta',
      ],
      scenariosModelled: 0,
    }),
  );

  assert.equal(validation.verdict, 'repaired');
  assert.match(validation.parsed.objective, /strategic position review/i);
  assert.match(validation.parsed.situation, /Current strategic priorities include/i);
  assert.deepEqual(validation.parsed.recommendations, [
    'Achieve 95%+ reliability on single-agent tasks',
    'Build a unit economics model for workflow cost',
  ]);
  assert.equal(validation.parsed.risks[0].description, 'API cost scaling outpacing revenue');
  assert.equal(validation.parsed.confidenceLevel, 'medium');
  assert.equal('topPriorities' in validation.parsed, false);
  assert.equal('keyRisks' in validation.parsed, false);
});

test('validateAgentOutput normalizes sage enum-like values into allowed schema enums', () => {
  const validation = validateAgentOutput(
    'sage',
    JSON.stringify({
      agent: 'sage',
      objective: 'Assess Prymal current strategic position and define the next priorities clearly.',
      situation:
        'Prymal is moving from stability work into early launch, with the biggest risks concentrated around reliability, cost control, and proving value with real users.',
      recommendations: [
        'Harden output reliability before pushing for broader adoption.',
      ],
      risks: [
        {
          description: 'Agent output failures erode early user trust.',
          likelihood: 'high',
          impact: 'critical',
          mitigation: 'Validation layer hardening and graceful failure UX.',
        },
      ],
      confidenceLevel: 'medium-high',
      timeframe: 'Next 90 days',
    }),
  );

  assert.equal(validation.verdict, 'repaired');
  assert.equal(validation.parsed.risks[0].impact, 'high');
  assert.equal(validation.parsed.confidenceLevel, 'high');
  assert.match(validation.repairNotes ?? '', /normalized enum values/i);
});

test('buildSchemaRepairPrompt includes schema id and validation failures', () => {
  const prompt = buildSchemaRepairPrompt({
    agentId: 'ledger',
    responseText: '{"agent":"ledger"}',
    validation: { errors: ['root: missing required field "headline"'] },
  });

  assert.match(prompt, /Schema id: ledger\.financeSummary/);
  assert.match(prompt, /missing required field "headline"/);
});

test('runSemanticValidators flags ledger arithmetic mismatch as a block', () => {
  const result = runSemanticValidators('ledger', {
    totals: { revenue: 100, costs: 60, grossMargin: 50 }, // expected 40, off by 10 > 5 tolerance
    forecasts: [{ metric: 'revenue', period: '2026-Q2', value: 120, confidence: 'high' }],
  });

  assert.equal(result.blocks.length > 0, true);
  assert.match(result.blocks[0], /grossMargin/);
});

test('runSemanticValidators tolerates ledger rounding noise within 5 percent', () => {
  const result = runSemanticValidators('ledger', {
    totals: { revenue: 100000, costs: 60000, grossMargin: 40010 }, // 10 off — within 5%
    forecasts: [{ metric: 'revenue', period: '2026-Q2', value: 120000, confidence: 'high' }],
  });

  assert.equal(result.blocks.length, 0, 'small rounding diff must not be a block');
});

test('runSemanticValidators blocks ledger when forecasts are empty', () => {
  const result = runSemanticValidators('ledger', {
    totals: { revenue: 100, costs: 60, grossMargin: 40 },
    forecasts: [],
  });

  assert.ok(result.blocks.some((b) => /forecasts is empty/i.test(b)));
});

test('runSemanticValidators blocks cipher when recommendations are all boilerplate', () => {
  const result = runSemanticValidators('cipher', {
    keyMetrics: { revenue: 100 },
    recommendations: ['TBD', 'more data needed', 'n/a'],
  });

  assert.ok(result.blocks.some((b) => /boilerplate/i.test(b)));
});

test('runSemanticValidators blocks vance when score and stage are inconsistent', () => {
  const result = runSemanticValidators('vance', {
    qualificationScore: 9,
    stage: 'prospect',
    nextAction: 'Send proposal with pricing tailored to their headcount.',
  });

  assert.ok(result.blocks.some((b) => /qualificationScore/.test(b)));
});

test('runSemanticValidators blocks herald when sendDays go backwards', () => {
  const result = runSemanticValidators('herald', {
    emails: [
      { emailNumber: 1, sendDay: 0, subject: 'Welcome', body: 'Hello there', cta: 'Book a demo to see X' },
      { emailNumber: 2, sendDay: 7, subject: 'Follow up', body: 'Checking in', cta: 'Reply with a time' },
      { emailNumber: 3, sendDay: 3, subject: 'Final', body: 'Last touch', cta: 'Reply yes or no' },
    ],
  });

  assert.ok(result.blocks.some((b) => /out of order/i.test(b)));
});

test('runSemanticValidators blocks nexus edges referencing unknown nodes', () => {
  const result = runSemanticValidators('nexus', {
    steps: [{ stepId: 's1' }, { stepId: 's2' }],
    nodeGraph: {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'ghost' }],
    },
  });

  assert.ok(result.blocks.some((b) => /ghost/.test(b)));
});

test('runSemanticValidators is a no-op for agents without a semantic validator', () => {
  const result = runSemanticValidators('lore', { chunksRetrieved: 0 });

  assert.deepEqual(result, { warnings: [], blocks: [] });
});

test('validateAgentOutput surfaces semantic blocks via the verdict path', () => {
  const validation = validateAgentOutput(
    'ledger',
    JSON.stringify({
      agent: 'ledger',
      period: '2026-Q1',
      headline: 'Schema-valid but arithmetic is wrong on purpose.',
      commentary: 'This payload passes schema validation but the gross margin does not equal revenue minus costs.',
      totals: { revenue: 100, costs: 60, grossMargin: 50 },
      forecasts: [{ metric: 'revenue', period: '2026-Q2', value: 120, confidence: 'medium' }],
      confidenceNotes: ['Forecast assumes flat conversion.'],
    }),
  );

  assert.equal(validation.verdict, 'failed', 'semantic block must demote verdict to failed');
  assert.ok(Array.isArray(validation.semantic?.blocks));
  assert.ok(validation.semantic.blocks.some((b) => /grossMargin/.test(b)));
});

test('createSchemaValidationError preserves structured metadata', () => {
  const validation = {
    verdict: 'failed',
    errors: ['root: missing required field "headline"'],
  };
  const error = createSchemaValidationError('ledger', validation, 'repair');

  assert.equal(error.code, 'SCHEMA_VALIDATION_FAILED');
  assert.equal(error.validation.stage, 'repair');
  assert.match(error.message, /ledger/);
  assert.match(formatStructuredOutput({ ok: true }), /"ok": true/);
});
