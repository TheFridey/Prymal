import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildSchemaRepairPrompt,
  createSchemaValidationError,
  extractStructuredJson,
  formatStructuredOutput,
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

test('buildSchemaRepairPrompt includes schema id and validation failures', () => {
  const prompt = buildSchemaRepairPrompt({
    agentId: 'ledger',
    responseText: '{"agent":"ledger"}',
    validation: { errors: ['root: missing required field "headline"'] },
  });

  assert.match(prompt, /Schema id: ledger\.financeSummary/);
  assert.match(prompt, /missing required field "headline"/);
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
