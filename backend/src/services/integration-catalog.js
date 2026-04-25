import { hasConfiguredEnvValue } from '../env.js';

const LINKEDIN_VERSION = '202604';

export const INTEGRATION_DEFINITIONS = {
  gmail: {
    name: 'Gmail',
    section: 'emails',
    category: 'Email',
    color: '#EA4335',
    icon: 'GM',
    description: 'HERALD and WREN can draft and work from your actual inbox context.',
    authMode: 'oauth',
    capabilities: ['inbox_context', 'send_email'],
    supportsPublish: false,
    settingsFields: [],
    sortOrder: 10,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.send'],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    supportsRefresh: true,
  },
  outlook: {
    name: 'Outlook',
    section: 'emails',
    category: 'Email',
    color: '#0078D4',
    icon: 'OL',
    description: 'Verify mailbox access and send real outbound email through delegated Microsoft Graph tokens.',
    authMode: 'manual_token',
    secretLabel: 'Microsoft Graph user token',
    secretPlaceholder: 'Microsoft Graph token',
    capabilities: ['inbox_context', 'send_email', 'delivery_feedback'],
    supportsPublish: true,
    targetLabel: 'Recipient email(s)',
    settingsFields: [
      {
        key: 'defaultRecipientEmail',
        label: 'Default recipient email(s)',
        placeholder: 'founder@example.com',
        helpText: 'Use commas to separate multiple recipients for quick send tests.',
      },
    ],
    sortOrder: 15,
  },
  google_drive: {
    name: 'Google Drive',
    section: 'files',
    category: 'Storage',
    color: '#34A853',
    icon: 'GD',
    description: 'Keep a trusted Google Drive account linked to the organisation for future file-aware workflows.',
    authMode: 'oauth',
    capabilities: ['file_account_link', 'storage_access'],
    supportsPublish: false,
    settingsFields: [],
    sortOrder: 20,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    supportsRefresh: true,
  },
  onedrive: {
    name: 'OneDrive',
    section: 'files',
    category: 'Files',
    color: '#0A5BD3',
    icon: 'OD',
    description: 'Verify OneDrive access and keep a trusted Microsoft file account linked to the organisation.',
    authMode: 'manual_token',
    secretLabel: 'Microsoft Graph user token',
    secretPlaceholder: 'Microsoft Graph token',
    capabilities: ['file_account_link', 'storage_access'],
    supportsPublish: false,
    settingsFields: [],
    sortOrder: 25,
  },
  dropbox: {
    name: 'Dropbox',
    section: 'files',
    category: 'Files',
    color: '#0061FF',
    icon: 'DB',
    description: 'Link Dropbox credentials so Prymal can verify the workspace account and keep it org-scoped.',
    authMode: 'manual_token',
    secretLabel: 'Dropbox access token',
    secretPlaceholder: 'Dropbox access token',
    capabilities: ['file_account_link', 'storage_access'],
    supportsPublish: false,
    settingsFields: [],
    sortOrder: 27,
  },
  box: {
    name: 'Box',
    section: 'files',
    category: 'Files',
    color: '#0A66FF',
    icon: 'BX',
    description: 'Verify Box account access and preserve that file source inside Prymal’s integration layer.',
    authMode: 'manual_token',
    secretLabel: 'Box access token',
    secretPlaceholder: 'Box access token',
    capabilities: ['file_account_link', 'storage_access'],
    supportsPublish: false,
    settingsFields: [],
    sortOrder: 29,
  },
  notion: {
    name: 'Notion',
    section: 'knowledge',
    category: 'Knowledge',
    color: '#111827',
    icon: 'NO',
    description: 'Keep a trusted Notion workspace linked to the organisation for future knowledge workflows.',
    authMode: 'oauth',
    capabilities: ['workspace_account_link', 'knowledge_account'],
    supportsPublish: false,
    settingsFields: [],
    sortOrder: 30,
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    clientId: () => process.env.NOTION_CLIENT_ID,
    clientSecret: () => process.env.NOTION_CLIENT_SECRET,
    supportsRefresh: false,
  },
  slack: {
    name: 'Slack',
    section: 'messaging',
    category: 'Communication',
    color: '#4A154B',
    icon: 'SL',
    description: 'Route workflow alerts, operator handoffs, and social drops into team channels.',
    authMode: 'oauth',
    capabilities: ['team_handoffs', 'workflow_alerts', 'autopost'],
    supportsPublish: true,
    targetLabel: 'Channel ID or App Home user ID',
    settingsFields: [
      {
        key: 'defaultChannelId',
        label: 'Default channel ID',
        placeholder: 'C0123456789',
        helpText: 'Used for workflow alerts and test posts when you do not override the target.',
      },
    ],
    sortOrder: 40,
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read'],
    clientId: () => process.env.SLACK_CLIENT_ID,
    clientSecret: () => process.env.SLACK_CLIENT_SECRET,
    supportsRefresh: false,
  },
  discord: {
    name: 'Discord',
    section: 'socials',
    category: 'Community',
    color: '#5865F2',
    icon: 'DC',
    description: 'Push launch notes, community updates, and operator alerts into Discord channels.',
    authMode: 'manual_token',
    secretLabel: 'Bot token',
    secretPlaceholder: 'Discord bot token',
    capabilities: ['community_posts', 'autopost', 'delivery_feedback'],
    supportsPublish: true,
    targetLabel: 'Channel ID',
    settingsFields: [
      {
        key: 'defaultChannelId',
        label: 'Default channel ID',
        placeholder: '123456789012345678',
        requiredOnConnect: true,
      },
    ],
    sortOrder: 50,
  },
  telegram: {
    name: 'Telegram',
    section: 'messaging',
    category: 'Messaging',
    color: '#229ED9',
    icon: 'TG',
    description: 'Broadcast updates or image-led drops through Telegram bots, groups, and channels.',
    authMode: 'manual_token',
    secretLabel: 'Bot token',
    secretPlaceholder: 'Telegram bot token',
    capabilities: ['broadcasts', 'autopost', 'delivery_feedback'],
    supportsPublish: true,
    supportsImagePublish: true,
    targetLabel: 'Chat ID or @channelusername',
    settingsFields: [
      {
        key: 'defaultChatId',
        label: 'Default chat ID or channel',
        placeholder: '@prymal_updates',
        requiredOnConnect: true,
      },
    ],
    sortOrder: 60,
  },
  x: {
    name: 'X',
    section: 'socials',
    category: 'Social',
    color: '#111111',
    icon: 'X',
    description: 'Publish short-form drops and threaded updates to X with a user access token.',
    authMode: 'manual_token',
    secretLabel: 'User access token',
    secretPlaceholder: 'X user token',
    capabilities: ['social_posts', 'autopost', 'delivery_feedback'],
    supportsPublish: true,
    settingsFields: [],
    sortOrder: 70,
  },
  mastodon: {
    name: 'Mastodon',
    section: 'socials',
    category: 'Social',
    color: '#563ACC',
    icon: 'MD',
    description: 'Publish authenticated updates to any Mastodon instance with a user token and instance URL.',
    authMode: 'manual_token',
    secretLabel: 'User token',
    secretPlaceholder: 'Mastodon user token',
    capabilities: ['social_posts', 'autopost', 'delivery_feedback'],
    supportsPublish: true,
    settingsFields: [
      {
        key: 'instanceUrl',
        label: 'Instance URL',
        placeholder: 'https://mastodon.social',
        requiredOnConnect: true,
        helpText: 'Use the full base URL for the account instance.',
      },
      {
        key: 'defaultVisibility',
        label: 'Default visibility',
        input: 'select',
        options: ['public', 'unlisted', 'private'],
      },
    ],
    sortOrder: 75,
  },
  linkedin: {
    name: 'LinkedIn',
    section: 'socials',
    category: 'Social',
    color: '#0A66C2',
    icon: 'LI',
    description: 'Push founder or company posts to LinkedIn using member or organisation access tokens.',
    authMode: 'manual_token',
    secretLabel: 'Member or organisation token',
    secretPlaceholder: 'LinkedIn post token',
    capabilities: ['social_posts', 'autopost', 'delivery_feedback'],
    supportsPublish: true,
    targetLabel: 'Author URN',
    settingsFields: [
      {
        key: 'authorUrn',
        label: 'Author URN',
        placeholder: 'urn:li:person:123',
        requiredOnConnect: true,
      },
      {
        key: 'defaultVisibility',
        label: 'Default visibility',
        input: 'select',
        options: ['PUBLIC', 'CONNECTIONS'],
      },
    ],
    defaultHeaders: {
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': LINKEDIN_VERSION,
    },
    sortOrder: 80,
  },
  custom_webhook: {
    name: 'Custom Webhook',
    section: 'custom',
    category: 'Custom',
    color: '#F97316',
    icon: 'WH',
    description: 'POST Prymal outputs into any external system or internal automation endpoint.',
    authMode: 'manual_token',
    secretLabel: 'Bearer token (optional)',
    secretPlaceholder: 'Paste a bearer token if the endpoint requires auth',
    capabilities: ['external_system_sync', 'autopost', 'delivery_feedback'],
    supportsPublish: true,
    targetLabel: 'Endpoint URL',
    settingsFields: [
      {
        key: 'endpointUrl',
        label: 'Endpoint URL',
        placeholder: 'https://example.com/hook',
        requiredOnConnect: true,
      },
      {
        key: 'method',
        label: 'HTTP method',
        input: 'select',
        options: ['POST', 'PUT'],
      },
      {
        key: 'authHeaderName',
        label: 'Auth header name',
        placeholder: 'Authorization',
      },
      {
        key: 'authScheme',
        label: 'Auth scheme',
        input: 'select',
        options: ['Bearer', 'Token', 'Raw'],
      },
    ],
    sortOrder: 90,
  },
};

