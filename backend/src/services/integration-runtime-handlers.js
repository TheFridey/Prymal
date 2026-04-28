/**
 * Extra integration runtimes keyed by IntegrationDefinition.integrationRuntime.
 * Legacy integrations still use inline branches in integrations.js.
 */

async function readProviderJson(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : {};
}

function normalizeBaseUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
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

function parseTargetList(value) {
  return String(value ?? '')
    .split(/[;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function truncatePlainText(value, maxLength) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (!maxLength || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildEmailBody(payload) {
  return [payload.text, payload.linkUrl, payload.imageUrl]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('\n\n');
}

async function blueskySession({ identifier, appPassword }) {
  const host = 'https://bsky.social';
  const response = await fetch(`${host}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: String(identifier).trim(),
      password: String(appPassword).trim(),
    }),
  });
  const payload = await readProviderJson(response);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Bluesky sign-in failed.');
  }
  return { ...payload, host };
}

export async function testBluesky({ accessToken, settings = {}, connection = null }) {
  const identifier = settings.blueskyIdentifier?.trim();
  if (!identifier) {
    throw new Error('Bluesky requires your handle or DID (saved under Bluesky identifier).');
  }
  const session = await blueskySession({ identifier, appPassword: accessToken });

  return {
    message: `Connected to Bluesky as @${session.handle ?? identifier}.`,
    accountId: session.did ?? connection?.accountId ?? null,
    accountEmail: null,
    profile: {
      name: session.handle ?? identifier,
      handle: session.handle ? `@${session.handle}` : identifier,
      workspace: 'Bluesky',
    },
  };
}

export async function publishBluesky({ accessToken, payload, settings = {} }) {
  const publishedAt = new Date().toISOString();
  const identifier = settings.blueskyIdentifier?.trim();
  if (!identifier) {
    throw new Error('Bluesky publishing requires your Bluesky identifier.');
  }

  const session = await blueskySession({ identifier, appPassword: accessToken });
  const text = buildPublishText(payload, { maxLength: 300 });

  const createBody = {
    repo: session.did,
    collection: 'app.bsky.feed.post',
    record: {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: publishedAt,
    },
  };

  const response = await fetch(`${session.host ?? 'https://bsky.social'}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });
  const body = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(body?.message || body?.error || 'Bluesky publish failed.');
  }

  return {
    status: 'sent',
    publishedAt,
    target: `@${session.handle ?? identifier}`,
    providerMessageId: body?.uri ?? body?.cid ?? null,
    preview: text.slice(0, 160),
    linkUrl: payload.linkUrl ?? null,
  };
}

export async function testGithubSocial({ accessToken, connection = null }) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'GitHub token verification failed.');
  }

  return {
    message: `Connected as GitHub user ${payload.login ?? 'user'}.`,
    accountId: payload.id != null ? String(payload.id) : connection?.accountId ?? null,
    accountEmail: payload.email ?? null,
    profile: {
      name: payload.name ?? payload.login ?? null,
      handle: payload.login ?? null,
      avatarUrl: payload.avatar_url ?? null,
    },
  };
}

export async function publishGithubSocial({ accessToken, payload }) {
  const publishedAt = new Date().toISOString();
  const description = truncatePlainText(payload.title ?? payload.text, 120);
  const content = buildPublishText(payload, { maxLength: 100000 });

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      description: description || 'Prymal share',
      public: false,
      files: {
        'prymal-post.md': { content },
      },
    }),
  });
  const body = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(body?.message || 'GitHub Gist publish failed.');
  }

  return {
    status: 'sent',
    publishedAt,
    target: body.html_url ?? body.id ?? 'gist',
    providerMessageId: body.id ?? null,
    preview: content.slice(0, 160),
    linkUrl: body.html_url ?? payload.linkUrl ?? null,
  };
}

