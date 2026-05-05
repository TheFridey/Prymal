/**
 * Google Drive write actions.
 * Requires an active google_drive OAuth integration on the org.
 */
import { getOAuthToken } from './oauth-tokens.js';
import { recordProductEvent } from '../telemetry.js';

/**
 * Create or update a file in Google Drive.
 * @param {object} payload - { name, content, mimeType, parentFolderId? }
 * @param {object} context - { orgId, userId, workflowId? }
 * @returns {{ fileId, webViewLink, name }}
 */
export async function writeFile(payload, context) {
  const { name, content, mimeType = 'text/plain', parentFolderId } = payload;
  const { orgId, userId, workflowId } = context;

  const accessToken = await getOAuthToken(orgId, 'google_drive');

  const metadata = {
    name,
    mimeType,
    ...(parentFolderId ? { parents: [parentFolderId] } : {}),
  };

  const boundary = 'prymal_drive_boundary';
  const contentBody = typeof content === 'string' ? content : JSON.stringify(content);
  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    contentBody,
    `--${boundary}--`,
  ].join('\r\n');

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData?.error?.message ?? `Drive API error: ${response.status}`);
    error.code = 'DRIVE_API_ERROR';
    throw error;
  }

  const data = await response.json();

  await recordProductEvent('action_executed', {
    orgId,
    userId,
    actionType: 'drive.write',
    workflowId,
    fileId: data.id,
  }).catch(() => {});

  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
    name: data.name,
  };
}

/**
 * Append text content to an existing Google Docs document.
 * @param {object} payload - { fileId, content }
 * @param {object} context - { orgId, userId }
 * @returns {{ fileId }}
 */
export async function appendToFile(payload, context) {
  const { fileId, content } = payload;
  const { orgId, userId } = context;

  const accessToken = await getOAuthToken(orgId, 'google_drive');

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: `\n${content}`,
      },
    },
  ];

  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${fileId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData?.error?.message ?? `Docs API error: ${response.status}`);
    error.code = 'DRIVE_API_ERROR';
    throw error;
  }

  await recordProductEvent('action_executed', {
    orgId,
    userId,
    actionType: 'drive.append',
    fileId,
  }).catch(() => {});

  return { fileId };
}

/**
 * Create a folder in Google Drive.
 * @param {object} payload - { name, parentFolderId? }
 * @param {object} context - { orgId, userId }
 * @returns {{ folderId }}
 */
export async function createFolder(payload, context) {
  const { name, parentFolderId } = payload;
  const { orgId, userId } = context;

  const accessToken = await getOAuthToken(orgId, 'google_drive');

  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId ? { parents: [parentFolderId] } : {}),
  };

  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData?.error?.message ?? `Drive API error: ${response.status}`);
    error.code = 'DRIVE_API_ERROR';
    throw error;
  }

  const data = await response.json();

  await recordProductEvent('action_executed', {
    orgId,
    userId,
    actionType: 'drive.folder',
    folderId: data.id,
  }).catch(() => {});

  return { folderId: data.id };
}
