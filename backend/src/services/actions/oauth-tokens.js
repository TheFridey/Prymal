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
    return integration.accessToken;
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
      refresh_token: integration.refreshToken,
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
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));

  return data.access_token;
}
