import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../lib/logger.js';

const log = logger.child({ component: 'resend-client' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const INLINE_EMAIL_ASSETS = [
  {
    cid: 'prymal-logo',
    filename: 'prymal-character.webp',
    contentType: 'image/webp',
    path: path.join(REPO_ROOT, 'frontend', 'src', 'assets', 'brand', 'prymal-character.webp'),
  },
  {
    cid: 'herald-avatar',
    filename: 'herald.webp',
    contentType: 'image/webp',
    path: path.join(REPO_ROOT, 'frontend', 'src', 'assets', 'agents', 'herald.webp'),
  },
];

export function getResendConfig(env = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim() || env.EMAIL_FROM?.trim();
  const replyTo = env.REPLY_TO_EMAIL?.trim() || env.INVITE_EMAIL_REPLY_TO?.trim() || undefined;

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from, replyTo };
}

export async function sendViaResend({ to, subject, html, text, tags = [], replyTo, fetchImpl = fetch }) {
  const config = getResendConfig();
  if (!config) {
    return {
      ok: false,
      skipped: true,
      provider: 'none',
      reason: 'Email delivery provider is not configured.',
    };
  }

  const attachments = await buildInlineAssetAttachments(html);

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      reply_to: replyTo || config.replyTo ? [replyTo || config.replyTo] : undefined,
      subject,
      html,
      text,
      tags: [
        { name: 'product', value: 'prymal' },
        ...tags,
      ],
      attachments: attachments.length ? attachments : undefined,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || 'Failed to send email.');
    error.status = response.status;
    throw error;
  }

  return {
    ok: true,
    skipped: false,
    provider: 'resend',
    providerMessageId: payload?.id ?? null,
  };
}

export async function buildInlineAssetAttachments(html = '', env = process.env) {
  if (env.EMAIL_EMBED_INLINE_ASSETS === 'false') return [];

  const attachments = [];
  for (const asset of INLINE_EMAIL_ASSETS) {
    if (!html.includes(`cid:${asset.cid}`)) continue;
    try {
      const content = await readFile(asset.path, 'base64');
      attachments.push({
        content,
        filename: asset.filename,
        content_type: asset.contentType,
        content_disposition: 'inline',
        content_id: asset.cid,
      });
    } catch (error) {
      log.warn({ err: error, filename: asset.filename }, 'email.inline_asset_missing');
    }
  }

  return attachments;
}
