const DEFAULT_APP_URL = 'https://prymal.io';
export const EMAIL_LOGO_CID = 'prymal-logo';
export const EMAIL_HERALD_AVATAR_CID = 'herald-avatar';
const DEFAULT_EMAIL_LOGO_PATH = '/assets/email/prymal-character.webp';
const DEFAULT_HERALD_AVATAR_PATH = '/assets/email/herald.webp';

export function getEmailAppUrl(env = process.env) {
  return String(env.APP_URL || env.FRONTEND_URL || DEFAULT_APP_URL).replace(/\/$/, '');
}

export function getEmailLogoUrl(env = process.env) {
  const explicit = env.EMAIL_LOGO_URL?.trim();
  if (explicit) return explicit;
  if (env.EMAIL_EMBED_INLINE_ASSETS !== 'false') return `cid:${EMAIL_LOGO_CID}`;
  return `${getEmailAppUrl(env)}${DEFAULT_EMAIL_LOGO_PATH}`;
}

export function getHeraldAvatarUrl(env = process.env) {
  const explicit = env.EMAIL_HERALD_AVATAR_URL?.trim();
  if (explicit) return explicit;
  if (env.EMAIL_EMBED_INLINE_ASSETS !== 'false') return `cid:${EMAIL_HERALD_AVATAR_CID}`;
  return `${getEmailAppUrl(env)}${DEFAULT_HERALD_AVATAR_PATH}`;
}

export function renderEmailLayout({
  title,
  previewText,
  bodyHtml,
  bodyText,
  appUrl = getEmailAppUrl(),
  cta = null,
  secondaryCta = null,
  footerNote = 'This is a transactional email about your Prymal account or workspace.',
  logoUrl = getEmailLogoUrl(),
  heraldAvatarUrl = getHeraldAvatarUrl(),
}) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#050b16;color:#f8fbff;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050b16;background-image:radial-gradient(circle at 18% 0%,rgba(76,201,240,0.22),transparent 30%),radial-gradient(circle at 82% 8%,rgba(189,180,254,0.20),transparent 30%),linear-gradient(180deg,#07111f 0%,#050b16 100%);padding:34px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:12px;">
                            <img src="${escapeAttribute(logoUrl)}" width="54" height="54" alt="Prymal logo" style="display:block;width:54px;height:54px;border-radius:16px;border:1px solid rgba(76,201,240,0.32);box-shadow:0 0 26px rgba(76,201,240,0.22);object-fit:cover;">
                          </td>
                          <td style="vertical-align:middle;">
                            <div style="font-size:27px;font-weight:900;color:#ffffff;line-height:1;letter-spacing:0;text-shadow:0 0 18px rgba(76,201,240,0.16);">Prymal</div>
                            <div style="padding-top:8px;color:#9cc7ff;font-size:12px;letter-spacing:0.13em;text-transform:uppercase;">AI operating system for business execution</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#0b1425;background-image:linear-gradient(145deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025));border:1px solid rgba(76,201,240,0.30);border-radius:24px;box-shadow:0 26px 90px rgba(0,0,0,0.42),0 0 70px rgba(76,201,240,0.13);overflow:hidden;">
                <div style="height:4px;background:linear-gradient(90deg,#4cc9f0 0%,#bdb4fe 48%,#00ffd1 100%);"></div>
                <div style="padding:34px 28px 30px;">
                  <div style="display:inline-block;margin:0 0 16px 0;padding:7px 11px;border-radius:999px;background:rgba(76,201,240,0.10);border:1px solid rgba(76,201,240,0.25);color:#9be7ff;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">Herald transmission</div>
                  <h1 style="margin:0 0 16px 0;color:#ffffff;font-size:30px;line-height:1.16;letter-spacing:0;text-shadow:0 0 28px rgba(76,201,240,0.16);">${escapeHtml(title)}</h1>
                  ${bodyHtml}
                  ${cta ? `<div style="margin-top:28px;">${renderButton(cta)}</div>` : ''}
                  ${secondaryCta ? `<div style="margin-top:14px;"><a href="${escapeAttribute(secondaryCta.url)}" style="color:#9be7ff;font-size:14px;text-decoration:none;">${escapeHtml(secondaryCta.label)}</a></div>` : ''}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 4px 0;">
                ${renderHeraldSignature({ appUrl, heraldAvatarUrl })}
                <p style="margin:18px 0 0;color:#71839f;font-size:12px;line-height:1.6;">You are receiving this because you use Prymal.</p>
                <p style="margin:6px 0 0;color:#71839f;font-size:12px;line-height:1.6;">${escapeHtml(footerNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    'Prymal',
    'AI operating system for business execution',
    '',
    title,
    '',
    bodyText,
    cta ? `${cta.label}: ${cta.url}` : '',
    secondaryCta ? `${secondaryCta.label}: ${secondaryCta.url}` : '',
    '',
    'Herald',
    'Email & Communications Agent',
    'Prymal',
    '',
    'You are receiving this because you use Prymal.',
    footerNote,
  ].filter(Boolean).join('\n');

  return { html, text };
}

