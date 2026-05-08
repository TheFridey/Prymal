/**
 * Slack post actions.
 * Requires an active Slack OAuth integration on the org.
 */
import { getOAuthToken } from './oauth-tokens.js';
import { recordProductEvent } from '../telemetry.js';

/**
 * Post a message to a Slack channel.
 * @param {object} payload - { channel, text, blocks?, threadTs? }
 * @param {object} context - { orgId, userId, workflowId? }
 * @returns {{ ts, channel, messageUrl }}
 */
export async function postMessage(payload, context) {
  const { channel, text, blocks, threadTs } = payload;
  const { orgId, userId, workflowId } = context;

  const accessToken = await getOAuthToken(orgId, 'slack');

  const body = {
    channel,
    text,
    ...(blocks ? { blocks } : {}),
    ...(threadTs ? { thread_ts: threadTs } : {}),
  };

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!data.ok) {
    const error = new Error(`Slack API error: ${data.error ?? 'unknown'}`);
    error.code = 'SLACK_API_ERROR';
    throw error;
  }

  const messageUrl = data.ts && channel
    ? `https://slack.com/archives/${channel}/p${data.ts.replace('.', '')}`
    : null;

  await recordProductEvent({
    orgId,
    userId,
    eventName: 'action_executed',
    metadata: {
      actionType: 'slack.post',
      workflowId,
      channel,
    },
  }).catch(() => {});

  return {
    ts: data.ts,
    channel: data.channel,
    messageUrl,
  };
}

/**
 * Post a reply to an existing Slack thread.
 * @param {object} payload - { channel, threadTs, text }
 * @param {object} context - { orgId, userId }
 * @returns {{ ts, channel, messageUrl }}
 */
export async function postReply(payload, context) {
  return postMessage({ ...payload, threadTs: payload.threadTs }, context);
}