export function getIntegrationDefinition(service) {
  return INTEGRATION_DEFINITIONS[service] ?? null;
}

export function isOauthIntegration(service) {
  return getIntegrationDefinition(service)?.authMode === 'oauth';
}

export function isManualIntegration(service) {
  return getIntegrationDefinition(service)?.authMode === 'manual_token';
}

export function getAvailableIntegrations() {
  return Object.entries(INTEGRATION_DEFINITIONS)
    .map(([id, definition]) => serializeAvailableIntegration(id, definition))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.name.localeCompare(right.name);
    });
}

export function serializeAvailableIntegration(id, definition = getIntegrationDefinition(id)) {
  if (!definition) {
    return null;
  }

  return {
    id,
    name: definition.name,
    section: definition.section ?? 'custom',
    category: definition.category,
    color: definition.color,
    icon: definition.icon,
    description: definition.description,
    authMode: definition.authMode,
    configured:
      definition.authMode === 'oauth'
        ? hasConfiguredEnvValue(definition.clientId?.()) && hasConfiguredEnvValue(definition.clientSecret?.())
        : true,
    capabilities: definition.capabilities ?? [],
    supportsPublish: Boolean(definition.supportsPublish),
    supportsImagePublish: Boolean(definition.supportsImagePublish),
    targetLabel: definition.targetLabel ?? null,
    secretLabel: definition.secretLabel ?? null,
    secretPlaceholder: definition.secretPlaceholder ?? null,
    settingsFields: definition.settingsFields ?? [],
    sortOrder: definition.sortOrder ?? 100,
  };
}