export function renderHeraldSignature({ heraldAvatarUrl = '' } = {}) {
  const avatar = heraldAvatarUrl
    ? `<img src="${escapeAttribute(heraldAvatarUrl)}" width="48" height="48" alt="Herald" style="display:block;width:48px;height:48px;border-radius:999px;border:1px solid rgba(76,201,240,0.42);box-shadow:0 0 24px rgba(76,201,240,0.20);object-fit:cover;">`
    : '<div style="width:48px;height:48px;border-radius:999px;background:#111f34;border:1px solid rgba(76,201,240,0.35);color:#4cc9f0;font-weight:800;font-size:20px;line-height:48px;text-align:center;">H</div>';

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:18px;padding:12px 14px;">
      <tr>
        <td style="padding-right:12px;vertical-align:middle;">${avatar}</td>
        <td style="vertical-align:middle;">
          <div style="color:#ffffff;font-weight:800;font-size:15px;">Herald</div>
          <div style="color:#9caec7;font-size:13px;line-height:1.45;">Email &amp; Communications Agent</div>
          <div style="color:#4cc9f0;font-size:13px;line-height:1.45;">Prymal</div>
        </td>
      </tr>
    </table>`;
}

export function renderButton({ label, url }) {
  return `<a href="${escapeAttribute(url)}" style="display:inline-block;background:#4cc9f0;background-image:linear-gradient(135deg,#7df9ff 0%,#4cc9f0 44%,#bdb4fe 100%);color:#06111f;text-decoration:none;padding:15px 22px;border-radius:999px;font-weight:900;font-size:14px;box-shadow:0 12px 32px rgba(76,201,240,0.24);">${escapeHtml(label)}</a>`;
}

export function renderInfoCard({ title, body }) {
  return `<div style="background:#101c30;background-image:linear-gradient(145deg,rgba(76,201,240,0.08),rgba(189,180,254,0.05));border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:17px;margin:18px 0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);">
    <div style="color:#ffffff;font-weight:900;margin-bottom:7px;">${escapeHtml(title)}</div>
    <div style="color:#c1cde0;line-height:1.65;font-size:14px;">${body}</div>
  </div>`;
}

export function renderList({ items }) {
  return `<ul style="padding-left:20px;margin:12px 0 0;color:#dce7f7;line-height:1.7;">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function renderUsageSummary({ executionCredits, videoCredits, planName }) {
  const rows = [
    ['Plan', planName || 'Prymal'],
    ['Execution credits', executionCredits ?? 'Included by plan'],
    ['Video credits', videoCredits ?? 'Available where included'],
  ];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-collapse:collapse;">
    ${rows.map(([label, value]) => `<tr>
      <td style="padding:10px 0;color:#8ea1bd;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;">${escapeHtml(label)}</td>
      <td align="right" style="padding:10px 0;color:#ffffff;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px;font-weight:700;">${escapeHtml(value)}</td>
    </tr>`).join('')}
  </table>`;
}

export function paragraph(value) {
  return `<p style="margin:0 0 16px 0;color:#c7d3e6;line-height:1.68;font-size:15px;">${escapeHtml(value)}</p>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