export function testWebhookAlias({ settings }) {
  if (!settings.endpointUrl) {
    throw new Error('This integration requires an endpoint URL.');
  }
  return {
    message: 'Endpoint saved. Prymal does not probe automation URLs automatically.',
    accountId: settings.endpointUrl,
    accountEmail: null,
    profile: {
      name: settings.endpointUrl,
      handle: settings.endpointUrl,
    },
  };
}

export async function publishWebhookAlias({ service, accessToken, payload, settings = {} }) {
  const publishedAt = new Date().toISOString();
  const target = payload.targetId ?? settings.endpointUrl;
  if (!target) {
    throw new Error('Publishing requires an endpoint URL in connection settings.');
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
    throw new Error(body?.message || body?.error || `Publish failed with status ${response.status}.`);
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

export async function publishTextHook({ accessToken, payload, settings = {} }) {
  const publishedAt = new Date().toISOString();
  const target = payload.targetId ?? settings.endpointUrl;
  if (!target) {
    throw new Error('Publishing requires an incoming webhook URL in settings.');
  }

  const text = buildPublishText(payload, { maxLength: 8000 });
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Prymal-Integrations/1.0',
  };

  if (accessToken) {
    headers.Authorization = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;
  }

  const response = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });

  const body = await readProviderJson(response);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Incoming webhook failed (${response.status}).`);
  }

  return {
    status: 'sent',
    publishedAt,
    target,
    providerMessageId: body?.ts ?? body?.message_id ?? null,
    preview: text.slice(0, 160),
    linkUrl: payload.linkUrl ?? null,
  };
}

export async function publishDiscordHook({ accessToken, payload, settings = {} }) {
  const publishedAt = new Date().toISOString();
  const target = payload.targetId ?? settings.endpointUrl;
  if (!target) {
    throw new Error('Publishing requires a Discord or Guilded webhook URL.');
  }

  const content = buildPublishText(payload, { maxLength: 2000 });
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Prymal-Integrations/1.0',
  };

  if (accessToken) {
    headers.Authorization = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;
  }

  const response = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });

  const body = await readProviderJson(response);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Webhook failed (${response.status}).`);
  }

  return {
    status: 'sent',
    publishedAt,
    target,
    providerMessageId: body?.id ?? null,
    preview: content.slice(0, 160),
    linkUrl: payload.linkUrl ?? null,
  };
}

export async function testLineChannel({ accessToken, settings: _settings = {}, connection = null }) {
  const response = await fetch('https://api.line.me/v2/bot/info', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'LINE channel token verification failed.');
  }

  return {
    message: `LINE channel verified (${payload.displayName ?? 'bot'}).`,
    accountId: payload.userId ?? connection?.accountId ?? null,
    accountEmail: null,
    profile: {
      name: payload.displayName ?? null,
      handle: payload.userId ?? null,
    },
  };
}

export async function publishLineChannel({ accessToken, payload, settings = {} }) {
  const publishedAt = new Date().toISOString();
  const to = (payload.targetId ?? settings.defaultChatId ?? '').trim();
  if (!to) {
    throw new Error('LINE push requires a destination user ID (save a default recipient).');
  }

  const text = buildPublishText(payload, { maxLength: 5000 });
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
    }),
  });

  const body = await readProviderJson(response);
  if (!response.ok) {
    throw new Error(body?.message || 'LINE push failed.');
  }

  return {
    status: 'sent',
    publishedAt,
    target: to,
    providerMessageId: body?.sentMessages?.[0]?.id ?? null,
    preview: text.slice(0, 160),
    linkUrl: payload.linkUrl ?? null,
  };
}

