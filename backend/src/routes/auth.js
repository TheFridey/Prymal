import { getAuth } from '@hono/clerk-auth';
import { zValidator } from '@hono/zod-validator';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { Webhook } from 'svix';
import { z } from 'zod';
import { db } from '../db/index.js';
import { apiKeys, conversations, emailQueue, organisationInvitations, organisations, referralCodes, referrals, users } from '../db/schema.js';
import { requireOrg, requireRole } from '../middleware/auth.js';
import { sendInvitationEmail, sendWelcomeEmail } from '../services/email.js';
import { getPlanConfig } from '../services/entitlements.js';
import { normalizeOrgAiControls } from '../services/model-policy.js';
import { getStaffRole, isStaffUser, listStaffPermissions } from '../services/staff.js';
import { recordAuditLog, recordProductEvent } from '../services/telemetry.js';
import { assertSeatCapacity, getSeatSnapshot, isInvitationExpired, normalizeEmail } from '../services/team.js';

const router = new Hono();

const workspaceFocusEnum = z.enum(['agency', 'owner_led', 'service_business', 'other']);

const onboardSchema = z.object({
  orgName: z.string().trim().min(2).max(80).optional(),
  businessType: z.string().trim().max(80).optional(),
  primaryGoal: z.string().trim().max(160).optional(),
  workspaceFocus: workspaceFocusEnum.optional(),
  inviteToken: z.string().trim().min(10).max(240).optional(),
  referralCode: z.string().trim().min(4).max(20).optional(),
});

const invitationCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const invitationAcceptSchema = z.object({
  token: z.string().trim().min(10).max(240),
});

const memberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  scopes: z.array(z.enum(['read', 'write'])).min(1).max(2).default(['read', 'write']),
});

const modelControlsSchema = z.object({
  providerPreference: z.enum(['auto', 'anthropic', 'openai', 'google']).default('auto'),
  reasoningTier: z.enum(['auto', 'balanced', 'high', 'cost_saver']).default('auto'),
  fastLane: z.enum(['auto', 'anthropic_fast', 'openai_router', 'gemini_flash']).default('auto'),
  budgetCap: z.object({
    maxCostUsdPerRun: z.number().positive().max(100).nullable().optional(),
    maxOutputTokensPerRun: z.number().int().positive().max(500_000).nullable().optional(),
  }).default({}),
  spendThresholds: z.object({
    warnUsdMonthly: z.number().positive().max(100_000).nullable().optional(),
    hardCapUsdMonthly: z.number().positive().max(100_000).nullable().optional(),
  }).default({}),
  failoverOrder: z.array(z.enum(['anthropic', 'openai', 'google'])).max(3).default([]),
  experimentationEnabled: z.boolean().default(false),
}).superRefine((value, context) => {
  if (new Set(value.failoverOrder).size !== value.failoverOrder.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['failoverOrder'],
      message: 'Failover order cannot contain duplicate providers.',
    });
  }

  const warn = value.spendThresholds.warnUsdMonthly ?? null;
  const hardCap = value.spendThresholds.hardCapUsdMonthly ?? null;
  if (warn != null && hardCap != null && warn > hardCap) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['spendThresholds', 'warnUsdMonthly'],
      message: 'Warning threshold cannot exceed the hard monthly cap.',
    });
  }
});

router.post('/webhook/clerk', async (context) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return context.json({ error: 'Webhook not configured' }, 500);
  }

  const payload = await context.req.text();
  const headers = {
    'svix-id': context.req.header('svix-id') ?? '',
    'svix-timestamp': context.req.header('svix-timestamp') ?? '',
    'svix-signature': context.req.header('svix-signature') ?? '',
  };

  let event;

  try {
    event = new Webhook(webhookSecret).verify(payload, headers);
  } catch {
    return context.json({ error: 'Invalid webhook signature' }, 400);
  }

  const { type, data } = event;
  const primaryEmail =
    data?.email_addresses?.find((entry) => entry.id === data.primary_email_address_id)?.email_address ?? '';

  if (type === 'user.created' || type === 'user.updated') {
    await db
      .insert(users)
      .values({
        id: data.id,
        email: normalizeEmail(primaryEmail || `${data.id}@placeholder.invalid`),
        firstName: data.first_name ?? null,
        lastName: data.last_name ?? null,
        avatarUrl: data.image_url ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: normalizeEmail(primaryEmail || `${data.id}@placeholder.invalid`),
          firstName: data.first_name ?? null,
          lastName: data.last_name ?? null,
          avatarUrl: data.image_url ?? null,
          updatedAt: new Date(),
        },
      });
  }

  if (type === 'user.deleted' && data?.id) {
    await db.delete(users).where(eq(users.id, data.id));
  }

  return context.json({ received: true });
});

