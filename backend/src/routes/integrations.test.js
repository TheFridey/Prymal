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

// ── Token expiry serialization ─────────────────────────────────────────────────

test('serializeIntegrationConnection marks expired token and disables publish', () => {
  const expiredAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const serialized = serializeIntegrationConnection({
    id: 'int_expired',
    service: 'linkedin',
    accessToken: 'encrypted-token',
    refreshToken: null,
    tokenExpiresAt: expiredAt,
    accountId: 'acct',
    accountEmail: 'owner@example.com',
    scopes: ['w_member_social'],
    meta: { authMode: 'oauth' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(serialized.tokenExpired, true);
  assert.equal(serialized.tokenStatus.status, 'expired');
  assert.equal(serialized.tokenStatus.daysRemaining, 0);
  assert.equal(serialized.publishDisabled, true);
});

test('serializeIntegrationConnection marks token expiring within 7 days', () => {
  const soonAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days from now
  const serialized = serializeIntegrationConnection({
    id: 'int_expiring',
    service: 'slack',
    accessToken: 'encrypted-token',
    refreshToken: null,
    tokenExpiresAt: soonAt,
    accountId: 'T123',
    accountEmail: null,
    scopes: [],
    meta: { authMode: 'oauth' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(serialized.tokenExpired, false);
  assert.equal(serialized.tokenStatus.status, 'expiring_soon');
});

test('serializeIntegrationConnection marks valid token correctly', () => {
  const futureAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days out
  const serialized = serializeIntegrationConnection({
    id: 'int_valid',
    service: 'slack',
    accessToken: 'encrypted-token',
    refreshToken: null,
    tokenExpiresAt: futureAt,
    accountId: 'T123',
    accountEmail: null,
    scopes: [],
    meta: { authMode: 'oauth' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(serialized.tokenExpired, false);
  assert.equal(serialized.tokenStatus.status, 'valid');
  assert.equal(serialized.publishDisabled, false);
});

test('serializeIntegrationConnection returns unknown tokenStatus when no expiry is stored', () => {
  const serialized = serializeIntegrationConnection({
    id: 'int_no_expiry',
    service: 'x',
    accessToken: 'encrypted-token',
    refreshToken: null,
    accountId: null,
    accountEmail: null,
    scopes: [],
    meta: { authMode: 'manual_token' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(serialized.tokenExpired, false);
  assert.equal(serialized.tokenStatus.status, 'unknown');
  assert.equal(serialized.tokenStatus.daysRemaining, null);
});

// ── Slack publish ──────────────────────────────────────────────────────────────

test('Slack publish calls chat.postMessage with correct channel and Authorization header', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ ok: true, ts: '1234567890.123456' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const delivery = await publishIntegrationPayload({
    service: 'slack',
    accessToken: 'xoxb-test-token',
    connection: null,
    settings: { defaultChannelId: 'C0123456789' },
    payload: { text: 'Hello Slack', title: 'Launch update' },
  });

  assert.equal(request.url, 'https://slack.com/api/chat.postMessage');
  assert.equal(request.options.headers['Authorization'], 'Bearer xoxb-test-token');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(request.options.body);
  assert.equal(body.channel, 'C0123456789');
  assert.ok(body.text.includes('Hello Slack'));
  assert.equal(delivery.target, 'C0123456789');
  assert.equal(delivery.providerMessageId, '1234567890.123456');

  globalThis.fetch = originalFetch;
});

test('Slack publish throws when no channel ID is configured', async () => {
  await assert.rejects(
    () => publishIntegrationPayload({
      service: 'slack',
      accessToken: 'xoxb-test-token',
      connection: null,
      settings: {},
      payload: { text: 'No channel' },
    }),
    /channel/i,
  );
});

test('Slack publish throws when the provider returns ok: false', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ ok: false, error: 'channel_not_found' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

  await assert.rejects(
    () => publishIntegrationPayload({
      service: 'slack',
      accessToken: 'xoxb-test-token',
      connection: null,
      settings: { defaultChannelId: 'C_BAD' },
      payload: { text: 'Test' },
    }),
    /channel_not_found/i,
  );

  globalThis.fetch = originalFetch;
});

// ── X (Twitter) publish ────────────────────────────────────────────────────────

test('X publish calls api.x.com/2/tweets with text body and Bearer token', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ data: { id: '1234567890' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };

  const delivery = await publishIntegrationPayload({
    service: 'x',
    accessToken: 'x-oauth-user-token',
    connection: null,
    settings: {},
    payload: { text: 'Hello X from Prymal' },
  });

  assert.equal(request.url, 'https://api.x.com/2/tweets');
  assert.equal(request.options.headers['Authorization'], 'Bearer x-oauth-user-token');
  const body = JSON.parse(request.options.body);
  assert.equal(body.text, 'Hello X from Prymal');
  assert.equal(delivery.providerMessageId, '1234567890');

  globalThis.fetch = originalFetch;
});

test('X publish throws when the provider returns an error body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ title: 'Unauthorized', detail: 'Invalid token' }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  );

  await assert.rejects(
    () => publishIntegrationPayload({
      service: 'x',
      accessToken: 'bad-token',
      connection: null,
      settings: {},
      payload: { text: 'Fail' },
    }),
    /Invalid token/i,
  );

  globalThis.fetch = originalFetch;
});

// ── Telegram publish ───────────────────────────────────────────────────────────

test('Telegram publish calls sendMessage with chat_id in form-encoded body', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(
      JSON.stringify({ ok: true, result: { message_id: 42 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const delivery = await publishIntegrationPayload({
    service: 'telegram',
    accessToken: '123456:bot-token',
    connection: null,
    settings: { defaultChatId: '@prymal_channel' },
    payload: { text: 'Hello Telegram' },
  });

  assert.ok(request.url.includes('api.telegram.org/bot123456:bot-token/sendMessage'));
  assert.equal(request.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const params = new URLSearchParams(request.options.body.toString());
  assert.equal(params.get('chat_id'), '@prymal_channel');
  assert.ok(params.get('text')?.includes('Hello Telegram'));
  assert.equal(delivery.providerMessageId, '42');

  globalThis.fetch = originalFetch;
});

test('Telegram publish throws when no chat ID is configured', async () => {
  await assert.rejects(
    () => publishIntegrationPayload({
      service: 'telegram',
      accessToken: '123456:bot-token',
      connection: null,
      settings: {},
      payload: { text: 'No chat id' },
    }),
    /chat/i,
  );
});

// ── Discord publish ────────────────────────────────────────────────────────────

test('Discord publish uses Bot token scheme (not Bearer)', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 'msg-99' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const delivery = await publishIntegrationPayload({
    service: 'discord',
    accessToken: 'discord-bot-token',
    connection: null,
    settings: { defaultChannelId: '987654321' },
    payload: { text: 'Hello Discord' },
  });

  assert.ok(request.url.includes('discord.com/api/v10/channels/987654321/messages'));
  assert.equal(request.options.headers['Authorization'], 'Bot discord-bot-token');
  const body = JSON.parse(request.options.body);
  assert.ok(body.content.includes('Hello Discord'));
  assert.equal(delivery.providerMessageId, 'msg-99');

  globalThis.fetch = originalFetch;
});
