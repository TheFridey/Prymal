import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { emailEvents } from '../../db/schema.js';

export async function findEmailEventByIdempotencyKey(idempotencyKey, { dbClient = db } = {}) {
  if (!idempotencyKey) return null;
  return dbClient.query.emailEvents.findFirst({
    where: eq(emailEvents.idempotencyKey, idempotencyKey),
  });
}

export async function recordEmailEvent({
  userId = null,
  orgId = null,
  recipient,
  emailType,
  provider = 'resend',
  providerMessageId = null,
  status,
  idempotencyKey = null,
  metadata = {},
  error = null,
  dbClient = db,
}) {
  const values = {
    userId,
    orgId,
    recipient,
    emailType,
    provider,
    providerMessageId,
    status,
    idempotencyKey,
    metadata,
    error: error ? String(error).slice(0, 2000) : null,
    sentAt: status === 'sent' ? new Date() : null,
    updatedAt: new Date(),
  };

  if (idempotencyKey) {
    const [row] = await dbClient
      .insert(emailEvents)
      .values(values)
      .onConflictDoUpdate({
        target: emailEvents.idempotencyKey,
        set: values,
      })
      .returning();
    return row;
  }

  const [row] = await dbClient.insert(emailEvents).values(values).returning();
  return row;
}