router.post('/onboard', zValidator('json', onboardSchema), async (context) => {
  const auth = getAuth(context);

  if (!auth?.userId) {
    return context.json({ error: 'Unauthorised' }, 401);
  }

  const payload = context.req.valid('json');
  const user = await bootstrapUser(auth);

  if (payload.inviteToken) {
    const accepted = await acceptInvitationForUser({
      token: payload.inviteToken,
      auth,
      existingUser: user,
    });

    return context.json({ organisation: accepted.organisation, invitation: accepted.invitation }, 200);
  }

  if (user.orgId) {
    const organisation = await db.query.organisations.findFirst({
      where: eq(organisations.id, user.orgId),
    });

    return context.json(
      {
        organisation,
        message: 'User already belongs to an organisation.',
      },
      200,
    );
  }

  if (!payload.orgName?.trim()) {
    return context.json({ error: 'Organisation name is required.' }, 400);
  }

  const slug = await ensureUniqueSlug(slugify(payload.orgName));
  const planConfig = getPlanConfig('free');
  const metadata = buildOrganisationMetadata(payload);
  const [organisation] = await db
    .insert(organisations)
    .values({
      name: payload.orgName.trim(),
      slug,
      plan: 'free',
      monthlyCreditLimit: planConfig.monthlyCreditLimit,
      seatLimit: planConfig.seatLimit,
      metadata,
    })
    .returning();

  await db
    .update(users)
    .set({
      orgId: organisation.id,
      role: 'owner',
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.userId));

  await Promise.all([
    recordProductEvent({
      orgId: organisation.id,
      userId: auth.userId,
      eventName: 'organisation.created',
      metadata,
    }),
    recordProductEvent({
      orgId: organisation.id,
      userId: auth.userId,
      eventName: 'onboarding.completed',
      metadata: {
        mode: 'create',
        workspaceFocus: metadata.workspaceFocus ?? null,
      },
    }),
    recordAuditLog({
      orgId: organisation.id,
      actorUserId: auth.userId,
      action: 'organisation.created',
      targetType: 'organisation',
      targetId: organisation.id,
      metadata,
    }),
  ]);

  // Trigger onboarding email sequence — fire-and-forget, never block the response
  const userEmail =
    auth.sessionClaims?.email ??
    auth.sessionClaims?.email_address ??
    null;
  const firstName = auth.sessionClaims?.given_name ?? null;
  const recommendedAgentId = getRecommendedAgentIdForOrg(metadata);
  const recommendedAgentName = AGENT_DISPLAY_NAMES[recommendedAgentId] ?? recommendedAgentId;

  if (userEmail) {
    // Day 0 — send immediately
    sendWelcomeEmail(userEmail, {
      firstName,
      orgName: organisation.name,
      recommendedAgentId,
      recommendedAgentName,
    }).catch((error) => {
      console.error('[EMAIL] Welcome email failed:', error.message);
    });

    // Day 3 and Day 7 — queue for later delivery
    const day3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const day7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    db.insert(emailQueue)
      .values([
        {
          toEmail: userEmail,
          templateName: 'onboarding_day3',
          payload: { firstName, orgName: organisation.name },
          sendAfter: day3,
        },
        {
          toEmail: userEmail,
          templateName: 'onboarding_day7',
          payload: { firstName, orgName: organisation.name },
          sendAfter: day7,
        },
      ])
      .catch((error) => {
        console.error('[EMAIL] Queue insert failed:', error.message);
      });
  }

  // Apply referral if a referral code was supplied during onboarding — fire-and-forget
  if (payload.referralCode && userEmail) {
    applyReferral({
      referralCode: payload.referralCode,
      refereeEmail: userEmail,
      refereeOrgId: organisation.id,
    }).catch((error) => {
      console.error('[REFERRAL] Apply failed:', error.message);
    });
  }

  return context.json({ organisation }, 201);
});

