import { Hono } from 'hono';
import { createHmac } from 'node:crypto';
import { db } from '../db/index.js';
import { emailUnsubscribes } from '../db/schema.js';

const router = new Hono();

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET?.trim() || 'prymal-unsub-secret';
const FRONTEND_BASE = (process.env.FRONTEND_URL ?? 'https://prymal.io').replace(/\/$/, '');

/**
 * Generate an HMAC-signed unsubscribe URL for a given email.
 * The token is HMAC-SHA256(email) with UNSUBSCRIBE_SECRET.
 */
export function generateUnsubscribeUrl(email) {
  const token = createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase().trim())
    .digest('hex');
  return `${FRONTEND_BASE}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function verifyToken(email, token) {
  const expected = createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase().trim())
    .digest('hex');
  return expected === token;
}

router.get('/', async (context) => {
  const email = context.req.query('email')?.trim();
  const token = context.req.query('token')?.trim();
  const reason = context.req.query('reason')?.trim() || null;

  if (!email || !token) {
    return context.html(buildPage('Invalid link', 'This unsubscribe link is missing required parameters.', false));
  }

  if (!verifyToken(email, token)) {
    return context.html(buildPage('Invalid link', 'This unsubscribe link is not valid or has been tampered with.', false));
  }

  try {
    await db
      .insert(emailUnsubscribes)
      .values({ email: email.toLowerCase().trim(), reason })
      .onConflictDoNothing();
  } catch {
    return context.html(buildPage('Something went wrong', 'We could not process your request. Please try again.', false));
  }

  return context.html(buildPage('Unsubscribed', 'You have been removed from all Prymal email sequences. You will no longer receive onboarding emails from us.', true));
});

function buildPage(heading, message, success) {
  const accentColor = success ? '#22c55e' : '#ef4444';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading} — Prymal</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f7fb; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; box-sizing: border-box; }
    .card { background: #fff; border-radius: 20px; border: 1px solid #dbe2f0; padding: 32px; max-width: 480px; width: 100%; }
    .eyebrow { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: ${accentColor}; margin-bottom: 12px; }
    h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.2; }
    p { margin: 0; line-height: 1.7; color: #475569; }
    a { color: #0f172a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">Prymal</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    ${success ? `<p style="margin-top:16px;font-size:13px;"><a href="${FRONTEND_BASE}">Return to Prymal</a></p>` : ''}
  </div>
</body>
</html>`;
}

export default router;
