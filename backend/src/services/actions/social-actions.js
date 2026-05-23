/**
 * Social publish actions.
 * Requires an active org-scoped integration and always runs through action approval.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { integrations } from '../../db/schema.js';
import { recordDeliveryOutcome } from '../moat-feedback.js';
import { recordAuditLog, recordProductEvent } from '../telemetry.js';
import {
  buildDeliveryMeta,
  getIntegrationDefinition,
  sanitizeIntegrationSettings,
} from '../integration-catalog.js';
import {
  getAccessToken,
  publishIntegrationPayload,
  serializeIntegrationConnection,
} from '../../routes/integrations.js';
import { sanitizeErrorForClient } from '../security/redaction.js';

const SOCIAL_PUBLISH_SERVICES = new Set([
  'linkedin',
  'slack',
  'x',
  'mastodon',
  'bluesky',
  'discord',
  'telegram',
  'line',
]);

export function isSupportedSocialPublishService(service) {
  return SOCIAL_PUBLISH_SERVICES.has(service);
}

export async function publishSocialPost(payload, context) {
  const service = String(payload?.service ?? '').trim();
  const text = String(payload?.text ?? '').trim();

  if (!service || !isSupportedSocialPublishService(service)) {
    const error = new Error('Choose a supported social or messaging integration before publishing.');
    error.code = 'SOCIAL_SERVICE_UNSUPPORTED';
    throw error;
  }

  if (!text) {
    const error = new Error('Social publishing requires post copy.');
    error.code = 'SOCIAL_TEXT_REQUIRED';
    throw error;
  }

  const definition = getIntegrationDefinition(service);
  if (!definition?.supportsPublish) {
    const error = new Error(`${definition?.name ?? service} does not support live publishing yet.`);
    error.code = 'SOCIAL_PUBLISH_UNSUPPORTED';
    throw error;
  }

  const connection = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.orgId, context.orgId),
      eq(integrations.service, service),
      eq(integrations.isActive, true),
    ),
  });

  if (!connection) {
    const error = new Error(`No active ${definition.name} integration found for this organisation.`);
    error.code = 'OAUTH_TOKEN_NOT_FOUND';
    throw error;
  }

  const serialized = serializeIntegrationConnection(connection);
  if (serialized.meta?.needsReconnect) {
    const error = new Error(serialized.meta.reconnectMessage ?? `${definition.name} must be reconnected before publishing.`);
    error.code = 'SOCIAL_RECONNECT_REQUIRED';
    throw error;
  }

  if (serialized.publishDisabled) {
    const error = new Error(
      serialized.postingNotReady
        ? `${definition.name} is connected, but posting permission is not enabled. Reconnect after approved posting access is configured.`
        : `${definition.name} is not ready for live publishing.`,
    );
    error.code = 'SOCIAL_PUBLISH_DISABLED';
    throw error;
  }

  const accessToken = await getAccessToken(context.orgId, service);
  const settings = sanitizeIntegrationSettings(service, connection.meta?.settings ?? {});
  const publishPayload = {
    text,
    title: payload.title ?? undefined,
    linkUrl: payload.linkUrl ?? undefined,
    imageUrl: payload.imageUrl ?? undefined,
    targetId: payload.targetId ?? undefined,
    messageId: payload.messageId ?? undefined,
    contentId: payload.contentId ?? undefined,
  };

  let delivery;
  try {
    delivery = await publishIntegrationPayload({
      service,
      accessToken,
      payload: publishPayload,
      settings,
      connection,
    });
  } catch (error) {
    await recordDeliveryOutcome({
      orgId: context.orgId,
      userId: context.userId,
      contentId: payload.contentId ?? null,
      messageId: payload.messageId ?? null,
      sourceAgent: payload.sourceAgent ?? 'agent',
      contentType: 'social_post',
      delivered: false,
      metadata: {
        service,
        targetId: payload.targetId ?? null,
        error: sanitizeErrorForClient(error, {
          fallback: 'Social publish failed.',
          internalFallback: 'Social publish failed.',
        }),
      },
    }).catch(() => {});
    throw error;
  }

  const nextMeta = buildDeliveryMeta(service, connection.meta ?? {}, delivery);
  nextMeta.health = {
    status: 'healthy',
    checkedAt: new Date().toISOString(),
    message: 'Last outbound publish succeeded.',
  };

  const [updated] = await db
    .update(integrations)
    .set({
      meta: nextMeta,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, connection.id))
    .returning();

  await Promise.all([
    recordDeliveryOutcome({
      orgId: context.orgId,
      userId: context.userId,
      contentId: payload.contentId ?? null,
      messageId: payload.messageId ?? null,
      sourceAgent: payload.sourceAgent ?? 'agent',
      contentType: 'social_post',
      delivered: true,
      metadata: {
        service,
        target: delivery.target ?? null,
        providerMessageId: delivery.providerMessageId ?? null,
        deliveredAt: delivery.publishedAt ?? new Date().toISOString(),
      },
    }),
    recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: 'action.social_published',
      targetType: 'integration',
      targetId: service,
      metadata: {
        target: delivery.target ?? null,
        providerMessageId: delivery.providerMessageId ?? null,
      },
    }),
    recordProductEvent({
      orgId: context.orgId,
      userId: context.userId,
      eventName: 'action.social_published',
      metadata: {
        service,
        target: delivery.target ?? null,
      },
    }),
  ].map((promise) => promise.catch(() => {})));

  return {
    service,
    delivery,
    connection: updated ? serializeIntegrationConnection(updated) : serialized,
  };
}