async function verifyTransactionalEmailCredentials(api, accessToken, settings = {}) {
  switch (api) {
    case 'resend': {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.message || 'Resend API key verification failed.');
      return;
    }
    case 'postmark': {
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: { 'X-Postmark-Server-Token': accessToken },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.Message || 'Postmark token verification failed.');
      return;
    }
    case 'sendgrid': {
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.errors?.[0]?.message || 'SendGrid key verification failed.');
      return;
    }
    case 'mailgun': {
      const region = settings.mailgunRegion === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
      const response = await fetch(`${region}/v3/domains`, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${accessToken}`).toString('base64')}` },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.message || 'Mailgun key verification failed.');
      return;
    }
    case 'brevo': {
      const response = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': accessToken },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.message || 'Brevo API key verification failed.');
      return;
    }
    case 'sparkpost': {
      const response = await fetch('https://api.sparkpost.com/api/v1/account', {
        headers: { Authorization: accessToken },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.errors?.[0]?.message || 'SparkPost key verification failed.');
      return;
    }
    case 'elastic_email': {
      const response = await fetch('https://api.elasticemail.com/v4/account', {
        headers: { 'X-ElasticEmail-ApiKey': accessToken },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.message || 'Elastic Email key verification failed.');
      return;
    }
    case 'mailjet': {
      const key = settings.mailjetApiKey?.trim();
      if (!key) throw new Error('Mailjet requires your API key in settings and the API secret in the token field.');
      const secret = String(accessToken).trim();
      const basic = Buffer.from(`${key}:${secret}`).toString('base64');
      const response = await fetch('https://api.mailjet.com/v3/REST/user', {
        headers: { Authorization: `Basic ${basic}` },
      });
      const payload = await readProviderJson(response);
      if (!response.ok) throw new Error(payload?.ErrorMessage || 'Mailjet credentials verification failed.');
      return;
    }
    default:
      throw new Error(`Unknown email provider: ${api}`);
  }
}

export async function testTransactionalEmail(def, { accessToken, settings = {}, connection = null }) {
  const api = def.emailApi;
  await verifyTransactionalEmailCredentials(api, accessToken, settings);

  const label = def.name ?? api;
  return {
    message: `${label} API credentials verified.`,
    accountId: connection?.accountId ?? api,
    accountEmail: null,
    profile: {
      name: label,
      handle: api,
    },
  };
}

async function publishEmailCommon(api, accessToken, settings, payload) {
  const publishedAt = new Date().toISOString();
  const targets = parseTargetList(payload.targetId ?? settings.defaultRecipientEmail);
  if (targets.length === 0) {
    throw new Error('Add at least one recipient email in the target field or saved defaults.');
  }

  const from = settings.defaultFromEmail?.trim();
  if (!from) {
    throw new Error('Save a verified From email address for this provider before publishing.');
  }

  const subject = (payload.title ?? truncatePlainText(payload.text, 80) ?? 'Prymal message').trim();
  const bodyContent = buildEmailBody(payload);

  if (api === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: targets,
        subject,
        text: bodyContent,
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.message || 'Resend send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.id ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'postmark') {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'X-Postmark-Server-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: from,
        To: targets.join(','),
        Subject: subject,
        TextBody: bodyContent,
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.Message || 'Postmark send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.MessageID ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'sendgrid') {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: targets.map((email) => ({ email })) }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: bodyContent }],
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.errors?.[0]?.message || 'SendGrid send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: response.headers.get('x-message-id') ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'mailgun') {
    const domain = settings.mailgunDomain?.trim();
    if (!domain) throw new Error('Mailgun publishing requires your Mailgun sending domain in settings.');
    const region = settings.mailgunRegion === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
    const params = new URLSearchParams({
      from,
      to: targets.join(','),
      subject,
      text: bodyContent,
    });

    const response = await fetch(`${region}/v3/${encodeURIComponent(domain)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`api:${accessToken}`).toString('base64')}` },
      body: params,
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.message || 'Mailgun send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.id ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'brevo') {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { email: from },
        to: targets.map((email) => ({ email })),
        subject,
        textContent: bodyContent,
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.message || 'Brevo send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.messageId ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'sparkpost') {
    const response = await fetch('https://api.sparkpost.com/api/v1/transmissions', {
      method: 'POST',
      headers: { Authorization: accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          from: { email: from },
          subject,
          text: bodyContent,
        },
        recipients: targets.map((address) => ({ address: { email: address } })),
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.errors?.[0]?.message || 'SparkPost send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.results?.id ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'elastic_email') {
    const response = await fetch('https://api.elasticemail.com/v4/emails/transactional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ElasticEmail-ApiKey': accessToken },
      body: JSON.stringify({
        Recipients: { To: targets },
        Content: {
          From: from,
          Subject: subject,
          Body: [{ ContentType: 'PlainText', Content: bodyContent }],
        },
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.message || 'Elastic Email send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.TransactionID ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  if (api === 'mailjet') {
    const key = settings.mailjetApiKey?.trim();
    const secret = accessToken.trim();
    const basic = Buffer.from(`${key}:${secret}`).toString('base64');
    const response = await fetch('https://api.mailjet.com/v3/send', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: from },
            To: targets.map((email) => ({ Email: email })),
            Subject: subject,
            TextPart: bodyContent,
          },
        ],
      }),
    });
    const body = await readProviderJson(response);
    if (!response.ok) throw new Error(body?.ErrorMessage || 'Mailjet send failed.');
    return {
      status: 'sent',
      publishedAt,
      target: targets.join(', '),
      providerMessageId: body?.Messages?.[0]?.To?.[0]?.MessageUUID ?? null,
      preview: bodyContent.slice(0, 160),
      linkUrl: payload.linkUrl ?? null,
    };
  }

  throw new Error(`Email send not implemented for ${api}.`);
}

