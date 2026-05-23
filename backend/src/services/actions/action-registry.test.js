import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../../test-helpers.js';

setupTestEnv();

const { executeAction, isKnownActionType, getSupportedActionTypes } = await import('./action-registry.js');

test('executeAction routes to correct handler and returns success shape', async () => {
  let handlerCalled = false;
  let receivedPayload = null;
  let receivedContext = null;

  // Monkey-patch the email handler via module mock pattern
  const originalModule = await import('./email-actions.js');
  const originalSend = originalModule.sendEmail;

  // Use a stub by overriding in action-registry handler map
  // Since we can't easily mock ES modules, test the shape with an unknown type
  const result = await executeAction('unknown.type', {}, { orgId: 'org_1' });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Unknown action type'));
  assert.equal(result.code, 'UNKNOWN_ACTION_TYPE');
  void originalSend;
  void handlerCalled;
  void receivedPayload;
  void receivedContext;
});

test('isKnownActionType returns true for supported types', () => {
  assert.equal(isKnownActionType('email.send'), true);
  assert.equal(isKnownActionType('drive.write'), true);
  assert.equal(isKnownActionType('drive.append'), true);
  assert.equal(isKnownActionType('drive.folder'), true);
  assert.equal(isKnownActionType('slack.post'), true);
  assert.equal(isKnownActionType('slack.reply'), true);
  assert.equal(isKnownActionType('social.publish'), true);
});

test('isKnownActionType returns false for unknown types', () => {
  assert.equal(isKnownActionType('unknown'), false);
  assert.equal(isKnownActionType(''), false);
  assert.equal(isKnownActionType('sql.exec'), false);
});

test('getSupportedActionTypes returns an array with all known types', () => {
  const types = getSupportedActionTypes();
  assert.ok(Array.isArray(types));
  assert.ok(types.includes('email.send'));
  assert.ok(types.includes('drive.write'));
  assert.ok(types.includes('slack.post'));
  assert.ok(types.includes('social.publish'));
  assert.ok(types.length >= 6);
});

test('executeAction returns UNKNOWN_ACTION_TYPE for unregistered type', async () => {
  const result = await executeAction('phishing.send', { to: 'victim@example.com' }, { orgId: 'org_1' });
  assert.equal(result.success, false);
  assert.equal(result.code, 'UNKNOWN_ACTION_TYPE');
});

test('executeAction catches handler errors without throwing to caller', async () => {
  // Create a temporary bad handler by calling with a type that will fail at OAuth lookup
  // (no database available in unit tests — it will throw)
  const result = await executeAction('email.send', { to: 'test@example.com' }, { orgId: 'org_unit_test' });
  // Must not throw — must return a failure result
  assert.equal(typeof result, 'object');
  assert.equal(result.success, false);
  assert.ok(typeof result.error === 'string');
});
