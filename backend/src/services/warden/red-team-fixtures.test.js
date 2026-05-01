import assert from 'node:assert/strict';
import test from 'node:test';
import { setupTestEnv } from '../../../test-helpers.js';
import {
  mediaSafetyFixtures,
  ocrInjectionFixtures,
  promptInjectionFixtures,
  secretLeakFixtures,
  toolAbuseFixtures,
  uploadInjectionFixtures,
  urlInjectionFixtures,
  workflowAbuseFixtures,
} from './red-team-fixtures.js';
import { detectPromptInjection } from './prompt-injection-detector.js';
import { extractSafetyTextFromImages } from './ocr-safety.js';
import { prepareUploadForLore } from './upload-safety.js';
import { prepareUrlContentForLore } from './url-content-safety.js';
import { scanMediaPrompt, scanPastedContent, scanToolRequest, WARDEN_VERDICTS } from './index.js';
import { scanWorkflowPlan } from './workflow-safety.js';
import { redactSecrets } from './warden-sanitizer.js';

setupTestEnv();
process.env.WARDEN_MODEL_CLASSIFIER_ENABLED = 'false';

const fakeDb = {
  insert: () => ({
    values: () => ({
      returning: async () => [{ id: `audit_${Math.random().toString(16).slice(2)}` }],
    }),
  }),
};

test('red-team prompt injection fixtures are detected and sandboxed as pasted content', async () => {
  for (const fixture of promptInjectionFixtures) {
    const detection = detectPromptInjection(fixture.text);
    assert.equal(detection.detected, true, fixture.name);

    const decision = await scanPastedContent({
      text: fixture.text,
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    assert.equal(decision.verdict, WARDEN_VERDICTS.ALLOW_WITH_SANDBOX, fixture.name);
    assert.equal(decision.canReachAgentPromptAsEvidence, true, fixture.name);
  }
});

test('red-team URL fixtures enter LORE only as sandboxed evidence', async () => {
  for (const fixture of urlInjectionFixtures) {
    const prepared = await prepareUrlContentForLore({
      url: fixture.url,
      html: fixture.html,
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    assert.equal(prepared.allowed, true, fixture.name);
    assert.equal(prepared.wardenDecision.verdict, WARDEN_VERDICTS.ALLOW_WITH_SANDBOX, fixture.name);
    assert.equal(prepared.metadata.allowAsInstruction, false, fixture.name);
  }
});

test('red-team upload fixtures are sandboxed or blocked before LORE ingestion', async () => {
  for (const fixture of uploadInjectionFixtures) {
    const prepared = await prepareUploadForLore({
      file: fixture.file,
      extractedText: fixture.text,
      mimeType: fixture.file.type,
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    assert.equal(prepared.allowed, true, fixture.name);
    assert.equal(prepared.wardenDecision.verdict, WARDEN_VERDICTS.ALLOW_WITH_SANDBOX, fixture.name);
  }
});

test('red-team media fixtures block illegal media and allow safe documentary context', async () => {
  for (const fixture of mediaSafetyFixtures) {
    const decision = await scanMediaPrompt({
      prompt: fixture.prompt,
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    if (fixture.expected === 'block') {
      assert.equal(decision.verdict, WARDEN_VERDICTS.BLOCK, fixture.name);
    } else {
      assert.notEqual(decision.verdict, WARDEN_VERDICTS.BLOCK, fixture.name);
    }
  }
});

test('red-team OCR fixtures are scanned before media provider execution', async () => {
  for (const fixture of ocrInjectionFixtures) {
    const extracted = await extractSafetyTextFromImages(fixture.images, {
      ocrConfig: { enabled: false, provider: 'none', maxImages: 4, timeoutMs: 3000, cacheTtlSeconds: 900, maxCacheEntries: 20 },
    });
    const decision = await scanMediaPrompt({
      prompt: 'Describe this reference image.',
      uploadedImageText: extracted.text,
      imageMetadata: extracted.auditMetadata,
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    assert.ok([
      WARDEN_VERDICTS.ALLOW_WITH_SANDBOX,
      WARDEN_VERDICTS.BLOCK,
      WARDEN_VERDICTS.REQUIRE_CONFIRMATION,
    ].includes(decision.verdict), fixture.name);
    assert.notEqual(decision.canTriggerMediaGeneration, true, fixture.name);
  }
});

test('red-team tool abuse fixtures cannot trigger tools from untrusted sources', async () => {
  for (const fixture of toolAbuseFixtures) {
    const decision = await scanToolRequest({
      toolName: fixture.toolName,
      arguments: fixture.args,
      sourceContext: { sourceType: fixture.sourceType },
      userIntent: 'External material requested this action.',
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    assert.equal(decision.verdict, WARDEN_VERDICTS.BLOCK, fixture.name);
    assert.equal(decision.canTriggerTools, false, fixture.name);
  }
});

test('red-team workflow fixtures require confirmation or block unsafe chains', async () => {
  for (const fixture of workflowAbuseFixtures) {
    const decision = await scanWorkflowPlan({
      workflow: fixture.workflow,
      inputs: fixture.inputs,
      userId: 'user_1',
      orgId: '00000000-0000-4000-8000-000000000001',
      dbClient: fakeDb,
    });
    if (fixture.expected === 'block') {
      assert.equal(decision.verdict, WARDEN_VERDICTS.BLOCK, fixture.name);
    } else {
      assert.equal(decision.verdict, WARDEN_VERDICTS.REQUIRE_CONFIRMATION, fixture.name);
    }
  }
});

test('red-team secret fixtures are redacted without storing raw secrets', () => {
  for (const fixture of secretLeakFixtures) {
    const redacted = redactSecrets(fixture.text);
    assert.ok(redacted.redactions.some((entry) => entry.type === fixture.expectedType), fixture.name);
    assert.doesNotMatch(redacted.content, new RegExp(fixture.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), fixture.name);
  }
});