export async function publishTransactionalEmail(def, ctx) {
  return publishEmailCommon(def.emailApi, ctx.accessToken, ctx.settings ?? {}, ctx.payload);
}

export async function testSharepointFiles({ accessToken, settings: _settings = {}, connection = null }) {
  const [profileResponse, siteResponse] = await Promise.all([
    fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch('https://graph.microsoft.com/v1.0/sites/root?$select=id,displayName,webUrl', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const profilePayload = await readProviderJson(profileResponse);
  const sitePayload = await readProviderJson(siteResponse);

  if (!profileResponse.ok) {
    throw new Error(profilePayload?.error?.message || 'Microsoft account lookup failed.');
  }
  if (!siteResponse.ok) {
    throw new Error(sitePayload?.error?.message || 'SharePoint root site lookup failed.');
  }

  const email = profilePayload.mail ?? profilePayload.userPrincipalName ?? null;

  return {
    message: `Microsoft 365 tenant linked for SharePoint (${sitePayload.displayName ?? 'root site'}).`,
    accountId: sitePayload.id ?? profilePayload.id ?? connection?.accountId ?? null,
    accountEmail: email,
    profile: {
      name: profilePayload.displayName ?? email ?? null,
      handle: email,
      workspace: sitePayload.webUrl ?? sitePayload.displayName ?? 'SharePoint',
    },
  };
}

export async function testNextcloudWebdav({ accessToken, settings = {}, connection: _connection = null }) {
  const base = normalizeBaseUrl(settings.nextcloudUrl);
  const username = settings.nextcloudUsername?.trim();
  if (!base || !username) {
    throw new Error('Nextcloud requires a base URL and username.');
  }

  const path = `${base}/remote.php/dav/files/${encodeURIComponent(username)}/`;
  const auth = Buffer.from(`${username}:${accessToken}`).toString('base64');
  const response = await fetch(path, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: '0',
    },
  });

  if (!response.ok && response.status !== 207) {
    const body = await readProviderJson(response);
    throw new Error(body?.message || 'Nextcloud WebDAV verification failed.');
  }

  return {
    message: `Connected to Nextcloud at ${new URL(base).host}.`,
    accountId: username,
    accountEmail: null,
    profile: {
      name: username,
      handle: new URL(base).host,
      workspace: 'Nextcloud',
    },
  };
}

export async function testWebdavStorage({ accessToken, settings = {}, connection = null }) {
  const url = settings.webdavUrl?.trim();
  const username = settings.webdavUsername?.trim();
  if (!url || !username) {
    throw new Error('Generic WebDAV requires a WebDAV URL and username.');
  }

  const auth = Buffer.from(`${username}:${accessToken}`).toString('base64');
  const response = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: '0',
    },
  });

  if (!response.ok && response.status !== 207) {
    const body = await readProviderJson(response);
    throw new Error(body?.message || 'WebDAV verification failed.');
  }

  return {
    message: `Connected to WebDAV host ${new URL(url).host}.`,
    accountId: connection?.accountId ?? username,
    accountEmail: null,
    profile: {
      name: username,
      handle: new URL(url).host,
    },
  };
}