router.post('/invitations/accept', zValidator('json', invitationAcceptSchema), async (context) => {
  const auth = getAuth(context);

  if (!auth?.userId) {
    return context.json({ error: 'Unauthorised' }, 401);
  }

  const existingUser = await bootstrapUser(auth);
  const { token } = context.req.valid('json');
  const accepted = await acceptInvitationForUser({
    token,
    auth,
    existingUser,
  });

  return context.json({ organisation: accepted.organisation, invitation: accepted.invitation }, 200);
});

router.get('/me', requireOrg, async (context) => {
  const org = context.get('org');
  const [user, organisation, seatSummary, conversationStats] = await Promise.all([
    db.query.users.findFirst({
      where: and(eq(users.id, org.userId), eq(users.orgId, org.orgId)),
    }),
    db.query.organisations.findFirst({
      where: eq(organisations.id, org.orgId),
    }),
    getSeatSnapshot(org.orgId),
    db
      .select({ count: count() })
      .from(conversations)
      .where(and(eq(conversations.orgId, org.orgId), eq(conversations.userId, org.userId))),
  ]);

  if (user) {
    await db
      .update(users)
      .set({
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  return context.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          role: user.role,
        }
      : null,
    staff: {
      isStaff: isStaffUser(user),
      role: getStaffRole(user),
      permissions: listStaffPermissions(getStaffRole(user)),
    },
    organisation: {
      id: org.orgId,
      name: org.orgName,
      plan: org.orgPlan,
      seatLimit: organisation?.seatLimit ?? org.seatLimit ?? 1,
      metadata: organisation?.metadata ?? org.orgMetadata ?? {},
    },
    team: {
      canManage: ['owner', 'admin'].includes(org.userRole),
      seats: seatSummary,
    },
    stats: {
      conversationCount: Number(conversationStats[0]?.count ?? 0),
    },
    credits: org.credits,
  });
});

router.get('/organisation/model-controls', requireOrg, async (context) => {
  const org = context.get('org');

  return context.json({
    controls: normalizeOrgAiControls(org.orgMetadata ?? {}),
    role: org.userRole,
    canManage: ['owner', 'admin'].includes(org.userRole),
  });
});

router.patch(
  '/organisation/model-controls',
  requireOrg,
  requireRole('owner', 'admin'),
  zValidator('json', modelControlsSchema),
  async (context) => {
    const org = context.get('org');
    const payload = context.req.valid('json');
    const organisation = await db.query.organisations.findFirst({
      where: eq(organisations.id, org.orgId),
    });

    if (!organisation) {
      return context.json({ error: 'Organisation not found.' }, 404);
    }

    const nextControls = normalizeOrgAiControls({ aiControls: payload });
    const nextMetadata = {
      ...(organisation.metadata ?? {}),
      aiControls: nextControls,
    };

    await db
      .update(organisations)
      .set({
        metadata: nextMetadata,
        updatedAt: new Date(),
      })
      .where(eq(organisations.id, org.orgId));

    await Promise.all([
      recordAuditLog({
        orgId: org.orgId,
        actorUserId: org.userId,
        action: 'organisation.model_controls.updated',
        targetType: 'organisation',
        targetId: org.orgId,
        metadata: {
          before: normalizeOrgAiControls(organisation.metadata ?? {}),
          after: nextControls,
        },
      }),
      recordProductEvent({
        orgId: org.orgId,
        userId: org.userId,
        eventName: 'organisation.model_controls.updated',
        metadata: {
          providerPreference: nextControls.providerPreference,
          reasoningTier: nextControls.reasoningTier,
          experimentationEnabled: nextControls.experimentationEnabled,
        },
      }),
    ]);

    return context.json({
      controls: nextControls,
      updatedAt: new Date().toISOString(),
    });
  },
);

router.get('/team', requireOrg, async (context) => {
  const org = context.get('org');
  const [members, invitations, seatSummary] = await Promise.all([
    db.query.users.findMany({
      where: eq(users.orgId, org.orgId),
      orderBy: [asc(users.createdAt)],
    }),
    db.query.organisationInvitations.findMany({
      where: eq(organisationInvitations.orgId, org.orgId),
      orderBy: [desc(organisationInvitations.createdAt)],
    }),
    getSeatSnapshot(org.orgId),
  ]);

  const normalizedInvitations = await expireStaleInvitations(invitations);

  return context.json({
    role: org.userRole,
    canManage: ['owner', 'admin'].includes(org.userRole),
    seats: seatSummary,
    members: members.map((member) => ({
      id: member.id,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      avatarUrl: member.avatarUrl,
      role: member.role,
      createdAt: member.createdAt,
      lastSeenAt: member.lastSeenAt,
      isCurrentUser: member.id === org.userId,
    })),
    invitations: normalizedInvitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      seatCount: invitation.seatCount,
      tokenPreview: invitation.tokenPreview,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    })),
  });
});

