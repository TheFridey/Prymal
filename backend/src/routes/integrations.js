import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { integrations } from '../db/schema.js';
import { hasConfiguredEnvValue } from '../env.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';

const router = new Hono();

const INTEGRATIONS = {
  gmail: {
    name: 'Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.send'],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    supportsRefresh: true,
  },
  google_drive: {
    name: 'Google Drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    supportsRefresh: true,
  },
  notion: {
    name: 'Notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    clientId: () => process.env.NOTION_CLIENT_ID,
    clientSecret: () => process.env.NOTION_CLIENT_SECRET,
    supportsRefresh: false,
  },
  slack: {
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read'],
    clientId: () => process.env.SLACK_CLIENT_ID,
    clientSecret: () => process.env.SLACK_CLIENT_SECRET,
    supportsRefresh: false,
  },
};

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
    connected,
    available: Object.entries(INTEGRATIONS).map(([id, config]) => ({
      id,
      name: config.name,
      configured: hasConfiguredEnvValue(config.clientId()) && hasConfiguredEnvValue(config.clientSecret()),
    })),
  });
});

router.get('/:service/connect', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { service } = context.req.param();
  const integration = INTEGRATIONS[service];

  if (!integration) {
    return context.json({ error: 'Unknown integration.' }, 400);
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

router.get('/:service/callback', async (context) => {
  const { service } = context.req.param();
  const integration = INTEGRATIONS[service];
  const code = context.req.query('code');
  const error = context.req.query('error');
  const state = context.req.query('state');

  if (!integration) {
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=unknown_integration`);
  }

  if (error) {
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=${error}`);
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
        meta: account.meta ?? {},
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
          meta: account.meta ?? {},
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
    console.error('[INTEGRATIONS] OAuth callback failed:', exchangeError);
    return context.redirect(`${process.env.FRONTEND_URL}/app/integrations?error=oauth_failed`);
  }
});

router.delete('/:service', requireOrg, requireRole('owner', 'admin'), async (context) => {
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

async function exchangeCodeForTokens(service, code) {
  const config = INTEGRATIONS[service];
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
      meta: { name: profile.name ?? null },
    };
  }

  if (service === 'slack') {
    return {
      accountId: tokenData.raw.team?.id ?? tokenData.raw.authed_user?.id ?? null,
      accountEmail: null,
      meta: {
        teamName: tokenData.raw.team?.name ?? null,
      },
    };
  }

  if (service === 'notion') {
    return {
      accountId: tokenData.raw.workspace_id ?? null,
      accountEmail: tokenData.raw.owner?.user?.person?.email ?? null,
      meta: {
        workspaceName: tokenData.raw.workspace_name ?? null,
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
  const config = INTEGRATIONS[connection.service];

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

function parseScopes(scopeValue) {
  if (!scopeValue) {
    return [];
  }

  return scopeValue
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function encodeState(value) {
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

async function decodeState(value) {
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