export async function testGitlabPat({ accessToken, settings = {}, connection = null }) {
  const host = normalizeBaseUrl(settings.gitlabHost || 'https://gitlab.com');
  const response = await fetch(`${host}/api/v4/user`, {
    headers: { 'PRIVATE-TOKEN': accessToken },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'GitLab token verification failed.');
  }

  return {
    message: `Connected to GitLab as ${payload.username}.`,
    accountId: payload.id != null ? String(payload.id) : connection?.accountId ?? null,
    accountEmail: payload.email ?? null,
    profile: {
      name: payload.name ?? payload.username ?? null,
      handle: payload.username ?? null,
      avatarUrl: payload.avatar_url ?? null,
    },
  };
}

export async function testFigmaPat({ accessToken, connection = null }) {
  const response = await fetch('https://api.figma.com/v1/me', {
    headers: { 'X-Figma-Token': accessToken },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || payload?.err || 'Figma token verification failed.');
  }

  return {
    message: `Connected to Figma as ${payload.email ?? payload.handle ?? 'user'}.`,
    accountId: payload.id ?? connection?.accountId ?? null,
    accountEmail: payload.email ?? null,
    profile: {
      name: payload.handle ?? payload.email ?? null,
      handle: payload.handle ?? null,
    },
  };
}

export async function testBitbucketBasic({ accessToken, settings = {}, connection = null }) {
  const username = settings.bitbucketUsername?.trim();
  if (!username) {
    throw new Error('Bitbucket requires your workspace username in settings.');
  }

  const auth = Buffer.from(`${username}:${accessToken}`).toString('base64');
  const response = await fetch('https://api.bitbucket.org/2.0/user', {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Bitbucket credentials verification failed.');
  }

  return {
    message: `Connected to Bitbucket as ${payload.username ?? username}.`,
    accountId: payload.uuid ?? connection?.accountId ?? null,
    accountEmail: null,
    profile: {
      name: payload.display_name ?? payload.username ?? null,
      handle: payload.username ?? null,
    },
  };
}

export async function testOutlineKnowledge({ accessToken, settings = {}, connection = null }) {
  const base = normalizeBaseUrl(settings.outlineBaseUrl);
  if (!base) {
    throw new Error('Outline requires your team base URL (e.g. https://app.getoutline.com).');
  }

  const response = await fetch(`${base}/api/users.info`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({}),
  });
  const payload = await readProviderJson(response);

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error || payload?.message || 'Outline API verification failed.');
  }

  const user = payload.data;
  return {
    message: `Connected to Outline as ${user?.name ?? 'member'}.`,
    accountId: user?.id ?? connection?.accountId ?? null,
    accountEmail: user?.email ?? null,
    profile: {
      name: user?.name ?? null,
      handle: user?.email ?? null,
    },
  };
}