router.post('/team/invitations', requireOrg, requireRole('owner', 'admin'), zValidator('json', invitationCreateSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');
  const email = normalizeEmail(payload.email);

  await assertSeatCapacity(org.orgId);

  const existingMember = await db.query.users.findFirst({
    where: and(eq(users.orgId, org.orgId), eq(users.email, email)),
  });

  if (existingMember) {
    return context.json({ error: 'This email already belongs to a member in the workspace.' }, 409);
  }

  const existingInvite = await db.query.organisationInvitations.findFirst({
    where: and(
      eq(organisationInvitations.orgId, org.orgId),
      eq(organisationInvitations.email, email),
      eq(organisationInvitations.status, 'pending'),
    ),
  });

  if (existingInvite) {
    return context.json({ error: 'A pending invitation already exists for this email.' }, 409);
  }

  const { invitation, inviteUrl } = await createInvitation({
    orgId: org.orgId,
    invitedBy: org.userId,
    email,
    role: payload.role,
  });
  const delivery = await sendInvitationEmail({
    to: email,
    organisationName: org.orgName,
    inviterName: buildInviterName(context, org),
    inviteUrl,
    role: payload.role,
    expiresAt: invitation.expiresAt,
  }).catch(async (error) => {
    await recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.invitation.email_failed',
      targetType: 'organisation_invitation',
      targetId: invitation.id,
      metadata: { email, message: error.message },
    });
    return {
      delivered: false,
      provider: 'none',
      fallback: true,
      message: error.message,
    };
  });

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.invitation.sent',
      targetType: 'organisation_invitation',
      targetId: invitation.id,
      metadata: { email, role: payload.role },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'team.invitation.sent',
      metadata: { email, role: payload.role, delivered: delivery.delivered },
    }),
  ]);

  return context.json(
    {
      invitation: sanitizeInvitation(invitation),
      inviteUrl,
      delivery,
    },
    201,
  );
});

router.post('/team/invitations/:id/resend', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();
  const invitation = await db.query.organisationInvitations.findFirst({
    where: and(eq(organisationInvitations.id, id), eq(organisationInvitations.orgId, org.orgId)),
  });

  if (!invitation) {
    return context.json({ error: 'Invitation not found.' }, 404);
  }

  if (invitation.status !== 'pending') {
    return context.json({ error: 'Only pending invitations can be resent.' }, 409);
  }

  const refreshed = await refreshInvitation(invitation.id);
  const delivery = await sendInvitationEmail({
    to: invitation.email,
    organisationName: org.orgName,
    inviterName: buildInviterName(context, org),
    inviteUrl: refreshed.inviteUrl,
    role: invitation.role,
    expiresAt: refreshed.invitation.expiresAt,
  }).catch(async (error) => {
    await recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.invitation.email_failed',
      targetType: 'organisation_invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email, message: error.message },
    });
    return {
      delivered: false,
      provider: 'none',
      fallback: true,
      message: error.message,
    };
  });

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.invitation.resent',
      targetType: 'organisation_invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'team.invitation.resent',
      metadata: { email: invitation.email, delivered: delivery.delivered },
    }),
  ]);

  return context.json({
    invitation: sanitizeInvitation(refreshed.invitation),
    inviteUrl: refreshed.inviteUrl,
    delivery,
  });
});

router.delete('/team/invitations/:id', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const [revoked] = await db
    .update(organisationInvitations)
    .set({
      status: 'revoked',
      updatedAt: new Date(),
    })
    .where(and(eq(organisationInvitations.id, id), eq(organisationInvitations.orgId, org.orgId)))
    .returning();

  if (!revoked) {
    return context.json({ error: 'Invitation not found.' }, 404);
  }

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.invitation.revoked',
      targetType: 'organisation_invitation',
      targetId: revoked.id,
      metadata: { email: revoked.email },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'team.invitation.revoked',
      metadata: { email: revoked.email },
    }),
  ]);

  return context.json({ success: true });
});

