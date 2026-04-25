import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const {
  buildDeliveryMeta,
  getAvailableIntegrations,
  getIntegrationDefinition,
  isManualIntegration,
  isOauthIntegration,
  sanitizeIntegrationMeta,
  sanitizeIntegrationSettings,
} = await import('./integration-catalog.js');

test('manual-token integrations stay available without server OAuth env', () => {
  const available = getAvailableIntegrations();
  const discord = available.find((entry) => entry.id === 'discord');
  const webhook = available.find((entry) => entry.id === 'custom_webhook');

  assert.equal(discord?.configured, true);
  assert.equal(webhook?.configured, true);
  assert.equal(discord?.authMode, 'manual_token');
});

test('oauth integrations reflect missing server config', () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  process.env.GOOGLE_CLIENT_ID = 'xxxx.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'xxxx';

  const available = getAvailableIntegrations();
  const gmail = available.find((entry) => entry.id === 'gmail');

  assert.equal(gmail?.configured, false);
  assert.equal(gmail?.authMode, 'oauth');

  process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
});

test('settings sanitization keeps only declared integration fields', () => {
  const settings = sanitizeIntegrationSettings('linkedin', {
    authorUrn: ' urn:li:organization:123 ',
    defaultVisibility: 'PUBLIC',
    ignoredField: 'nope',
  });

  assert.deepEqual(settings, {
    authorUrn: 'urn:li:organization:123',
    defaultVisibility: 'PUBLIC',
  });
});

test('meta sanitization trims delivery history and exposes safe health/profile data', () => {
  const meta = sanitizeIntegrationMeta('discord', {
    settings: { defaultChannelId: '12345', secret: 'nope' },
    health: { status: 'healthy', checkedAt: '2026-04-24T20:00:00.000Z', message: 'Connected' },
    profile: { name: 'Prymal Bot', handle: 'prymal-bot', avatarUrl: 'https://example.com/bot.png' },
    publishStats: { total: 3, lastPublishedAt: '2026-04-24T20:01:00.000Z', lastTarget: '12345' },
    recentDeliveries: Array.from({ length: 10 }, (_, index) => ({
      publishedAt: `2026-04-24T20:0${index}:00.000Z`,
      target: `channel-${index}`,
      status: 'sent',
      providerMessageId: `${index}`,
      preview: `Preview ${index}`,
    })),
  });

  assert.equal(meta.settings.defaultChannelId, '12345');
  assert.equal(meta.health?.status, 'healthy');
  assert.equal(meta.profile?.handle, 'prymal-bot');
  assert.equal(meta.publishStats.total, 3);
  assert.equal(meta.recentDeliveries.length, 8);
});

test('buildDeliveryMeta appends a new delivery receipt and increments publish stats', () => {
  const nextMeta = buildDeliveryMeta(
    'slack',
    {
      settings: { defaultChannelId: 'C123' },
      publishStats: { total: 1, lastPublishedAt: '2026-04-24T20:00:00.000Z', lastTarget: 'C123' },
      recentDeliveries: [
        {
          publishedAt: '2026-04-24T20:00:00.000Z',
          target: 'C123',
          status: 'sent',
          providerMessageId: 'old-1',
          preview: 'Old delivery',
        },
      ],
    },
    {
      publishedAt: '2026-04-24T20:05:00.000Z',
      target: 'C999',
      providerMessageId: 'new-1',
      preview: 'New delivery',
      linkUrl: 'https://prymal.io',
    },
  );

  assert.equal(nextMeta.publishStats.total, 2);
  assert.equal(nextMeta.publishStats.lastTarget, 'C999');
  assert.equal(nextMeta.recentDeliveries[0].providerMessageId, 'new-1');
  assert.equal(nextMeta.recentDeliveries[1].providerMessageId, 'old-1');
});

test('integration definitions expose sections, auth modes, and publish support for the expanded catalog', () => {
  const available = getAvailableIntegrations();
  const outlook = available.find((entry) => entry.id === 'outlook');
  const mastodon = available.find((entry) => entry.id === 'mastodon');
  const onedrive = available.find((entry) => entry.id === 'onedrive');

  assert.equal(isOauthIntegration('slack'), true);
  assert.equal(isManualIntegration('discord'), true);
  assert.equal(getIntegrationDefinition('x')?.supportsPublish, true);
  assert.equal(getIntegrationDefinition('linkedin')?.settingsFields[0]?.key, 'authorUrn');
  assert.equal(outlook?.section, 'emails');
  assert.equal(outlook?.supportsPublish, true);
  assert.equal(mastodon?.settingsFields[0]?.key, 'instanceUrl');
  assert.equal(onedrive?.section, 'files');
});