export async function testConfluenceWiki({ accessToken, settings = {}, connection = null }) {
  const site = String(settings.atlassianSite ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const email = settings.atlassianEmail?.trim();
  if (!site || !email) {
    throw new Error('Confluence Cloud requires your Atlassian site host and account email.');
  }

  const basic = Buffer.from(`${email}:${accessToken}`).toString('base64');
  const response = await fetch(`https://${site}/wiki/rest/api/user/current`, {
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: 'application/json',
    },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Confluence API verification failed.');
  }

  return {
    message: `Connected to Confluence as ${payload.displayName ?? email}.`,
    accountId: payload.accountId ?? connection?.accountId ?? null,
    accountEmail: email,
    profile: {
      name: payload.displayName ?? null,
      handle: payload.email ?? email,
    },
  };
}

export async function testCodaWiki({ accessToken, connection = null }) {
  const response = await fetch('https://coda.io/apis/v1/whoami', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Coda API token verification failed.');
  }

  return {
    message: `Connected to Coda as ${payload.name ?? 'workspace'}.`,
    accountId: payload.id ?? connection?.accountId ?? null,
    accountEmail: null,
    profile: {
      name: payload.name ?? null,
      handle: payload.loginId ?? null,
    },
  };
}

export async function testBookstackWiki({ accessToken, settings = {}, connection = null }) {
  const base = normalizeBaseUrl(settings.bookstackUrl);
  if (!base) {
    throw new Error('BookStack requires your instance base URL.');
  }

  const trimmed = String(accessToken).trim();
  const idx = trimmed.indexOf(':');
  if (idx < 1) {
    throw new Error('BookStack tokens must be formatted as tokenId:tokenSecret in the secret field.');
  }
  const tokenId = trimmed.slice(0, idx).trim();
  const tokenSecret = trimmed.slice(idx + 1).trim();
  if (!tokenId || !tokenSecret) {
    throw new Error('BookStack tokens must include both the public id and secret separated by a colon.');
  }

  const response = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Token ${tokenId}:${tokenSecret}`, Accept: 'application/json' },
  });
  const payload = await readProviderJson(response);

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'BookStack token verification failed.');
  }

  return {
    message: `Connected to BookStack as ${payload.name ?? 'user'}.`,
    accountId: payload.id != null ? String(payload.id) : connection?.accountId ?? null,
    accountEmail: payload.email ?? null,
    profile: {
      name: payload.name ?? null,
      handle: payload.slug ?? null,
    },
  };
}

export async function dispatchRuntimeTest(service, definition, args) {
  if (!definition?.integrationRuntime) {
    return null;
  }
  const rt = definition.integrationRuntime;

  switch (rt) {
    case 'bluesky':
      return testBluesky(args);
    case 'github_social':
      return testGithubSocial(args);
    case 'webhook_alias':
      return testWebhookAlias(args);
    case 'text_hook':
      return testWebhookAlias(args);
    case 'discord_hook':
      return testWebhookAlias(args);
    case 'line_channel':
      return testLineChannel(args);
    case 'email_provider':
      return testTransactionalEmail(definition, args);
    case 'sharepoint_files':
      return testSharepointFiles(args);
    case 'nextcloud_webdav':
      return testNextcloudWebdav(args);
    case 'webdav_storage':
      return testWebdavStorage(args);
    case 'gitlab_pat':
      return testGitlabPat(args);
    case 'figma_pat':
      return testFigmaPat(args);
    case 'bitbucket_basic':
      return testBitbucketBasic(args);
    case 'outline_wiki':
      return testOutlineKnowledge(args);
    case 'confluence_wiki':
      return testConfluenceWiki(args);
    case 'coda_wiki':
      return testCodaWiki(args);
    case 'bookstack_wiki':
      return testBookstackWiki(args);
    default:
      return null;
  }
}

export async function dispatchRuntimePublish(service, definition, ctx) {
  if (!definition?.integrationRuntime) {
    return null;
  }
  const rt = definition.integrationRuntime;

  switch (rt) {
    case 'bluesky':
      return publishBluesky(ctx);
    case 'github_social':
      return publishGithubSocial(ctx);
    case 'webhook_alias':
      return publishWebhookAlias({ service, ...ctx });
    case 'text_hook':
      return publishTextHook(ctx);
    case 'discord_hook':
      return publishDiscordHook(ctx);
    case 'line_channel':
      return publishLineChannel(ctx);
    case 'email_provider':
      return publishTransactionalEmail(definition, ctx);
    default:
      return null;
  }
}
