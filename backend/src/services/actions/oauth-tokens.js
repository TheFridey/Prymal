/**
 * Retrieves and optionally refreshes OAuth tokens from the integrations table.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { integrations } from '../../db/schema.js';

export async function getOAuthToken(orgId, service) {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.orgId, orgId),
      eq(integrations.service, service),
      eq(integrations.isActive, true),
    ),
  });

  if (!integration) {
    const error = new Error(`No active ${service} integration found for this organisation.`);
    error.code = 'OAUTH_TOKEN_NOT_FOUND';
    throw error;
  }

  const isExpired = integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) <= new Date();

  if (!isExpired) {
    return decryptStoredToken(integration.accessToken);
  }

  if (!integration.refreshToken) {
    const error = new Error(`${service} OAuth token has expired and no refresh token is available.`);
    error.code = 'oauth_token_expired';
    throw error;
  }

  // Attempt refresh via Google token endpoint (shared across Gmail and Drive)
  if (service === 'gmail' || service === 'google_drive') {
    const refreshed = await refreshGoogleToken(integration, service);
    return refreshed;
  }

  if (service === 'linkedin') {
    const refreshed = await refreshLinkedInToken(integration);
    return refreshed;
  }

  if (service === 'slack') {
    // Slack tokens do not expire by default; treat as expired if marked so
    const error = new Error('Slack OAuth token has expired. Please reconnect your Slack integration.');
    error.code = 'oauth_token_expired';
    throw error;
  }

  const error = new Error(`${service} OAuth token has expired.`);
  error.code = 'oauth_token_expired';
  throw error;
}

async function refreshLinkedInToken(integration) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const error = new Error('LinkedIn OAuth credentials not configured for token refresh.');
    error.code = 'oauth_token_expired';
    throw error;
  }

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: await decryptStoredToken(integration.refreshToken),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = new Error('Failed to refresh LinkedIn OAuth token. Please reconnect your LinkedIn integration.');
    error.code = 'oauth_token_expired';
    throw error;
  }

  const data = await response.json();
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  const refreshExpiresAt = data.refresh_token_expires_in
    ? new Date(Date.now() + data.refresh_token_expires_in * 1000)
    : null;

  const update = {
    accessToken: await encryptStoredToken(data.access_token),
    tokenExpiresAt: expiresAt,
    updatedAt: new Date(),
  };
  if (data.refresh_token) {
    update.refreshToken = await encryptStoredToken(data.refresh_token);
  }

  await db.update(integrations).set(update).where(eq(integrations.id, integration.id));

  if (refreshExpiresAt && refreshExpiresAt < new Date(Date.now() + 7 * 24 * 60 * 60_000)) {
    // Refresh token expiring within 7 days – caller should prompt reconnect
    const warning = new Error('LinkedIn refresh token is expiring soon. Please reconnect your integration.');
    warning.code = 'linkedin_refresh_expiring';
    warning.isWarning = true;
  }

  return data.access_token;
}

async function refreshGoogleToken(integration, service) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const error = new Error('Google OAuth credentials not configured for token refresh.');
    error.code = 'oauth_token_expired';
    throw error;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: await decryptStoredToken(integration.refreshToken),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = new Error(`Failed to refresh ${service} OAuth token.`);
    error.code = 'oauth_token_expired';
    throw error;
  }

  const data = await response.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await db
    .update(integrations)
    .set({
      accessToken: await encryptStoredToken(data.access_token),
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));

  return data.access_token;
}

async function encryptStoredToken(plaintext) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]).toString('base64');
}

async function decryptStoredToken(ciphertext) {
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