router.patch('/team/members/:userId', requireOrg, requireRole('owner', 'admin'), zValidator('json', memberRoleSchema), async (context) => {
  const org = context.get('org');
  const { userId } = context.req.param();
  const payload = context.req.valid('json');

  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.orgId, org.orgId)),
  });

  if (!targetUser) {
    return context.json({ error: 'Member not found.' }, 404);
  }

  if (targetUser.id === org.userId && payload.role !== 'owner') {
    return context.json({ error: 'Use owner transfer before changing your own access.' }, 409);
  }

  if (org.userRole === 'admin') {
    if (targetUser.role !== 'member' || payload.role !== 'member') {
      return context.json({ error: 'Admins can only manage members.' }, 403);
    }
  }

  if (payload.role === 'owner') {
    if (org.userRole !== 'owner') {
      return context.json({ error: 'Only the current owner can transfer ownership.' }, 403);
    }

    await db
      .update(users)
      .set({
        role: 'admin',
        updatedAt: new Date(),
      })
      .where(eq(users.id, org.userId));
  }

  const [updated] = await db
    .update(users)
    .set({
      role: payload.role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUser.id))
    .returning();

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.member.role_changed',
      targetType: 'user',
      targetId: targetUser.id,
      metadata: { from: targetUser.role, to: payload.role },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'team.member.role_changed',
      metadata: { from: targetUser.role, to: payload.role },
    }),
  ]);

  return context.json({
    member: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    },
  });
});

router.delete('/team/members/:userId', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { userId } = context.req.param();
  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.orgId, org.orgId)),
  });

  if (!targetUser) {
    return context.json({ error: 'Member not found.' }, 404);
  }

  if (targetUser.id === org.userId) {
    return context.json({ error: 'You cannot remove yourself from the workspace here.' }, 409);
  }

  if (targetUser.role === 'owner') {
    return context.json({ error: 'Transfer ownership before removing the owner.' }, 409);
  }

  if (org.userRole === 'admin' && targetUser.role !== 'member') {
    return context.json({ error: 'Admins can only remove members.' }, 403);
  }

  await db
    .update(users)
    .set({
      orgId: null,
      role: 'member',
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUser.id));

  await Promise.all([
    recordAuditLog({
      orgId: org.orgId,
      actorUserId: org.userId,
      action: 'team.member.removed',
      targetType: 'user',
      targetId: targetUser.id,
      metadata: { email: targetUser.email, role: targetUser.role },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'team.member.removed',
      metadata: { email: targetUser.email },
    }),
  ]);

  return context.json({ success: true });
});

router.get('/api-keys', requireOrg, async (context) => {
  const org = context.get('org');
  const keys = await db.query.apiKeys.findMany({
    where: eq(apiKeys.orgId, org.orgId),
    orderBy: [desc(apiKeys.createdAt)],
  });

  return context.json({
    apiKeys: keys.map((entry) => ({
      id: entry.id,
      name: entry.name,
      keyPrefix: entry.keyPrefix,
      scopes: entry.scopes,
      lastUsedAt: entry.lastUsedAt,
      expiresAt: entry.expiresAt,
      isActive: entry.isActive,
      createdAt: entry.createdAt,
    })),
  });
});

router.post('/api-keys', requireOrg, requireRole('owner', 'admin'), zValidator('json', apiKeyCreateSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');

  if (org.orgPlan !== 'agency') {
    return context.json(
      {
        error: 'API keys are available on the Agency plan.',
        upgrade: true,
        required: 'agency',
      },
      403,
    );
  }

  const rawKey = `axm_${randomToken(40)}`;
  const keyPrefix = rawKey.slice(0, 12);
  const expiresAt = payload.expiresInDays
    ? new Date(Date.now() + payload.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db
    .insert(apiKeys)
    .values({
      orgId: org.orgId,
      createdBy: org.userId,
      name: payload.name,
      keyHash: await hashValue(rawKey),
      keyPrefix,
      scopes: payload.scopes,
      expiresAt,
    })
    .returning();

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'api_key.created',
    targetType: 'api_key',
    targetId: created.id,
    metadata: { scopes: created.scopes, name: created.name },
  });

  return context.json(
    {
      apiKey: {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        scopes: created.scopes,
        expiresAt: created.expiresAt,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
      token: rawKey,
    },
    201,
  );
});

