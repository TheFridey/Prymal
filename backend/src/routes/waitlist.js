import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { waitlistEntries } from '../db/schema.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { sendWaitlistConfirmationEmail } from '../services/email.js';

const router = new Hono();

// 5 requests per IP per 15 minutes
const waitlistLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many waitlist requests. Please try again later.',
});

router.use('/', waitlistLimiter);

const waitlistSchema = z.object({
  email: z.string().trim().email(),
  source: z.string().trim().min(2).max(80).optional(),
});

router.post('/', zValidator('json', waitlistSchema), async (context) => {
  const payload = context.req.valid('json');
  const email = payload.email.trim().toLowerCase();
  const source = payload.source?.trim() || 'landing';

  const existing = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.email, email),
  });

  if (existing) {
    return context.json({ error: 'That email is already on the waitlist.' }, 409);
  }

  const [entry] = await db
    .insert(waitlistEntries)
    .values({
      email,
      source,
    })
    .returning();

  // Fire-and-forget confirmation email — never block the 201 response
  sendWaitlistConfirmationEmail(entry.email).catch((error) => {
    console.error('[EMAIL] Waitlist confirmation failed:', error.message);
  });

  return context.json({
    waitlist: {
      id: entry.id,
      email: entry.email,
      source: entry.source,
      createdAt: entry.createdAt,
    },
  }, 201);
});

export default router;
