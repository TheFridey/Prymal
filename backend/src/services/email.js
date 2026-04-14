import { generateUnsubscribeUrl } from '../routes/unsubscribe.js';

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return {
    apiKey,
    from,
    replyTo: process.env.INVITE_EMAIL_REPLY_TO?.trim() || undefined,
  };
}

export async function sendInvitationEmail({ to, organisationName, inviterName, inviteUrl, role, expiresAt }) {
  const config = getResendConfig();

  if (!config) {
    return {
      delivered: false,
      provider: 'none',
      fallback: true,
      message: 'Email delivery provider is not configured.',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      reply_to: config.replyTo ? [config.replyTo] : undefined,
      subject: `Join ${organisationName} on Prymal`,
      html: buildInvitationHtml({ organisationName, inviterName, inviteUrl, role, expiresAt }),
      text: buildInvitationText({ organisationName, inviterName, inviteUrl, role, expiresAt }),
      tags: [
        { name: 'product', value: 'prymal' },
        { name: 'email_type', value: 'organisation_invitation' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || 'Failed to send invitation email.');
    error.status = 502;
    error.code = 'INVITE_EMAIL_FAILED';
    throw error;
  }

  return {
    delivered: true,
    provider: 'resend',
    emailId: payload?.id ?? null,
  };
}

function buildInvitationHtml({ organisationName, inviterName, inviteUrl, role, expiresAt }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2f0;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Prymal Invitation</div>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">Join ${escapeHtml(organisationName)} on Prymal</h1>
        <p style="margin:0 0 16px;line-height:1.7;color:#475569;">
          ${escapeHtml(inviterName || 'A workspace owner')} invited you to join <strong>${escapeHtml(organisationName)}</strong> as a <strong>${escapeHtml(role)}</strong>.
        </p>
        <p style="margin:0 0 24px;line-height:1.7;color:#475569;">
          This workspace gives you access to shared context, workflows, memory, and agent operations inside one Prymal organisation.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;">Accept invitation</a>
        <p style="margin:24px 0 0;line-height:1.7;color:#64748b;font-size:13px;">
          This invitation expires on ${new Date(expiresAt).toLocaleString('en-GB')}. If the button does not work, open this link directly:<br />
          <span style="word-break:break-all;">${inviteUrl}</span>
        </p>
      </div>
    </div>
  `;
}

function buildInvitationText({ organisationName, inviterName, inviteUrl, role, expiresAt }) {
  return [
    `Join ${organisationName} on Prymal`,
    '',
    `${inviterName || 'A workspace owner'} invited you to join ${organisationName} as a ${role}.`,
    '',
    `Accept the invitation: ${inviteUrl}`,
    `Expires: ${new Date(expiresAt).toLocaleString('en-GB')}`,
  ].join('\n');
}

export async function sendWaitlistConfirmationEmail(to) {
  const config = getResendConfig();

  if (!config) {
    return { delivered: false, provider: 'none', fallback: true };
  }

  const siteUrl = 'https://prymal.io';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      reply_to: config.replyTo ? [config.replyTo] : undefined,
      subject: "You're on the Prymal waitlist",
      html: `
        <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2f0;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Prymal</div>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;">You're on the list.</h1>
            <p style="margin:0 0 16px;line-height:1.7;color:#475569;">
              Thanks for signing up. We'll let you know when Prymal is ready for you — and you'll get first access to new agents and pricing updates.
            </p>
            <p style="margin:0 0 24px;line-height:1.7;color:#475569;">
              In the meantime, you can read about what we're building at <a href="${siteUrl}" style="color:#0f172a;">${siteUrl}</a>.
            </p>
            <a href="${siteUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;">Visit prymal.io</a>
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
              You received this because you signed up for the Prymal waitlist. <a href="${generateUnsubscribeUrl(to)}" style="color:#94a3b8;">Unsubscribe</a>.
            </p>
          </div>
        </div>
      `,
      text: [
        "You're on the Prymal waitlist.",
        '',
        "Thanks for signing up. We'll let you know when Prymal is ready for you — and you'll get first access to new agents and pricing updates.",
        '',
        `In the meantime, read about what we're building: ${siteUrl}`,
        '',
        `You received this because you signed up for the Prymal waitlist. Unsubscribe: ${generateUnsubscribeUrl(to)}`,
      ].join('\n'),
      tags: [
        { name: 'product', value: 'prymal' },
        { name: 'email_type', value: 'waitlist_confirmation' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || 'Failed to send waitlist confirmation email.');
    error.status = 502;
    throw error;
  }

  return { delivered: true, provider: 'resend', emailId: payload?.id ?? null };
}

export async function sendWelcomeEmail(to, { firstName, orgName, recommendedAgentId, recommendedAgentName }) {
  const config = getResendConfig();
  const frontendBase = (process.env.FRONTEND_URL ?? 'https://prymal.io').replace(/\/$/, '');
  const agentLink = `${frontendBase}/app/agents/${recommendedAgentId}?new=1`;

  if (!config) {
    return { delivered: false, provider: 'none', fallback: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      reply_to: config.replyTo ? [config.replyTo] : undefined,
      subject: `Your Prymal workspace is live, ${firstName || 'there'}`,
      html: buildWelcomeHtml({ firstName, orgName, agentLink, agentName: recommendedAgentName, unsubscribeUrl: generateUnsubscribeUrl(to) }),
      text: buildWelcomeText({ firstName, orgName, agentLink, agentName: recommendedAgentName, unsubscribeUrl: generateUnsubscribeUrl(to) }),
      tags: [
        { name: 'product', value: 'prymal' },
        { name: 'email_type', value: 'onboarding_day0' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || 'Failed to send welcome email.');
    error.status = 502;
    throw error;
  }

  return { delivered: true, provider: 'resend', emailId: payload?.id ?? null };
}

export async function sendDay3Email(to, { firstName, orgName }) {
  const config = getResendConfig();
  const frontendBase = (process.env.FRONTEND_URL ?? 'https://prymal.io').replace(/\/$/, '');
  const loreLink = `${frontendBase}/app/lore`;

  if (!config) {
    return { delivered: false, provider: 'none', fallback: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      reply_to: config.replyTo ? [config.replyTo] : undefined,
      subject: 'One thing worth trying in Prymal this week',
      html: buildDay3Html({ firstName, orgName, loreLink, unsubscribeUrl: generateUnsubscribeUrl(to) }),
      text: buildDay3Text({ firstName, loreLink, unsubscribeUrl: generateUnsubscribeUrl(to) }),
      tags: [
        { name: 'product', value: 'prymal' },
        { name: 'email_type', value: 'onboarding_day3' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || 'Failed to send day 3 email.');
    error.status = 502;
    throw error;
  }

  return { delivered: true, provider: 'resend', emailId: payload?.id ?? null };
}

export async function sendDay7Email(to, { firstName, orgName }) {
  const config = getResendConfig();
  const frontendBase = (process.env.FRONTEND_URL ?? 'https://prymal.io').replace(/\/$/, '');
  const workflowsLink = `${frontendBase}/app/workflows`;
  const replyEmail = config?.replyTo ?? config?.from ?? 'support@prymal.io';

  if (!config) {
    return { delivered: false, provider: 'none', fallback: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      reply_to: config.replyTo ? [config.replyTo] : undefined,
      subject: "How's Prymal working for you?",
      html: buildDay7Html({ firstName, orgName, workflowsLink, replyEmail, unsubscribeUrl: generateUnsubscribeUrl(to) }),
      text: buildDay7Text({ firstName, workflowsLink, replyEmail, unsubscribeUrl: generateUnsubscribeUrl(to) }),
      tags: [
        { name: 'product', value: 'prymal' },
        { name: 'email_type', value: 'onboarding_day7' },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || 'Failed to send day 7 email.');
    error.status = 502;
    throw error;
  }

  return { delivered: true, provider: 'resend', emailId: payload?.id ?? null };
}

function buildWelcomeHtml({ firstName, orgName, agentLink, agentName, unsubscribeUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2f0;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Prymal</div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;">Your workspace is live, ${escapeHtml(firstName || 'there')}</h1>
        <p style="margin:0 0 16px;line-height:1.7;color:#475569;">
          ${escapeHtml(orgName)} is set up and ready to go. The fastest way to get useful output is to start with one agent that matches what you need most right now.
        </p>
        <p style="margin:0 0 24px;line-height:1.7;color:#475569;">
          We've picked <strong>${escapeHtml(agentName)}</strong> as a good first step based on your workspace profile.
        </p>
        <a href="${agentLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;">Start with ${escapeHtml(agentName)}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
          You received this because you signed up for Prymal. <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a>.
        </p>
      </div>
    </div>
  `;
}

function buildWelcomeText({ firstName, orgName, agentLink, agentName, unsubscribeUrl }) {
  return [
    `Your Prymal workspace is live, ${firstName || 'there'}`,
    '',
    `${orgName} is set up and ready to go.`,
    '',
    `We've picked ${agentName} as a good first step based on your workspace profile.`,
    '',
    `Start with ${agentName}: ${agentLink}`,
    '',
    `You received this because you signed up for Prymal. Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
}

function buildDay3Html({ firstName, orgName, loreLink, unsubscribeUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2f0;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Prymal</div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;">One thing worth trying this week</h1>
        <p style="margin:0 0 16px;line-height:1.7;color:#475569;">
          Hi ${escapeHtml(firstName || 'there')} — one small change that makes a noticeable difference in Prymal:
        </p>
        <p style="margin:0 0 16px;line-height:1.7;color:#475569;">
          Upload one document to <strong>LORE</strong> — a brand guide, a standard operating procedure, a past brief, or a report you refer to often. Once it's there, every agent output is grounded in your actual business context rather than working from scratch.
        </p>
        <a href="${loreLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;">Upload your first document to LORE</a>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
          You received this because you signed up for Prymal. <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a>.
        </p>
      </div>
    </div>
  `;
}

function buildDay3Text({ firstName, loreLink, unsubscribeUrl }) {
  return [
    `Hi ${firstName || 'there'},`,
    '',
    'One thing that makes a noticeable difference in Prymal:',
    '',
    'Upload one document to LORE — a brand guide, an SOP, a past brief, or a report you refer to often. Once it\'s there, every agent output is grounded in your actual business context.',
    '',
    `Upload your first document to LORE: ${loreLink}`,
    '',
    `You received this because you signed up for Prymal. Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
}

function buildDay7Html({ firstName, workflowsLink, replyEmail, unsubscribeUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:32px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #dbe2f0;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Prymal</div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;">How's Prymal working for you?</h1>
        <p style="margin:0 0 16px;line-height:1.7;color:#475569;">
          Hi ${escapeHtml(firstName || 'there')} — it's been a week. If you haven't tried <strong>workflows</strong> yet, that's the next thing worth exploring: repeatable chains of agent tasks you can trigger with one click.
        </p>
        <p style="margin:0 0 24px;line-height:1.7;color:#475569;">
          One question: <strong>What kind of work are you trying to get done?</strong> <a href="mailto:${escapeHtml(replyEmail)}?subject=Re: How's Prymal working">Hit reply</a> — it goes straight to the team.
        </p>
        <a href="${workflowsLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;">Explore workflows</a>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
          You received this because you signed up for Prymal. <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a>.
        </p>
      </div>
    </div>
  `;
}

function buildDay7Text({ firstName, workflowsLink, replyEmail, unsubscribeUrl }) {
  return [
    `Hi ${firstName || 'there'},`,
    '',
    "It's been a week. If you haven't tried workflows yet, that's the next thing worth exploring: repeatable chains of agent tasks you can trigger with one click.",
    '',
    `Explore workflows: ${workflowsLink}`,
    '',
    `One question: what kind of work are you trying to get done? Reply to this email — it goes straight to the team: ${replyEmail}`,
    '',
    `You received this because you signed up for Prymal. Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
