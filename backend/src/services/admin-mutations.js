import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminActionLogs } from '../db/schema.js';

const MAX_IDEMPOTENCY_KEY_LENGTH = 120;

export function getAdminMutationMeta(context) {
  const idempotencyKey = normalizeIdempotencyKey(
    context.req.header('idempotency-key') ?? context.req.header('x-idempotency-key') ?? '',
  );

  return {
    requestId: context.get('requestId') ?? null,
    idempotencyKey,
  };
}

export async function findAdminMutationReplay({ actorUserId, action, idempotencyKey }) {
  if (!actorUserId || !action || !idempotencyKey) {
    return null;
  }

  return db.query.adminActionLogs.findFirst({
    where: and(
      eq(adminActionLogs.actorUserId, actorUserId),
      eq(adminActionLogs.action, action),
      eq(adminActionLogs.idempotencyKey, idempotencyKey),
    ),
  });
}

function normalizeIdempotencyKey(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
}
