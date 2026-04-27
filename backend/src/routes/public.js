import { getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { foundingAccessClaims, organisations, subscriptions, users } from '../db/schema.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import {
  FOUNDING_ACCESS_OFFER_KEY,
  createFoundingAccessLead,
  getFoundingAccessState,
  serializePublicFoundingAccessOffer,
} from '../services/founding-access.js';
import { recordProductEvent } from '../services/telemetry.js';

const router = new Hono();

const leadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Too many Founding Access requests. Please try again later.',
});

const leadSchema = z.object({
  email: z.string().trim().email(),
  source: z.enum(['exit_intent', 'delayed_popup', 'pricing_banner']).optional().default('pricing_banner'),
  metadata: z.record(z.any()).optional().default({}),
});

router.get('/offers/founding-access', async (context) => {
  const state = await getFoundingAccessState();
  const viewer = await resolveOfferViewer(context).catch(() => null);

  await recordProductEvent({
    orgId: viewer?.orgId ?? null,
    userId: viewer?.userId ?? null,
    eventName: 'offer_viewed',
    metadata: { offerKey: FOUNDING_ACCESS_OFFER_KEY, surface: 'public_endpoint' },
  });

  return context.json(serializePublicFoundingAccessOffer(state, viewer));
});

router.post('/offers/founding-access/leads', leadLimiter, zValidator('json', leadSchema), async (context) => {
  const payload = context.req.valid('json');
  const viewer = await resolveOfferViewer(context).catch(() => null);
  const state = await getFoundingAccessState();

  if (!state.active) {
    return context.json({ error: 'Founding Access is no longer available.' }, 410);
  }

  const lead = await createFoundingAccessLead({
    email: payload.email,
    source: payload.source,
    convertedUserId: viewer?.userId ?? null,
    metadata: {
      ...payload.metadata,
      userAgent: context.req.header('user-agent') ?? null,
    },
  });

  return context.json({
    lead: {
      id: lead.id,
      email: lead.email,
      source: lead.source,
      createdAt: lead.createdAt,
    },
    message: 'You are on the Founding Access list. Create your account to claim it while access remains open.',
  }, 201);
});

async function resolveOfferViewer(context) {
  const auth = getAuth(context);
  const userId = auth?.userId ?? null;

  if (!userId) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.orgId) {
    return { userId, orgId: null, isPayingSubscriber: false, hasFoundingAccess: false };
  }

  const [organisation, subscription, claim] = await Promise.all([
    db.query.organisations.findFirst({
      where: eq(organisations.id, user.orgId),
    }),
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.orgId, user.orgId),
    }),
    db.query.foundingAccessClaims.findFirst({
      where: and(
        eq(foundingAccessClaims.offerKey, FOUNDING_ACCESS_OFFER_KEY),
        eq(foundingAccessClaims.orgId, user.orgId),
      ),
    }),
  ]);

  const plan = organisation?.plan ?? 'free';
  const isPayingSubscriber = plan !== 'free' && ['active', 'trialing', 'past_due'].includes(subscription?.status ?? 'active');

  return {
    userId,
    orgId: user.orgId,
    isPayingSubscriber,
    hasFoundingAccess: ['claimed', 'active'].includes(claim?.status),
  };
}

export default router;
