import { and, eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { integrations } from '../db/schema.js';
import { hasConfiguredEnvValue } from '../env.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { createRateLimiter, planAwareRateLimit } from '../middleware/rateLimit.js';
import { RATE_LIMIT_CONFIGS } from '../middleware/rate-limit-config.js';
import { recordDeliveryOutcome } from '../services/moat-feedback.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';
import {
  buildDeliveryMeta,
  getAvailableIntegrations,
  getIntegrationDefinition,
  LINKEDIN_VERSION,
  sanitizeIntegrationMeta,
  sanitizeIntegrationSettings,
} from '../services/integration-catalog.js';
import { dispatchRuntimePublish, dispatchRuntimeTest } from '../services/integration-runtime-handlers.js';
import { redactSensitiveText, sanitizeErrorForClient } from '../services/security/redaction.js';

const router = new Hono();
const LINKEDIN_AUTHOR_URN_PATTERN = /^urn:li:(person|organization):[A-Za-z0-9_-]+$/;
const LINKEDIN_ORGANIZATION_URN_PATTERN = /^urn:li:organization:[A-Za-z0-9_-]+$/;
const LINKEDIN_RECONNECT_MESSAGE = 'LinkedIn now uses OAuth. Please reconnect LinkedIn to continue publishing.';
const LINKEDIN_POSTING_NOT_READY_MESSAGE =
  'LinkedIn is connected, but posting permission is not enabled. Update LINKEDIN_SCOPES and reconnect after LinkedIn approves posting access.';
const integrationAuthRateLimit = createRateLimiter({
  ...RATE_LIMIT_CONFIGS.integrationsConnectAndCallback,
  identifier: (context) => `${context.req.param('service')}:${resolveClientIp(context)}`,
});
const integrationWriteRateLimit = planAwareRateLimit({
  ...RATE_LIMIT_CONFIGS.integrationsWrite,
  identifier: (context) => `${context.get('org')?.orgId ?? 'unknown'}:${context.req.param('service') ?? 'unknown'}`,
});

const optionalTrimmedString = (max) =>
  z.preprocess(
    (value) => {
      if (value == null) {
        return undefined;
      }
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().max(max).optional(),
  );

const optionalUrl = (max = 4000) =>
  z.preprocess(
    (value) => {
      if (value == null) {
        return undefined;
      }
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().url().max(max).optional(),
  );

const manualSettingsSchema = z
  .object({
    defaultChannelId: optionalTrimmedString(255),
    defaultChatId: optionalTrimmedString(255),
    defaultRecipientEmail: optionalTrimmedString(500),
    defaultFromEmail: optionalTrimmedString(500),
    authorUrn: optionalTrimmedString(255),
    selectedOrganizationUrn: optionalTrimmedString(255),
    selectedOrganizationName: optionalTrimmedString(255),
    defaultVisibility: optionalTrimmedString(64),
    instanceUrl: optionalUrl(2000),
    endpointUrl: optionalUrl(2000),
    method: optionalTrimmedString(16),
    authHeaderName: optionalTrimmedString(120),
    authScheme: optionalTrimmedString(32),
    blueskyIdentifier: optionalTrimmedString(320),
    mailgunDomain: optionalTrimmedString(255),
    mailgunRegion: optionalTrimmedString(8),
    nextcloudUrl: optionalUrl(2000),
    nextcloudUsername: optionalTrimmedString(255),
    webdavUrl: optionalUrl(4000),
    webdavUsername: optionalTrimmedString(255),
    gitlabHost: optionalUrl(2000),
    bitbucketUsername: optionalTrimmedString(255),
    outlineBaseUrl: optionalUrl(2000),
    atlassianSite: optionalTrimmedString(255),
    atlassianEmail: optionalTrimmedString(320),
    bookstackUrl: optionalUrl(2000),
    mailjetApiKey: optionalTrimmedString(255),
  })
  .passthrough();

const manualConnectionSchema = z.object({
  accessToken: z.string().trim().max(8192).default(''),
  refreshToken: optionalTrimmedString(8192).nullable().optional(),
  accountId: optionalTrimmedString(255).nullable().optional(),
  accountEmail: optionalTrimmedString(255).nullable().optional(),
  scopes: z.array(z.string().trim().min(1).max(255)).max(40).optional(),
  settings: manualSettingsSchema.default({}),
  verifyOnSave: z.boolean().optional().default(true),
});

const integrationSettingsSchema = z.object({
  settings: manualSettingsSchema.default({}),
});

const publishPayloadSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  title: optionalTrimmedString(255),
  linkUrl: optionalUrl(2000),
  imageUrl: optionalUrl(4000),
  targetId: optionalTrimmedString(255),
  messageId: z.string().uuid().optional(),
  contentId: z.string().uuid().optional(),
  metadata: z
    .object({
      madeWithAi: z.boolean().optional(),
      replySettings: z.enum(['everyone', 'following', 'mentionedUsers']).optional(),
    })
    .default({}),
});

router.get('/', requireOrg, async (context) => {
  const org = context.get('org');
  const connected = await db.query.integrations.findMany({
    where: and(eq(integrations.orgId, org.orgId), eq(integrations.isActive, true)),
    columns: {
      id: true,
      service: true,
      accountId: true,
      accountEmail: true,
      scopes: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return context.json({
    connected: connected.map((entry) => serializeIntegrationConnection(entry)),
    available: getAvailableIntegrations(),
  });
});

router.get('/:service/connect', requireOrg, requireRole('owner', 'admin'), integrationAuthRateLimit, async (context) => {
  const org = context.get('org');
  const { service } = context.req.param();
  const integration = getIntegrationDefinition(service);

  if (!integration) {
    return context.json({ error: 'Unknown integration.' }, 400);
  }

  if (integration.authMode !== 'oauth') {
    return context.json({ error: `${integration.name} uses manual token linking, not OAuth.` }, 400);
  }

  if (!hasConfiguredEnvValue(integration.clientId()) || !hasConfiguredEnvValue(integration.clientSecret())) {
    return context.json({ error: `${integration.name} is not configured on the server.` }, 400);
  }

  const redirectUri = `${process.env.API_URL}/api/integrations/${service}/callback`;
  const state = await encodeState({ orgId: org.orgId, userId: org.userId, service });
  const params = new URLSearchParams({
    client_id: integration.clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  if (integration.scopes.length > 0) {
    params.set('scope', integration.scopes.join(' '));
  }

  if (service.startsWith('google')) {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  return context.redirect(`${integration.authUrl}?${params.toString()}`);
});

router.get('/:service/callback', integrationAuthRateLimit, async (context) => {
  const { service } = context.req.param();
  const integration = getIntegrationDefinition(service);
  const code = context.req.query('code');
  const error = context.req.query('error');
  const state = context.req.query('state');

  if (!integration || integration.authMode !== 'oauth') {
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=unknown_integration`);
  }

  if (error) {
    const safeError = service === 'linkedin' && error === 'unauthorized_scope_error'
      ? 'linkedin_scope_not_approved'
      : error;
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=${safeError}`);
  }

  if (!code || !state) {
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=missing_callback_data`);
  }

  let decodedState;

  try {
    decodedState = await decodeState(state);
  } catch {
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=invalid_state`);
  }

  if (decodedState.service !== service) {
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=invalid_state`);
  }

  try {
    const tokenData = await exchangeCodeForTokens(service, code);
    const account = await fetchAccountIdentity(service, tokenData);

    await db
      .insert(integrations)
      .values({
        orgId: decodedState.orgId,
        service,
        accessToken: await encrypt(tokenData.accessToken),
        refreshToken: tokenData.refreshToken ? await encrypt(tokenData.refreshToken) : null,
        tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
        scopes: tokenData.scopes.length > 0 ? tokenData.scopes : integration.scopes,
        accountId: account.accountId ?? null,
        accountEmail: account.accountEmail ?? null,
        meta: {
          ...account.meta,
          authMode: integration.authMode,
          profile: account.meta?.profile ?? null,
        },
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.service],
        set: {
          accessToken: await encrypt(tokenData.accessToken),
          refreshToken: tokenData.refreshToken ? await encrypt(tokenData.refreshToken) : null,
          tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
          scopes: tokenData.scopes.length > 0 ? tokenData.scopes : integration.scopes,
          accountId: account.accountId ?? null,
          accountEmail: account.accountEmail ?? null,
          meta: {
            ...account.meta,
            authMode: integration.authMode,
            profile: account.meta?.profile ?? null,
          },
          isActive: true,
          updatedAt: new Date(),
        },
      });

    await Promise.all([
      recordAuditLog({
        orgId: decodedState.orgId,
        actorUserId: decodedState.userId ?? null,
        action: 'integration.connected',
        targetType: 'integration',
        targetId: service,
        metadata: { accountId: account.accountId ?? null, accountEmail: account.accountEmail ?? null },
      }),
      recordProductEvent({
        orgId: decodedState.orgId,
        userId: decodedState.userId ?? null,
        eventName: 'integration.connected',
        metadata: { service },
      }),
    ]);

    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?connected=${service}`);
  } catch (exchangeError) {
    console.error('[INTEGRATIONS] OAuth callback failed:', redactSensitiveText(exchangeError?.message || 'OAuth callback failed.'));
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=oauth_failed`);
  }
});

router.post(
  '/:service/manual',
  requireOrg,
  requireRole('owner', 'admin'),
  integrationWriteRateLimit,
  zValidator('json', manualConnectionSchema),
  async (context) => {
    const org = context.get('org');
    const { service } = context.req.param();
    const integration = getIntegrationDefinition(service);
    const payload = context.req.valid('json');

    if (!integration) {
      return context.json({ error: 'Unknown integration.' }, 400);
    }

    if (integration.authMode !== 'manual_token') {
      return context.json({ error: `${integration.name} must be connected through OAuth.` }, 400);
    }

    const existing = await db.query.integrations.findFirst({
      where: and(eq(integrations.orgId, org.orgId), eq(integrations.service, service)),
    });

    if (service !== 'custom_webhook' && !payload.accessToken && !existing) {
      return context.json({ error: `${integration.secretLabel ?? 'Access token'} is required.` }, 400);
    }

    const settings = sanitizeIntegrationSettings(service, {
      ...(existing?.meta?.settings ?? {}),
      ...(payload.settings ?? {}),
    });
    const settingsError = validateIntegrationSettings(service, settings);
    if (settingsError) {
      return context.json({ error: settingsError }, 400);
    }

    const missingSettings = getMissingRequiredSettings(integration, settings);
    if (missingSettings.length > 0) {
      return context.json({ error: `Missing required settings: ${missingSettings.join(', ')}.` }, 400);
    }

    let testResult = null;
    const resolvedAccessToken = payload.accessToken || (existing?.accessToken ? await decrypt(existing.accessToken) : '');

    if (payload.verifyOnSave) {
      try {
        testResult = await testIntegrationConnection({
          service,
          accessToken: resolvedAccessToken,
          settings,
        });
      } catch (error) {
        return context.json({
          error: sanitizeErrorForClient(error, {
            fallback: 'Connection test failed.',
            internalFallback: 'Connection test failed.',
          }),
        }, 400);
      }
    }

    const accountId = payload.accountId ?? testResult?.accountId ?? existing?.accountId ?? null;
    const accountEmail = payload.accountEmail ?? testResult?.accountEmail ?? existing?.accountEmail ?? null;
    const nextMeta = {
      ...(existing?.meta ?? {}),
      authMode: integration.authMode,
      settings,
      profile: testResult?.profile ?? existing?.meta?.profile ?? null,
      health: payload.verifyOnSave
        ? {
            status: 'healthy',
            checkedAt: new Date().toISOString(),
            message: testResult?.message ?? 'Connection verified.',
          }
        : existing?.meta?.health ?? null,
    };

    const [connection] = await db
      .insert(integrations)
      .values({
        orgId: org.orgId,
        service,
        accessToken: await encrypt(resolvedAccessToken),
        refreshToken: payload.refreshToken ? await encrypt(payload.refreshToken) : null,
        tokenExpiresAt: null,
        scopes: payload.scopes?.length ? payload.scopes : integration.scopes ?? [],
        accountId,
        accountEmail,
        meta: nextMeta,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrations.orgId, integrations.service],
        set: {
          accessToken: await encrypt(resolvedAccessToken),
          refreshToken: payload.refreshToken ? await encrypt(payload.refreshToken) : null,
          scopes: payload.scopes?.length ? payload.scopes : integration.scopes ?? [],
          accountId,
          accountEmail,
          meta: nextMeta,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    await Promise.all([
      recordAuditLog({
        orgId: org.orgId,
        actorUserId: org.userId,
        action: 'integration.connected',
        targetType: 'integration',
        targetId: service,
        metadata: {
          authMode: integration.authMode,
          accountId,
          accountEmail,
          verified: Boolean(testResult),
        },
      }),
      recordProductEvent({
        orgId: org.orgId,
        userId: org.userId,
        eventName: 'integration.connected',
        metadata: {
          service,
          authMode: integration.authMode,
          verified: Boolean(testResult),
        },
      }),
    ]);

    return context.json(
      {
        connection: serializeIntegrationConnection(connection),
        verified: Boolean(testResult),
        test: testResult,
      },
      existing ? 200 : 201,
    );
  },
);

router.patch(
  '/:service/settings',
  requireOrg,
  requireRole('owner', 'admin'),
  integrationWriteRateLimit,
  zValidator('json', integrationSettingsSchema),
  async (context) => {
    const org = context.get('org');
    const { service } = context.req.param();
    const integration = getIntegrationDefinition(service);
    const payload = context.req.valid('json');

    if (!integration) {
      return context.json({ error: 'Unknown integration.' }, 400);
    }

    const connection = await db.query.integrations.findFirst({
      where: and(eq(integrations.orgId, org.orgId), eq(integrations.service, service), eq(integrations.isActive, true)),
    });

    if (!connection) {
      return context.json({ error: `${integration.name} is not connected.` }, 404);
    }
    if (requiresLinkedInReconnect(service, connection)) {
      return context.json({ error: LINKEDIN_RECONNECT_MESSAGE }, 400);
    }

    const settings = sanitizeIntegrationSettings(service, {
      ...(connection.meta?.settings ?? {}),
      ...(payload.settings ?? {}),
    });
    const settingsError = validateIntegrationSettings(service, settings);
    if (settingsError) {
      return context.json({ error: settingsError }, 400);
    }

    const missingSettings = getMissingRequiredSettings(integration, settings);
    if (missingSettings.length > 0) {
      return context.json({ error: `Missing required settings: ${missingSettings.join(', ')}.` }, 400);
    }

    const nextMeta = {
      ...(connection.meta ?? {}),
      authMode: integration.authMode,
      settings,
    };

    const [updated] = await db
      .update(integrations)
      .set({
        meta: nextMeta,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, connection.id))
      .returning();

    await recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'integration.settings_updated',
      targetType: 'integration',
      targetId: service,
      metadata: { settings },
    });

    return context.json({ connection: serializeIntegrationConnection(updated) });
  },
);

router.post('/:service/test', requireOrg, requireRole('owner', 'admin'), integrationWriteRateLimit, async (context) => {
  const org = context.get('org');
  const { service } = context.req.param();
  const integration = getIntegrationDefinition(service);

  if (!integration) {
    return context.json({ error: 'Unknown integration.' }, 400);
  }

  const connection = await db.query.integrations.findFirst({
    where: and(eq(integrations.orgId, org.orgId), eq(integrations.service, service), eq(integrations.isActive, true)),
  });

  if (!connection) {
    return context.json({ error: `${integration.name} is not connected.` }, 404);
  }
  if (requiresLinkedInReconnect(service, connection)) {
    return context.json({ error: LINKEDIN_RECONNECT_MESSAGE }, 400);
  }

  const accessToken = await getAccessToken(org.orgId, service);
  let testResult;

  try {
    testResult = await testIntegrationConnection({
      service,
      accessToken,
      settings: sanitizeIntegrationSettings(service, connection.meta?.settings ?? {}),
      connection,
    });
  } catch (error) {
    const failedMeta = {
      ...(connection.meta ?? {}),
      health: {
        status: 'degraded',
        checkedAt: new Date().toISOString(),
        message: sanitizeErrorForClient(error, {
          fallback: 'Connection test failed.',
          internalFallback: 'Connection test failed.',
        }),
      },
    };

    await db
      .update(integrations)
      .set({
        meta: failedMeta,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, connection.id));

    return context.json({
      error: sanitizeErrorForClient(error, {
        fallback: 'Connection test failed.',
        internalFallback: 'Connection test failed.',
      }),
    }, 400);
  }

  const nextMeta = {
    ...(connection.meta ?? {}),
    profile: testResult.profile ?? connection.meta?.profile ?? null,
    health: {
      status: 'healthy',
      checkedAt: new Date().toISOString(),
      message: testResult.message ?? 'Connection verified.',
    },
  };

  const [updated] = await db
    .update(integrations)
    .set({
      meta: nextMeta,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, connection.id))
    .returning();

  return context.json({
    connection: serializeIntegrationConnection(updated),
    test: testResult,
  });
});

router.post(
  '/:service/publish',
  requireOrg,
  requireRole('owner', 'admin'),
  integrationWriteRateLimit,
  zValidator('json', publishPayloadSchema),
  async (context) => {
    const org = context.get('org');
    const { service } = context.req.param();
    const integration = getIntegrationDefinition(service);
    const payload = context.req.valid('json');

    if (!integration) {
      return context.json({ error: 'Unknown integration.' }, 400);
    }

    if (!integration.supportsPublish) {
      return context.json({ error: `${integration.name} does not support outbound publishing in Prymal yet.` }, 400);
    }

    const connection = await db.query.integrations.findFirst({
      where: and(eq(integrations.orgId, org.orgId), eq(integrations.service, service), eq(integrations.isActive, true)),
    });

    if (!connection) {
      return context.json({ error: `${integration.name} is not connected.` }, 404);
    }
    if (requiresLinkedInReconnect(service, connection)) {
      return context.json({ error: LINKEDIN_RECONNECT_MESSAGE }, 400);
    }

    const accessToken = await getAccessToken(org.orgId, service);
    const settings = sanitizeIntegrationSettings(service, connection.meta?.settings ?? {});

    let delivery;
    try {
      delivery = await publishIntegrationPayload({
        service,
        accessToken,
        payload,
        settings,
        connection,
      });
    } catch (error) {
      await recordDeliveryOutcome({
        orgId: org.orgId,
        userId: org.userId,
        contentId: payload.contentId ?? null,
        messageId: payload.messageId ?? null,
        sourceAgent: 'echo',
        contentType: 'social_post',
        delivered: false,
        metadata: {
          service,
          targetId: payload.targetId ?? null,
          error: sanitizeErrorForClient(error, {
            fallback: 'Publish failed.',
            internalFallback: 'Publish failed.',
          }),
        },
      });
      return context.json({
        error: sanitizeErrorForClient(error, {
          fallback: 'Publish failed.',
          internalFallback: 'Publish failed.',
        }),
      }, 400);
    }

    const nextMeta = buildDeliveryMeta(service, connection.meta ?? {}, delivery);
    nextMeta.health = {
      status: 'healthy',
      checkedAt: new Date().toISOString(),
      message: 'Last outbound publish succeeded.',
    };

    const [updated] = await db
      .update(integrations)
      .set({
        meta: nextMeta,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, connection.id))
      .returning();

    await recordDeliveryOutcome({
      orgId: org.orgId,
      userId: org.userId,
      contentId: payload.contentId ?? null,
      messageId: payload.messageId ?? null,
      sourceAgent: 'echo',
      contentType: 'social_post',
      delivered: true,
      metadata: {
        service,
        target: delivery.target ?? null,
        providerMessageId: delivery.providerMessageId ?? null,
        deliveredAt: delivery.publishedAt ?? new Date().toISOString(),
      },
    });

    await Promise.all([
      recordAuditLog({
        orgId: org.orgId,
        actorUserId: org.userId,
        action: 'integration.published',
        targetType: 'integration',
        targetId: service,
        metadata: {
          target: delivery.target ?? null,
          providerMessageId: delivery.providerMessageId ?? null,
        },
      }),
      recordProductEvent({
        orgId: org.orgId,
        userId: org.userId,
        eventName: 'integration.published',
        metadata: {
          service,
          target: delivery.target ?? null,
        },
      }),
    ]);

    return context.json({
      connection: serializeIntegrationConnection(updated),
      delivery,
    });
  },
);

router.delete('/:service', requireOrg, requireRole('owner', 'admin'), integrationWriteRateLimit, async (context) => {
  const org = context.get('org');
  const { service } = context.req.param();

  await db
    .update(integrations)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(integrations.orgId, org.orgId), eq(integrations.service, service)));

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'integration.disconnected',
      targetType: 'integration',
      targetId: service,
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'integration.disconnected',
      metadata: { service },
    }),
  ]);

  return context.json({ success: true });
});

export async function getAccessToken(orgId, service) {
  const connection = await db.query.integrations.findFirst({
    where: and(eq(integrations.orgId, orgId), eq(integrations.service, service), eq(integrations.isActive, true)),
  });

  if (!connection) {
    throw new Error(`${service} is not connected.`);
  }

  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date() && connection.refreshToken) {
    return refreshAccessToken(connection);
  }

  return decrypt(connection.accessToken);
}

export function serializeIntegrationConnection(entry) {
  const integration = getIntegrationDefinition(entry.service);
  const safeMeta = sanitizeIntegrationMeta(entry.service, entry.meta ?? {});
  const linkedInPostingNotReady =
    entry.service === 'linkedin'
    && !safeMeta.needsReconnect
    && !hasAnyLinkedInPostingScope(entry.scopes ?? []);

  return {
    id: entry.id,
    service: entry.service,
    name: integration?.name ?? entry.service,
    section: integration?.section ?? 'custom',
    category: integration?.category ?? 'Other',
    color: integration?.color ?? '#98A2B3',
    icon: integration?.icon ?? 'IO',
    description: integration?.description ?? '',
    authMode: integration?.authMode ?? 'oauth',
    capabilities: integration?.capabilities ?? [],
    supportsPublish: Boolean(integration?.supportsPublish),
    publishDisabled: Boolean(safeMeta.needsReconnect || linkedInPostingNotReady),
    postingNotReady: linkedInPostingNotReady,
    supportsImagePublish: Boolean(integration?.supportsImagePublish),
    targetLabel: integration?.targetLabel ?? null,
    accountId: entry.accountId ?? null,
    accountEmail: entry.accountEmail ?? null,
    scopes: entry.scopes ?? [],
    meta: safeMeta,
    createdAt: entry.createdAt ?? null,
    updatedAt: entry.updatedAt ?? null,
  };
}

function getMissingRequiredSettings(integration, settings) {
  return (integration?.settingsFields ?? [])
    .filter((field) => field.requiredOnConnect && !settings?.[field.key])
    .map((field) => field.label);
}

export function validateIntegrationSettings(service, settings = {}) {
  if (service !== 'linkedin') {
    return null;
  }

  if (settings.authorUrn && !LINKEDIN_AUTHOR_URN_PATTERN.test(settings.authorUrn)) {
    return 'Enter a valid LinkedIn author URN such as urn:li:organization:123456 or choose an available author.';
  }

  if (settings.selectedOrganizationUrn && !LINKEDIN_ORGANIZATION_URN_PATTERN.test(settings.selectedOrganizationUrn)) {
    return 'Enter a valid LinkedIn organisation URN such as urn:li:organization:123456.';
  }

  return null;
}

function requiresLinkedInReconnect(service, connection) {
  return service === 'linkedin' && connection?.meta?.authMode === 'manual_token';
}

function hasLinkedInScope(scopes, requiredScope) {
  return Array.isArray(scopes) && scopes.includes(requiredScope);
}

function hasAnyLinkedInPostingScope(scopes) {
  return hasLinkedInScope(scopes, 'w_member_social') || hasLinkedInScope(scopes, 'w_organization_social');
}

function createClientSafeError(message, status = 400, code = 'integration_error') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function mapLinkedInProviderError(response, payload = {}, options = {}) {
  const providerMessage = String(payload?.message ?? payload?.error_description ?? payload?.error ?? '').toLowerCase();
  const status = response?.status ?? 400;

  if (status === 401 || /invalid[_ ]token|expired|unauthorized/.test(providerMessage)) {
    return createClientSafeError(
      'LinkedIn connection expired or invalid. Reconnect LinkedIn.',
      401,
      'linkedin_token_invalid',
    );
  }

  if (status === 403 || /scope|permission|not enough permissions|access denied|forbidden/.test(providerMessage)) {
    if (options.author?.startsWith('urn:li:organization:')) {
      return createClientSafeError(
        'The connected LinkedIn member does not appear to have permission to post as this organisation.',
        403,
        'linkedin_organization_denied',
      );
    }
    return createClientSafeError(
      LINKEDIN_POSTING_NOT_READY_MESSAGE,
      403,
      'linkedin_scope_missing',
    );
  }

  if (status === 400 && /author|urn|organization|person/.test(providerMessage)) {
    return createClientSafeError(
      'Enter a valid LinkedIn author URN such as urn:li:organization:123456 or choose an available author.',
      400,
      'linkedin_invalid_author',
    );
  }

  return createClientSafeError(options.fallback ?? 'LinkedIn publish failed.', status, 'linkedin_provider_error');
}

export async function testIntegrationConnection({ service, accessToken, settings = {}, connection = null }) {
  const definition = getIntegrationDefinition(service);
  const runtimeTest = await dispatchRuntimeTest(service, definition, {
    service,
    accessToken,
    settings,
    connection,
  });
  if (runtimeTest) {
    return runtimeTest;
  }

  if (service === 'gmail' || service === 'google_drive') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(profile?.error?.message || 'Google account lookup failed.');
    }

    return {
      message: `Connected as ${profile.email ?? profile.name ?? 'Google account'}.`,
      accountId: profile.id ?? null,
      accountEmail: profile.email ?? null,
      profile: {
        name: profile.name ?? null,
        handle: profile.email ?? null,
        avatarUrl: profile.picture ?? null,
      },
    };
  }

  if (service === 'outlook') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Microsoft account lookup failed.');
    }

    const email = payload.mail ?? payload.userPrincipalName ?? null;

    return {
      message: `Connected as ${email ?? payload.displayName ?? 'Microsoft account'}.`,
      accountId: payload.id ?? connection?.accountId ?? null,
      accountEmail: email,
      profile: {
        name: payload.displayName ?? email ?? null,
        handle: email,
      },
    };
  }

  if (service === 'onedrive') {
    const [profileResponse, driveResponse] = await Promise.all([
      fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      fetch('https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,webUrl,name', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    ]);

    const profilePayload = await readProviderJson(profileResponse);
    const drivePayload = await readProviderJson(driveResponse);

    if (!profileResponse.ok) {
      throw new Error(profilePayload?.error?.message || 'Microsoft account lookup failed.');
    }

    if (!driveResponse.ok) {
      throw new Error(drivePayload?.error?.message || 'OneDrive lookup failed.');
    }

    const email = profilePayload.mail ?? profilePayload.userPrincipalName ?? null;

    return {
      message: `Connected to OneDrive for ${email ?? profilePayload.displayName ?? 'Microsoft account'}.`,
      accountId: drivePayload.id ?? profilePayload.id ?? connection?.accountId ?? null,
      accountEmail: email,
      profile: {
        name: profilePayload.displayName ?? email ?? null,
        handle: email,
        workspace: drivePayload.name ?? drivePayload.driveType ?? 'OneDrive',
      },
    };
  }

  if (service === 'dropbox') {
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.error_summary || payload?.error || 'Dropbox account lookup failed.');
    }

    return {
      message: `Connected as ${payload.email ?? payload.name?.display_name ?? 'Dropbox user'}.`,
      accountId: payload.account_id ?? connection?.accountId ?? null,
      accountEmail: payload.email ?? null,
      profile: {
        name: payload.name?.display_name ?? null,
        handle: payload.email ?? null,
      },
    };
  }

  if (service === 'box') {
    const response = await fetch('https://api.box.com/2.0/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.message || 'Box account lookup failed.');
    }

    return {
      message: `Connected as ${payload.login ?? payload.name ?? 'Box user'}.`,
      accountId: payload.id ?? connection?.accountId ?? null,
      accountEmail: payload.login ?? null,
      profile: {
        name: payload.name ?? null,
        handle: payload.login ?? null,
        avatarUrl: payload.avatar_url ?? null,
        workspace: payload.enterprise?.name ?? null,
      },
    };
  }

  if (service === 'slack') {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const payload = await readProviderJson(response);

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || 'Slack auth test failed.');
    }

    return {
      message: `Connected to Slack workspace ${payload.team ?? 'workspace'}.`,
      accountId: payload.team_id ?? payload.user_id ?? connection?.accountId ?? null,
      accountEmail: connection?.accountEmail ?? null,
      profile: {
        name: payload.user ?? null,
        handle: payload.user ?? null,
        workspace: payload.team ?? null,
      },
    };
  }

  if (service === 'notion') {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.message || 'Notion user lookup failed.');
    }

    const email = payload?.person?.email ?? connection?.accountEmail ?? null;
    const name = [payload?.name ?? null].filter(Boolean).join(' ') || 'Notion workspace';

    return {
      message: `Connected to Notion as ${email ?? name}.`,
      accountId: payload?.id ?? connection?.accountId ?? null,
      accountEmail: email,
      profile: {
        name,
        handle: email,
      },
    };
  }

  if (service === 'discord') {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${accessToken}`,
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.message || 'Discord bot lookup failed.');
    }

    return {
      message: `Connected as Discord bot ${payload.username ?? 'bot'}.`,
      accountId: payload.id ?? null,
      accountEmail: null,
      profile: {
        name: payload.global_name ?? payload.username ?? null,
        handle: payload.username ?? null,
        avatarUrl: payload.avatar
          ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png`
          : null,
      },
    };
  }

  if (service === 'telegram') {
    const response = await fetch(`https://api.telegram.org/bot${accessToken}/getMe`);
    const payload = await readProviderJson(response);

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.description || 'Telegram bot lookup failed.');
    }

    return {
      message: `Connected as Telegram bot ${payload.result?.username ?? payload.result?.first_name ?? 'bot'}.`,
      accountId: payload.result?.id ? String(payload.result.id) : null,
      accountEmail: null,
      profile: {
        name: payload.result?.first_name ?? payload.result?.username ?? null,
        handle: payload.result?.username ? `@${payload.result.username}` : null,
      },
    };
  }

  if (service === 'x') {
    const response = await fetch('https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.detail || payload?.title || 'X profile lookup failed.');
    }

    return {
      message: `Connected as @${payload.data?.username ?? 'user'}.`,
      accountId: payload.data?.id ?? null,
      accountEmail: null,
      profile: {
        name: payload.data?.name ?? null,
        handle: payload.data?.username ? `@${payload.data.username}` : null,
        avatarUrl: payload.data?.profile_image_url ?? null,
      },
    };
  }

  if (service === 'mastodon') {
    if (!settings.instanceUrl) {
      throw new Error('Mastodon testing requires an instance URL.');
    }

    const instanceUrl = normalizeBaseUrl(settings.instanceUrl);
    const response = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(payload?.error || 'Mastodon profile lookup failed.');
    }

    const handle = payload.acct ? `@${payload.acct}` : null;

    return {
      message: `Connected as ${handle ?? payload.display_name ?? 'Mastodon account'}.`,
      accountId: payload.id ?? connection?.accountId ?? null,
      accountEmail: null,
      profile: {
        name: payload.display_name ?? payload.username ?? null,
        handle,
        avatarUrl: payload.avatar_static ?? payload.avatar ?? null,
        workspace: new URL(instanceUrl).host,
      },
    };
  }

  if (service === 'linkedin') {
    if (settings.authorUrn && !LINKEDIN_AUTHOR_URN_PATTERN.test(settings.authorUrn)) {
      throw createClientSafeError(
        'Enter a valid LinkedIn author URN such as urn:li:organization:123456 or choose an available author.',
        400,
        'linkedin_invalid_author',
      );
    }

    const identity = await fetchLinkedInIdentity(accessToken);
    const availableAuthors = identity.profile?.availableAuthors ?? [];
    const selectedAuthor = settings.authorUrn ?? availableAuthors[0]?.urn ?? null;

    if (
      selectedAuthor?.startsWith('urn:li:organization:')
      && availableAuthors.some((author) => author.type === 'organization')
      && !availableAuthors.some((author) => author.urn === selectedAuthor)
    ) {
      throw createClientSafeError(
        'The connected LinkedIn member does not appear to have permission to post as this organisation.',
        403,
        'linkedin_organization_denied',
      );
    }

    return {
      ...identity,
      message: selectedAuthor
        ? `Connected as ${identity.profile?.name ?? identity.accountEmail ?? 'LinkedIn member'}; author set to ${selectedAuthor}.`
        : `Connected as ${identity.profile?.name ?? identity.accountEmail ?? 'LinkedIn member'}. Choose an author before publishing.`,
    };
  }

  if (service === 'custom_webhook') {
    if (!settings.endpointUrl) {
      throw new Error('Custom webhook testing requires an endpoint URL.');
    }

    return {
      message: 'Webhook configuration saved. Prymal does not probe custom endpoints automatically.',
      accountId: settings.endpointUrl,
      accountEmail: null,
      profile: {
        name: settings.endpointUrl,
        handle: settings.endpointUrl,
      },
    };
  }

  return {
    message: 'Connection saved.',
    accountId: connection?.accountId ?? null,
    accountEmail: connection?.accountEmail ?? null,
    profile: connection?.meta?.profile ?? null,
  };
}

async function fetchLinkedInIdentity(accessToken) {
  const response = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profilePayload = await readProviderJson(response);

  if (!response.ok) {
    throw mapLinkedInProviderError(response, profilePayload, {
      fallback: 'LinkedIn connection expired or invalid. Reconnect LinkedIn.',
      identityLookup: true,
    });
  }

  const name =
    profilePayload.name
    ?? [profilePayload.given_name, profilePayload.family_name].filter(Boolean).join(' ')
    ?? null;
  const memberUrn = profilePayload.sub ? `urn:li:person:${profilePayload.sub}` : null;
  const organizations = await fetchLinkedInOrganizations(accessToken);
  const availableAuthors = [
    memberUrn
      ? {
          urn: memberUrn,
          name: name ?? 'Personal profile',
          type: 'person',
          role: 'member',
        }
      : null,
    ...organizations.map((organization) => ({
      urn: organization.urn,
      name: organization.name,
      type: 'organization',
      role: organization.role,
    })),
  ].filter(Boolean);

  return {
    accountId: profilePayload.sub ?? memberUrn ?? null,
    accountEmail: profilePayload.email ?? null,
    profile: {
      name,
      handle: profilePayload.email ?? memberUrn ?? null,
      avatarUrl: profilePayload.picture ?? null,
      availableAuthors,
      organizations,
    },
  };
}

async function fetchLinkedInOrganizations(accessToken) {
  const version = process.env.LINKEDIN_API_VERSION?.trim() || LINKEDIN_VERSION;
  const response = await fetch(
    'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&state=APPROVED&count=100&projection=(elements*(*,organization~(localizedName)))',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Linkedin-Version': version,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
    },
  );
  const payload = await readProviderJson(response);

  if (!response.ok) {
    return [];
  }

  return (Array.isArray(payload.elements) ? payload.elements : [])
    .map((entry) => ({
      urn: entry.organization ?? null,
      name: entry['organization~']?.localizedName ?? entry.organization ?? null,
      role: entry.role ?? null,
    }))
    .filter((entry) => entry.urn && LINKEDIN_ORGANIZATION_URN_PATTERN.test(entry.urn));
}

export async function publishIntegrationPayload({ service, accessToken, payload, settings = {}, connection = null }) {
  const definition = getIntegrationDefinition(service);
  const runtimePublish = await dispatchRuntimePublish(service, definition, {
    accessToken,
    payload,
    settings,
    connection,
  });
  if (runtimePublish) {
    return runtimePublish;
  }

  const publishedAt = new Date().toISOString();

  if (service === 'outlook') {
    const target = payload.targetId ?? settings.defaultRecipientEmail;
    if (!target) {
      throw new Error('Outlook sending requires at least one recipient email address.');
    }

    const recipients = parseTargetList(target);
    if (recipients.length === 0) {
      throw new Error('Outlook sending requires valid recipient email addresses.');
    }

    const subject = (payload.title ?? truncatePlainText(payload.text, 80) ?? 'Prymal message').trim();
    const bodyContent = buildEmailBody(payload);
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'Text',
            content: bodyContent,
          },
          toRecipients: recipients.map((address) => ({
            emailAddress: { address },
          })),
        },
        saveToSentItems: true,
      }),
    });
    const body = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(body?.error?.message || 'Outlook send failed.');
    }

    return {
      status: 'sent',
      publishedAt,
      target: recipients.join(', '),
      providerMessageId: response.headers.get('request-id') ?? response.headers.get('client-request-id') ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (service === 'slack') {
    const target = payload.targetId ?? settings.defaultChannelId;
    if (!target) {
      throw new Error('Slack publishing requires a target channel ID.');
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: target,
        text: buildPublishText(payload),
        unfurl_links: true,
        unfurl_media: true,
      }),
    });
    const body = await readProviderJson(response);

    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || 'Slack publish failed.');
    }

    return {
      status: 'sent',
      publishedAt,
      target,
      providerMessageId: body.ts ?? null,
      preview: payload.text.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (service === 'discord') {
    const target = payload.targetId ?? settings.defaultChannelId;
    if (!target) {
      throw new Error('Discord publishing requires a target channel ID.');
    }

    const content = buildPublishText(payload, { maxLength: 2000 });
    const response = await fetch(`https://discord.com/api/v10/channels/${target}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
      }),
    });
    const body = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(body?.message || 'Discord publish failed.');
    }

    return {
      status: 'sent',
      publishedAt,
      target,
      providerMessageId: body.id ?? null,
      preview: content.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (service === 'telegram') {
    const target = payload.targetId ?? settings.defaultChatId;
    if (!target) {
      throw new Error('Telegram publishing requires a target chat ID or channel username.');
    }

    const endpoint = payload.imageUrl ? 'sendPhoto' : 'sendMessage';
    const text = payload.imageUrl
      ? buildPublishText(payload, { maxLength: 1024 })
      : buildPublishText(payload, { maxLength: 4096 });
    const body = new URLSearchParams(
      payload.imageUrl
        ? {
            chat_id: target,
            photo: payload.imageUrl,
            caption: text,
          }
        : {
            chat_id: target,
            text,
            disable_web_page_preview: 'false',
          },
    );

    const response = await fetch(`https://api.telegram.org/bot${accessToken}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const result = await readProviderJson(response);

    if (!response.ok || result?.ok === false) {
      throw new Error(result?.description || 'Telegram publish failed.');
    }

    return {
      status: 'sent',
      publishedAt,
      target,
      providerMessageId: result.result?.message_id ? String(result.result.message_id) : null,
      preview: text.slice(0, 160),
      linkUrl: payload.linkUrl ?? payload.imageUrl ?? null,
    };
  }

  if (service === 'x') {
    const text = buildPublishText(payload, { maxLength: 280 });
    const requestBody = { text };

    if (payload.metadata?.replySettings && payload.metadata.replySettings !== 'everyone') {
      requestBody.reply_settings = payload.metadata.replySettings;
    }

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const body = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(body?.detail || body?.title || 'X publish failed.');
    }

    return {
      status: 'sent',
      publishedAt,
      target: '@self',
      providerMessageId: body.data?.id ?? null,
      preview: text,
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (service === 'mastodon') {
    if (!settings.instanceUrl) {
      throw new Error('Mastodon publishing requires an instance URL.');
    }

    const instanceUrl = normalizeBaseUrl(settings.instanceUrl);
    const text = buildPublishText(payload);
    const response = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        status: text,
        visibility: settings.defaultVisibility ?? 'public',
      }),
    });
    const body = await readProviderJson(response);

    if (!response.ok) {
      throw new Error(body?.error || 'Mastodon publish failed.');
    }

    return {
      status: 'sent',
      publishedAt,
      target: new URL(instanceUrl).host,
      providerMessageId: body.id ?? null,
      preview: text.slice(0, 160),
      linkUrl: body.url ?? payload.linkUrl ?? null,
    };
  }

  if (service === 'linkedin') {
    const author = payload.targetId ?? settings.authorUrn;
    if (!author) {
      throw new Error('LinkedIn publishing requires an author URN.');
    }
    if (!LINKEDIN_AUTHOR_URN_PATTERN.test(author)) {
      throw createClientSafeError(
        'Enter a valid LinkedIn author URN such as urn:li:organization:123456 or choose an available author.',
        400,
        'linkedin_invalid_author',
      );
    }
    if (payload.imageUrl) {
      throw createClientSafeError(
        'LinkedIn image publishing is not enabled yet. Publish text or a link only.',
        400,
        'linkedin_images_disabled',
      );
    }

    const requiredScope = author.startsWith('urn:li:organization:') ? 'w_organization_social' : 'w_member_social';
    if (!hasLinkedInScope(connection?.scopes, requiredScope)) {
      throw createClientSafeError(
        LINKEDIN_POSTING_NOT_READY_MESSAGE,
        403,
        'linkedin_scope_missing',
      );
    }

    const commentary = [payload.title, payload.text]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join('\n\n');
    if (commentary.length > 3000) {
      throw new Error('This post is too long for LinkedIn. Keep it under 3000 characters.');
    }
    const linkedInVersion = process.env.LINKEDIN_API_VERSION?.trim() || LINKEDIN_VERSION;
    const body = {
      author,
      commentary,
      visibility: settings.defaultVisibility ?? 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    if (payload.linkUrl) {
      body.content = {
        article: {
          source: payload.linkUrl,
          title: payload.title ?? payload.text.slice(0, 120),
          description: payload.text.slice(0, 240),
        },
      };
    }

    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'Linkedin-Version': linkedInVersion,
      },
      body: JSON.stringify(body),
    });
    const result = await readProviderJson(response);

    if (!response.ok) {
      throw mapLinkedInProviderError(response, result, { author, fallback: 'LinkedIn publish failed.' });
    }

    return {
      status: 'sent',
      publishedAt,
      target: author,
      providerMessageId: response.headers.get('x-restli-id') ?? result?.id ?? null,
      preview: commentary.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (service === 'custom_webhook') {
    const target = payload.targetId ?? settings.endpointUrl;
    if (!target) {
      throw new Error('Custom webhook publishing requires an endpoint URL.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Prymal-Integrations/1.0',
    };
    const authHeaderName = settings.authHeaderName ?? 'Authorization';
    const authScheme = settings.authScheme ?? 'Bearer';

    if (accessToken) {
      headers[authHeaderName] = authScheme === 'Raw' ? accessToken : `${authScheme} ${accessToken}`;
    }

    const response = await fetch(target, {
      method: settings.method ?? 'POST',
      headers,
      body: JSON.stringify({
        source: 'prymal',
        service,
        publishedAt,
        payload: {
          title: payload.title ?? null,
          text: payload.text,
          linkUrl: payload.linkUrl ?? null,
          imageUrl: payload.imageUrl ?? null,
        },
      }),
    });

    const body = await readProviderJson(response);
    if (!response.ok) {
      throw new Error(body?.message || body?.error || `Webhook publish failed with status ${response.status}.`);
    }

    return {
      status: 'sent',
      publishedAt,
      target,
      providerMessageId: body?.id ?? response.headers.get('x-request-id') ?? null,
      preview: payload.text.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  throw new Error(`${service} publishing is not implemented.`);
}

async function exchangeCodeForTokens(service, code) {
  const config = getIntegrationDefinition(service);
  const redirectUri = `${process.env.API_URL}/api/integrations/${service}/callback`;

  if (service === 'notion') {
    const auth = Buffer.from(`${config.clientId()}:${config.clientSecret()}`).toString('base64');
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || 'Notion token exchange failed.');
    }

    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresIn: null,
      scopes: [],
      raw: data,
    };
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId(),
      client_secret: config.clientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();

  if (!response.ok || data.error === 'invalid_grant' || data.ok === false || data.error) {
    throw new Error(data.error_description || data.error || 'Token exchange failed.');
  }

  return {
    accessToken: data.access_token ?? data.authed_user?.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    scopes: parseScopes(data.scope),
    raw: data,
  };
}

async function fetchAccountIdentity(service, tokenData) {
  if (service === 'gmail' || service === 'google_drive') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` },
    });
    const profile = await response.json();

    return {
      accountId: profile.id ?? null,
      accountEmail: profile.email ?? null,
      meta: {
        profile: {
          name: profile.name ?? null,
          handle: profile.email ?? null,
          avatarUrl: profile.picture ?? null,
        },
      },
    };
  }

  if (service === 'slack') {
    return {
      accountId: tokenData.raw.team?.id ?? tokenData.raw.authed_user?.id ?? null,
      accountEmail: null,
      meta: {
        profile: {
          name: tokenData.raw.authed_user?.id ?? tokenData.raw.team?.name ?? null,
          workspace: tokenData.raw.team?.name ?? null,
        },
      },
    };
  }

  if (service === 'outlook' || service === 'onedrive') {
    const testResult = await testIntegrationConnection({
      service,
      accessToken: tokenData.accessToken,
    });
    return {
      accountId: testResult.accountId ?? null,
      accountEmail: testResult.accountEmail ?? null,
      meta: { profile: testResult.profile ?? null },
    };
  }

  if (service === 'notion') {
    return {
      accountId: tokenData.raw.workspace_id ?? null,
      accountEmail: tokenData.raw.owner?.user?.person?.email ?? null,
      meta: {
        profile: {
          name: tokenData.raw.workspace_name ?? null,
          handle: tokenData.raw.owner?.user?.person?.email ?? null,
          workspace: tokenData.raw.workspace_name ?? null,
        },
      },
    };
  }

  if (service === 'linkedin') {
    const identity = await fetchLinkedInIdentity(tokenData.accessToken);
    const defaultAuthor = identity.profile?.availableAuthors?.[0]?.urn ?? null;
    return {
      accountId: identity.accountId ?? null,
      accountEmail: identity.accountEmail ?? null,
      meta: {
        profile: identity.profile ?? null,
        settings: defaultAuthor
          ? { authorUrn: defaultAuthor, defaultVisibility: 'PUBLIC' }
          : { defaultVisibility: 'PUBLIC' },
      },
    };
  }

  return {
    accountId: null,
    accountEmail: null,
    meta: {},
  };
}

async function refreshAccessToken(connection) {
  const config = getIntegrationDefinition(connection.service);

  if (!config?.supportsRefresh || !connection.refreshToken) {
    return decrypt(connection.accessToken);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: await decrypt(connection.refreshToken),
      client_id: config.clientId(),
      client_secret: config.clientSecret(),
    }),
  });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Token refresh failed.');
  }

  const encryptedAccessToken = await encrypt(data.access_token);
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

  await db
    .update(integrations)
    .set({
      accessToken: encryptedAccessToken,
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, connection.id));

  return data.access_token;
}

function normalizeBaseUrl(value) {
  return String(value).trim().replace(/\/+$/, '');
}

function truncatePlainText(value, maxLength) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  if (!maxLength || normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function parseTargetList(value) {
  return String(value ?? '')
    .split(/[;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildEmailBody(payload) {
  return [payload.text, payload.linkUrl, payload.imageUrl]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('\n\n');
}

function buildPublishText(payload, options = {}) {
  const segments = [payload.title, payload.text, payload.linkUrl, payload.imageUrl]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
  const separator = options.separator ?? '\n\n';
  const combined = segments.join(separator);

  if (options.maxLength && combined.length > options.maxLength) {
    throw new Error(`This post is too long for the selected integration. Keep it under ${options.maxLength} characters.`);
  }

  return combined;
}

async function readProviderJson(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

function parseScopes(scopeValue) {
  if (!scopeValue) {
    return [];
  }

  return scopeValue
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function resolveClientIp(context) {
  const forwardedFor = context.req.header('x-forwarded-for');
  return (
    context.req.header('cf-connecting-ip')
    ?? forwardedFor?.split(',')[0]?.trim()
    ?? context.req.header('x-real-ip')
    ?? 'unknown'
  );
}

export async function encodeState(value) {
  const payload = Buffer.from(
    JSON.stringify({
      ...value,
      issuedAt: Date.now(),
    }),
    'utf8',
  ).toString('base64url');
  const signature = await signState(payload);
  return `${payload}.${signature}`;
}

export async function decodeState(value) {
  const [payload, signature] = String(value ?? '').split('.');

  if (!payload || !signature) {
    throw new Error('Invalid state payload.');
  }

  const expectedSignature = await signState(payload);

  if (expectedSignature !== signature) {
    throw new Error('State signature mismatch.');
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  if (!decoded?.issuedAt || Date.now() - decoded.issuedAt > 15 * 60 * 1000) {
    throw new Error('State expired.');
  }

  return decoded;
}

async function signState(payload) {
  const secret = process.env.INTEGRATION_STATE_SECRET?.trim() || process.env.ENCRYPTION_KEY?.trim() || '';

  if (!secret) {
    throw new Error('Integration state secret is not configured.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

  return Buffer.from(signature).toString('base64url');
}

async function encrypt(plaintext) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]).toString('base64');
}

async function decrypt(ciphertext) {
  const key = await getEncryptionKey();
  const buffer = Buffer.from(ciphertext, 'base64');
  const iv = buffer.subarray(0, 12);
  const data = buffer.subarray(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plaintext);
}

async function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY ?? '';

  if (!/^[a-fA-F0-9]{64}$/.test(rawKey)) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string.');
  }

  return crypto.subtle.importKey('raw', Buffer.from(rawKey, 'hex'), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export default router;