export function sanitizeIntegrationMeta(service, meta = {}) {
  const definition = getIntegrationDefinition(service);
  const settings = sanitizeIntegrationSettings(service, meta.settings ?? {});
  const recentDeliveries = Array.isArray(meta.recentDeliveries)
    ? meta.recentDeliveries.slice(0, 8).map((entry) => ({
        service,
        publishedAt: entry.publishedAt ?? null,
        target: entry.target ?? null,
        status: entry.status ?? 'sent',
        providerMessageId: entry.providerMessageId ?? null,
        preview: entry.preview ?? null,
        linkUrl: entry.linkUrl ?? null,
      }))
    : [];

  return {
    authMode: definition?.authMode ?? 'oauth',
    settings,
    health: meta.health
      ? {
          status: meta.health.status ?? 'unknown',
          checkedAt: meta.health.checkedAt ?? null,
          message: meta.health.message ?? null,
        }
      : null,
    profile: meta.profile
      ? {
          name: meta.profile.name ?? null,
          handle: meta.profile.handle ?? null,
          workspace: meta.profile.workspace ?? null,
          avatarUrl: meta.profile.avatarUrl ?? null,
        }
      : null,
    publishStats: {
      total: Number(meta.publishStats?.total ?? 0),
      lastPublishedAt: meta.publishStats?.lastPublishedAt ?? null,
      lastTarget: meta.publishStats?.lastTarget ?? null,
    },
    recentDeliveries,
  };
}

export function sanitizeIntegrationSettings(service, rawSettings = {}) {
  const definition = getIntegrationDefinition(service);
  if (!definition) {
    return {};
  }

  const sanitized = {};

  for (const field of definition.settingsFields ?? []) {
    const rawValue = rawSettings[field.key];
    if (rawValue == null) {
      continue;
    }

    if (field.input === 'select') {
      const normalized = String(rawValue).trim();
      if (!normalized) {
        continue;
      }
      if (Array.isArray(field.options) && !field.options.includes(normalized)) {
        continue;
      }
      sanitized[field.key] = normalized;
      continue;
    }

    const normalized = String(rawValue).trim();
    if (!normalized) {
      continue;
    }
    sanitized[field.key] = normalized;
  }

  return sanitized;
}

export function buildDeliveryMeta(service, existingMeta = {}, receipt = {}) {
  const sanitizedMeta = sanitizeIntegrationMeta(service, existingMeta);
  const publishedAt = receipt.publishedAt ?? new Date().toISOString();
  const nextDelivery = {
    publishedAt,
    target: receipt.target ?? null,
    status: receipt.status ?? 'sent',
    providerMessageId: receipt.providerMessageId ?? null,
    preview: receipt.preview ?? null,
    linkUrl: receipt.linkUrl ?? null,
  };

  return {
    ...existingMeta,
    settings: sanitizedMeta.settings,
    health: sanitizedMeta.health,
    profile: sanitizedMeta.profile,
    publishStats: {
      total: Number(sanitizedMeta.publishStats?.total ?? 0) + 1,
      lastPublishedAt: publishedAt,
      lastTarget: receipt.target ?? null,
    },
    recentDeliveries: [nextDelivery, ...(sanitizedMeta.recentDeliveries ?? [])].slice(0, 8),
  };
}