router.delete('/api-keys/:id', requireOrg, requireRole('owner', 'admin'), async (context) => {
  const org = context.get('org');
  const { id } = context.req.param();

  const [revoked] = await db
    .update(apiKeys)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, org.orgId)))
    .returning({ id: apiKeys.id });

  if (!revoked) {
    return context.json({ error: 'API key not found.' }, 404);
  }

  await recordAuditLog({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'api_key.revoked',
    targetType: 'api_key',
    targetId: id,
  });

  return context.json({ success: true });
});

async function bootstrapUser(auth) {
  let user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
  });

  if (user) {
    return user;
  }

  const email =
    auth.sessionClaims?.email ??
    auth.sessionClaims?.email_address ??
    `${auth.userId}@placeholder.invalid`;

  [user] = await db
    .insert(users)
    .values({
      id: auth.userId,
      email: normalizeEmail(email),
      firstName: auth.sessionClaims?.given_name ?? null,
      lastName: auth.sessionClaims?.family_name ?? null,
    })
    .returning();

  return user;
}

function buildOrganisationMetadata(payload) {
  return {
    onboardingCompletedAt: new Date().toISOString(),
    businessType: payload.businessType?.trim() || null,
    primaryGoal: payload.primaryGoal?.trim() || null,
    workspaceFocus: payload.workspaceFocus ?? null,
  };
}

async function expireStaleInvitations(invitations) {
  const staleIds = invitations
    .filter((invitation) => invitation.status === 'pending' && isInvitationExpired(invitation))
    .map((invitation) => invitation.id);

  if (staleIds.length > 0) {
    await Promise.all(
      staleIds.map((id) =>
        db
          .update(organisationInvitations)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(organisationInvitations.id, id)),
      ),
    );
  }

  return invitations.map((invitation) =>
    staleIds.includes(invitation.id)
      ? { ...invitation, status: 'expired', updatedAt: new Date() }
      : invitation,
  );
}

async function createInvitation({ orgId, invitedBy, email, role }) {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [invitation] = await db
    .insert(organisationInvitations)
    .values({
      orgId,
      email,
      role,
      invitedBy,
      tokenHash: await hashValue(token),
      tokenPreview: token.slice(0, 8),
      expiresAt,
    })
    .returning();

  return {
    invitation,
    inviteUrl: buildInviteUrl(token),
  };
}

