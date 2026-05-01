import assert from 'node:assert/strict';
import test from 'node:test';

process.env.WORKFLOW_CATALOGUE_PREMIUM_ENABLED = 'false';

const {
  OFFICIAL_WORKFLOW_CATALOGUE_ITEMS,
  estimateCatalogueWorkflowCost,
  isWorkflowCataloguePremiumEnabled,
  validateCatalogueWorkflowDefinition,
} = await import('./workflow-catalogue.js');

test('official workflow catalogue seed definitions are installable workflow definitions', () => {
  for (const item of OFFICIAL_WORKFLOW_CATALOGUE_ITEMS) {
    const result = validateCatalogueWorkflowDefinition(item.templateWorkflowDefinition);
    assert.equal(result.definition.triggerType, 'manual');
    assert.ok(result.definition.nodes.length > 0);
    assert.equal(typeof item.title, 'string');
    assert.ok(item.expectedOutput.length > 0);
  }
});

test('official workflow catalogue ships thirty seeded workflows', () => {
  assert.equal(OFFICIAL_WORKFLOW_CATALOGUE_ITEMS.length, 30);
  assert.equal(new Set(OFFICIAL_WORKFLOW_CATALOGUE_ITEMS.map((item) => item.slug)).size, 30);
});

test('official workflow catalogue has at least three workflows for each browse category', () => {
  const browseCategories = ['Marketing', 'Sales', 'Content', 'Operations', 'Agencies', 'Support', 'Finance', 'Automation', 'Research', 'Strategy'];
  for (const category of browseCategories) {
    const categoryCount = OFFICIAL_WORKFLOW_CATALOGUE_ITEMS.filter((item) => item.category === category).length;
    assert.ok(categoryCount >= 3, `${category} should have at least three workflows`);
  }
});

test('each official workflow has a simple or advanced mode tag', () => {
  for (const item of OFFICIAL_WORKFLOW_CATALOGUE_ITEMS) {
    assert.ok(
      item.tags.includes('simple') || item.tags.includes('advanced'),
      `${item.slug} should include simple or advanced tag`,
    );
  }
});

test('official workflow catalogue seed slugs are stable for idempotent upserts', () => {
  const slugs = OFFICIAL_WORKFLOW_CATALOGUE_ITEMS.map((item) => item.slug);
  assert.deepEqual(slugs, [...slugs].map((slug) => slug.toLowerCase()));
  assert.ok(slugs.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)));
});

test('seeded detail payloads include outputs, inputs, and workflow definitions', () => {
  const item = OFFICIAL_WORKFLOW_CATALOGUE_ITEMS.find((entry) => entry.slug === 'linkedin-launch-campaign');
  assert.ok(item);
  assert.deepEqual(item.expectedOutput, ['7-day LinkedIn campaign', 'Post hooks', 'CTA ideas', 'Launch-day post']);
  assert.deepEqual(item.requiredInputs, ['Product/service', 'Launch date', 'Target audience']);
  assert.ok(item.templateWorkflowDefinition.nodes.length >= 2);
});

test('catalogue definition validation rejects embedded secrets', () => {
  assert.throws(
    () => validateCatalogueWorkflowDefinition({
      name: 'Unsafe workflow',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'a',
          agentId: 'cipher',
          prompt: 'Use sk_live_12345678901234567890 to call the provider.',
          outputVar: 'result',
        },
      ],
      edges: [],
    }),
    /cannot contain API keys/i,
  );
});

test('catalogue estimates expose execution and video signals', () => {
  const result = estimateCatalogueWorkflowCost({
    nodes: [
      { prompt: 'Create a video render brief.' },
      { prompt: 'Summarise the campaign.' },
    ],
  });
  assert.ok(result.estimatedExecutionCredits > 0);
  assert.ok(result.estimatedVideoCredits > 0);
  assert.ok(result.estimatedCostGbp > 0);
});

test('premium workflow catalogue support is disabled by default', () => {
  assert.equal(isWorkflowCataloguePremiumEnabled(), false);
});
