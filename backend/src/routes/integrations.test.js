import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

process.env.FRONTEND_URL ??= 'https://app.prymal.io';
process.env.API_URL ??= 'https://api.prymal.io';

const { default: integrationsRouter, encodeState, decodeState } = await import('./integrations.js');

test('integration state round-trips with signature validation', async () => {
  const encoded = await encodeState({
    orgId: 'org_123',
    userId: 'user_123',
    service: 'slack',
  });

  const decoded = await decodeState(encoded);

  assert.equal(decoded.orgId, 'org_123');
  assert.equal(decoded.userId, 'user_123');
  assert.equal(decoded.service, 'slack');
  assert.ok(Number.isFinite(decoded.issuedAt));
});

test('integration callback rejects state signed for a different service', async () => {
  const state = await encodeState({
    orgId: 'org_123',
    userId: 'user_123',
    service: 'google_drive',
  });

  const response = await integrationsRouter.request(`/slack/callback?code=test-code&state=${encodeURIComponent(state)}`);

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /error=invalid_state/);
});