async function refreshInvitation(invitationId) {
  const token = randomToken(48);
  const [invitation] = await db
    .update(organisationInvitations)
    .set({
      tokenHash: await hashValue(token),
      tokenPreview: token.slice(0, 8),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .where(eq(organisationInvitations.id, invitationId))
    .returning();

  return {
    invitation,
    inviteUrl: buildInviteUrl(token),
  };
}

async function acceptInvitationForUser({ token, auth, existingUser }) {
  const invitation = await db.query.organisationInvitations.findFirst({
    where: eq(organisationInvitations.tokenHash, await hashValue(token)),
  });

  if (!invitation) {
    const error = new Error('Invitation not found or no longer valid.');
    error.status = 404;
    throw error;
  }

  if (invitation.status !== 'pending') {
    const error = new Error('This invitation is no longer active.');
    error.status = 409;
    throw error;
  }

  if (isInvitationExpired(invitation)) {
    await db
      .update(organisationInvitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(organisationInvitations.id, invitation.id));

    const error = new Error('This invitation has expired.');
    error.status = 410;
    throw error;
  }

  const sessionEmail = normalizeEmail(
    auth.sessionClaims?.email ??
      auth.sessionClaims?.email_address ??
      existingUser?.email ??
      `${auth.userId}@placeholder.invalid`,
  );

  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, invitation.orgId),
  });

  if (!organisation) {
    const error = new Error('Organisation not found for invitation.');
    error.status = 404;
    throw error;
  }

  assertInvitationEligibility({
    invitation,
    existingUser,
    sessionEmail,
    organisationId: organisation.id,
  });

  await db
    .update(users)
    .set({
      orgId: organisation.id,
      role: invitation.role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, existingUser.id));

  const [acceptedInvitation] = await db
    .update(organisationInvitations)
    .set({
      status: 'accepted',
      acceptedAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        acceptedBy: existingUser.id,
      },
    })
    .where(eq(organisationInvitations.id, invitation.id))
    .returning();

  await Promise.all([
    recordAuditLog({
      orgId: organisation.id,
      actorUserId: existingUser.id,
      action: 'team.invitation.accepted',
      targetType: 'organisation_invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    }),
    recordProductEvent({
      orgId: organisation.id,
      userId: existingUser.id,
      eventName: 'team.member.joined',
      metadata: { role: invitation.role },
    }),
    recordProductEvent({
      orgId: organisation.id,
      userId: existingUser.id,
      eventName: 'onboarding.completed',
      metadata: {
        mode: 'invite',
      },
    }),
  ]);

  return {
    invitation: sanitizeInvitation(acceptedInvitation),
    organisation,
  };
}

function sanitizeInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    tokenPreview: invitation.tokenPreview,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    seatCount: invitation.seatCount,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

function buildInviteUrl(token) {
  const frontendBase = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendBase}/app/onboarding?invite=${encodeURIComponent(token)}`;
}

function buildInviterName(context, org) {
  const claims = getAuth(context)?.sessionClaims ?? {};
  return [claims.given_name, claims.family_name].filter(Boolean).join(' ').trim() || org.orgName;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug || `org-${Date.now().toString(36)}`;
  let suffix = 1;

  while (await db.query.organisations.findFirst({ where: eq(organisations.slug, slug) })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

function randomToken(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function hashValue(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Maps workspace focus to recommended first agent — mirrors frontend getRecommendedAgentIdsForWorkspaceProfile
const AGENT_DISPLAY_NAMES = {
  herald: 'HERALD',
  forge: 'FORGE',
  atlas: 'ATLAS',
  wren: 'WREN',
  oracle: 'ORACLE',
  cipher: 'CIPHER',
  ledger: 'LEDGER',
};

function getRecommendedAgentIdForOrg(metadata) {
  const focus = metadata?.workspaceFocus;
  if (focus === 'agency') return 'herald';
  if (focus === 'service_business') return 'wren';
  if (focus === 'owner_led') return 'oracle';
  return 'cipher';
}

// ─── Referrals ────────────────────────────────────────────────────────────────

const REFERRAL_BONUS_CREDITS = 100;

router.get('/referral', requireOrg, async (context) => {
  const org = context.get('org');

  let referral = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.orgId, org.orgId),
  });

  if (!referral) {
    const code = generateReferralCode();
    [referral] = await db
      .insert(referralCodes)
      .values({ orgId: org.orgId, code })
      .returning();
  }

  const orgReferrals = await db.query.referrals.findMany({
    where: eq(referrals.referrerOrgId, org.orgId),
    orderBy: [desc(referrals.createdAt)],
  });

  return context.json({
    code: referral.code,
    referralUrl: `https://prymal.io/signup?ref=${referral.code}`,
    referrals: orgReferrals,
    totalBonusCredits: orgReferrals.reduce((sum, r) => sum + r.bonusCreditsAwarded, 0),
  });
});

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function applyReferral({ referralCode, refereeEmail, refereeOrgId }) {
  if (!referralCode?.trim()) return;

  const referralCode_ = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.code, referralCode.trim().toUpperCase()),
  });

  if (!referralCode_ || referralCode_.orgId === refereeOrgId) return;

  await db
    .insert(referrals)
    .values({
      referrerOrgId: referralCode_.orgId,
      refereeEmail: refereeEmail.toLowerCase(),
      refereeOrgId,
      bonusCreditsAwarded: REFERRAL_BONUS_CREDITS,
    })
    .onConflictDoNothing();

  // Award bonus credits to referrer
  await db
    .update(organisations)
    .set({
      monthlyCreditLimit: sql`${organisations.monthlyCreditLimit} + ${REFERRAL_BONUS_CREDITS}`,
    })
    .where(eq(organisations.id, referralCode_.orgId));
}

export function assertInvitationEligibility({ invitation, existingUser, sessionEmail, organisationId }) {
  if (normalizeEmail(sessionEmail) !== normalizeEmail(invitation.email)) {
    const error = new Error('Invitation email does not match the signed-in account.');
    error.status = 403;
    error.code = 'INVITATION_EMAIL_MISMATCH';
    throw error;
  }

  if (existingUser?.orgId && existingUser.orgId !== organisationId) {
    const error = new Error('This account already belongs to another organisation.');
    error.status = 409;
    error.code = 'INVITATION_CROSS_ORG_CONFLICT';
    throw error;
  }
}

export default router;
