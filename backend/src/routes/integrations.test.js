import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

process.env.FRONTEND_URL ??= 'https://app.prymal.io';
process.env.API_URL ??= 'https://api.prymal.io';

const {
  default: integrationsRouter,
  decodeState,
  encodeState,
  publishIntegrationPayload,
  serializeIntegrationConnection,
  testIntegrationConnection,
  validateIntegrationSettings,
} = await import('./integrations.js');

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

test('LinkedIn unauthorized_scope_error redirects to a clear app error', async () => {
  const response = await integrationsRouter.request('/linkedin/callback?error=unauthorized_scope_error');

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') ?? '', /error=linkedin_scope_not_approved/);
});

test('LinkedIn author URN validation rejects malformed values', () => {
  assert.match(
    validateIntegrationSettings('linkedin', { authorUrn: '115856278' }),
    /valid LinkedIn author URN/i,
  );
  assert.equal(validateIntegrationSettings('linkedin', { authorUrn: 'urn:li:organization:115856278' }), null);
  assert.equal(validateIntegrationSettings('linkedin', { authorUrn: 'urn:li:person:abc123' }), null);
});

test('serializeIntegrationConnection never exposes encrypted token fields and flags old LinkedIn connections', () => {
  const serialized = serializeIntegrationConnection({
    id: 'int_1',
    service: 'linkedin',
    accessToken: 'encrypted-access-token',
    refreshToken: 'encrypted-refresh-token',
    accountId: 'acct',
    accountEmail: 'owner@example.com',
    scopes: ['w_member_social'],
    meta: {
      authMode: 'manual_token',
      settings: { authorUrn: 'urn:li:organization:115856278' },
    },
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  });

  assert.equal(Object.hasOwn(serialized, 'accessToken'), false);
  assert.equal(Object.hasOwn(serialized, 'refreshToken'), false);
  assert.equal(serialized.authMode, 'oauth');
  assert.equal(serialized.meta.needsReconnect, true);
});

test('LinkedIn identity-only connection serializes as connected with publishing disabled', () => {
  const serialized = serializeIntegrationConnection({
    id: 'int_identity',
    service: 'linkedin',
    accessToken: 'encrypted-access-token',
    refreshToken: null,
    accountId: 'linkedin-user',
    accountEmail: 'owner@example.com',
    scopes: ['openid', 'profile', 'email'],
    meta: {
      authMode: 'oauth',
      profile: { name: 'Prymal Owner' },
    },
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  });

  assert.equal(serialized.accountEmail, 'owner@example.com');
  assert.equal(serialized.postingNotReady, true);
  assert.equal(serialized.publishDisabled, true);
  assert.equal(serialized.meta.needsReconnect, false);
});

test('LinkedIn test maps invalid token to safe reconnect copy', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Bearer abc token invalid' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(
    () => testIntegrationConnection({
      service: 'linkedin',
      accessToken: 'secret-token',
      settings: { authorUrn: 'urn:li:person:abc123' },
    }),
    /LinkedIn connection expired or invalid/i,
  );

  globalThis.fetch = originalFetch;
});

test('LinkedIn publish builds REST posts payload without leaking tokens', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response('{}', {
      status: 201,
      headers: {
        'content-type': 'application/json',
        'x-restli-id': 'urn:li:share:123',
      },
    });
  };

  const delivery = await publishIntegrationPayload({
    service: 'linkedin',
    accessToken: 'secret-token',
    connection: { scopes: ['w_organization_social'] },
    settings: { authorUrn: 'urn:li:organization:115856278', defaultVisibility: 'PUBLIC' },
    payload: { text: 'Hello LinkedIn', title: 'Launch', linkUrl: 'https://prymal.io' },
  });

  assert.equal(request.url, 'https://api.linkedin.com/rest/posts');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-token');
  assert.equal(request.options.headers['X-Restli-Protocol-Version'], '2.0.0');
  assert.equal(request.options.headers['Linkedin-Version'].length, 6);
  assert.deepEqual(JSON.parse(request.options.body), {
    author: 'urn:li:organization:115856278',
    commentary: 'Launch\n\nHello LinkedIn',
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
    content: {
      article: {
        source: 'https://prymal.io',
        title: 'Launch',
        description: 'Hello LinkedIn',
      },
    },
  });
  assert.equal(delivery.providerMessageId, 'urn:li:share:123');

  globalThis.fetch = originalFetch;
});

test('LinkedIn publish maps missing posting scope to safe client copy', async () => {
  await assert.rejects(
    () => publishIntegrationPayload({
      service: 'linkedin',
      accessToken: 'secret-token',
      connection: { scopes: ['openid', 'profile'] },
      settings: { authorUrn: 'urn:li:organization:115856278' },
      payload: { text: 'Hello' },
    }),
    /posting permission is not enabled/i,
  );
});
