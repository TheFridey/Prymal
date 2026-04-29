import { getAuth } from '@hono/clerk-auth';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, organisations, users } from '../db/schema.js';
import { applyCreditAdjustment, getBillingSnapshotForOrg } from '../services/billing-engine.js';
import {
  computeUsagePressurePayload,
  getUpgradeSuggestion,
} from '../services/usage-pressure.js';
import { getMonthlyInternalBurnCapGbp } from '../services/billing-catalog.js';
import { formatDbQueryError, summarizeDbConnectivityError } from '../db/log-db-error.js';
import { getStaffRole, hasStaffPermission, isStaffUser, listStaffPermissions } from '../services/staff.js';

function logDevSessionMissing(context, { label } = {}) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const authorization = context.req.header('Authorization') ?? '';
  const bearer = authorization.startsWith('Bearer ');
  const pkPreview = process.env.CLERK_PUBLISHABLE_KEY?.trim().slice(0, 14) ?? '(unset)';
  const hasSecretKey = Boolean(process.env.CLERK_SECRET_KEY?.trim());
  console.warn('[AUTH]', label ?? 'Clerk session', '—', context.req.method, context.req.path, {
    authorizationHeader: bearer ? 'Bearer …' : 'missing',
    clerkPublishableKeyPrefix: pkPreview,
    clerkSecretKeySet: hasSecretKey,
    hint: bearer
      ? 'JWT was sent but Clerk did not accept it — use the same Clerk app keys on backend (.env CLERK_* pairs) as the frontend VITE_CLERK_PUBLISHABLE_KEY. For regional instances set CLERK_API_URL / CLERK_API_VERSION from Clerk Dashboard → API keys. System env overrides backend/.env for CLERK_SECRET_KEY.'
      : 'No Bearer token — sign in again or confirm the SPA is sending Authorization from Clerk.',
  });
}

export async function requireOrg(context, next) {
  const auth = getAuth(context);

  if (!auth?.userId) {
    logDevSessionMissing(context, { label: 'requireOrg' });
    return context.json({ error: 'Unauthorised' }, 401);
  }

  let user;
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
  } catch (error) {
    console.error('[AUTH] Database lookup failed in requireOrg:', formatDbQueryError(error), summarizeDbConnectivityError(error));
    return context.json({ error: 'Database unavailable. Please retry shortly.', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  if (!user) {
    return context.json({ error: 'User not found. Complete onboarding first.' }, 403);
  }

  if (!user.orgId) {
    return context.json({ error: 'No organisation found. Please complete setup.' }, 403);
  }

  let organisation;
  try {
    organisation = await db.query.organisations.findFirst({
      where: eq(organisations.id, user.orgId),
    });
  } catch (error) {
    console.error('[AUTH] Organisation lookup failed in requireOrg:', formatDbQueryError(error), summarizeDbConnectivityError(error));
    return context.json({ error: 'Database unavailable. Please retry shortly.', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  if (!organisation) {
    return context.json({ error: 'Organisation not found.' }, 403);
  }

  const billingSnapshot = await getBillingSnapshotForOrg(organisation.id).catch((error) => {
    console.error('[AUTH] Billing snapshot lookup failed in requireOrg:', error?.message ?? error);
    return null;
  });

  let monetisationBrief = null;
  if (billingSnapshot?.subscription && billingSnapshot?.credits?.execution && billingSnapshot?.credits?.video) {
    const est = Number(billingSnapshot.subscription.cumulativeEstimatedCostGbp ?? 0);
    monetisationBrief = {
      usagePressure: computeUsagePressurePayload(
        billingSnapshot.credits.execution,
        billingSnapshot.credits.video,
        {
          estimatedProviderCostGbpThisCycle: est,
          planKey: organisation.plan,
        },
      ),
      upgradeSuggestions: {
        execution: getUpgradeSuggestion(organisation.plan, 'execution'),
        video: getUpgradeSuggestion(organisation.plan, 'video'),
      },
      internalBurnCapGbp: getMonthlyInternalBurnCapGbp(organisation.plan),
    };
  }

  context.set('org', {
    userId: user.id,
    userRole: user.role,
    orgId: organisation.id,
    orgPlan: organisation.plan,
    orgName: organisation.name,
    seatLimit: organisation.seatLimit,
    orgMetadata: organisation.metadata ?? {},
    credits: billingSnapshot?.credits ?? {
      remaining: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
      limit: organisation.monthlyCreditLimit ?? 0,
      used: organisation.creditsUsed ?? 0,
      execution: {
        available: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
        committedThisCycle: organisation.creditsUsed ?? 0,
        includedAvailable: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
        purchasedAvailable: 0,
        reserved: 0,
        percentUsed: organisation.monthlyCreditLimit > 0
          ? Math.min(((organisation.creditsUsed ?? 0) / organisation.monthlyCreditLimit) * 100, 100)
          : 0,
        threshold: null,
      },
      video: {
        available: 0,
        committedThisCycle: 0,
        includedAvailable: 0,
        purchasedAvailable: 0,
        reserved: 0,
        percentUsed: 0,
        threshold: null,
      },
    },
    monetisationBrief,
  });

  await next();
}

export function requirePlan(...allowedPlans) {
  return async (context, next) => {
    const org = context.get('org');

    if (!allowedPlans.includes(org.orgPlan)) {
      return context.json(
        {
          error: `This feature requires a ${allowedPlans.join(' or ')} plan.`,
          upgrade: true,
          required: allowedPlans[0],
          current: org.orgPlan,
        },
        403,
      );
    }

    await next();
  };
}

export function requireRole(...allowedRoles) {
  return async (context, next) => {
    const org = context.get('org');

    if (!org?.userRole || !allowedRoles.includes(org.userRole)) {
      return context.json(
        {
          error: `This action requires ${allowedRoles.join(' or ')} access.`,
          code: 'INSUFFICIENT_ROLE',
        },
        403,
      );
    }

    await next();
  };
}

export async function requireStaff(context, next) {
  const auth = getAuth(context);

  if (!auth?.userId) {
    logDevSessionMissing(context, { label: 'requireStaff' });
    return context.json({ error: 'Unauthorised' }, 401);
  }

  let user;
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
  } catch (error) {
    console.error('[AUTH] Database lookup failed in requireStaff:', formatDbQueryError(error), summarizeDbConnectivityError(error));
    return context.json({ error: 'Database unavailable. Please retry shortly.', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  if (!user) {
    return context.json({ error: 'User not found.' }, 404);
  }

  if (!isStaffUser(user)) {
    return context.json(
      {
        error: 'This area is restricted to Prymal staff.',
        code: 'STAFF_ONLY',
      },
      403,
    );
  }

  const staffRole = getStaffRole(user);

  context.set('staff', {
    userId: user.id,
    email: user.email,
    role: user.role,
    staffRole,
    permissions: listStaffPermissions(staffRole),
    isStaff: true,
  });

  await next();
}

export function requireStaffPermission(permission) {
  return async (context, next) => {
    const staff = context.get('staff');

    if (!hasStaffPermission(staff, permission)) {
      return context.json(
        {
          error: 'This admin action is outside your Prymal staff permissions.',
          code: 'STAFF_PERMISSION_DENIED',
          permission,
        },
        403,
      );
    }

    await next();
  };
}

export async function requireApiKey(context, next) {
  const authHeader = context.req.header('Authorization') ?? '';
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!rawKey) {
    return context.json({ error: 'API key required' }, 401);
  }

  const keyHash = await hashKey(rawKey);
  const keyRecord = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)),
  });

  if (!keyRecord) {
    return context.json({ error: 'Invalid or inactive API key' }, 401);
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return context.json({ error: 'API key has expired' }, 401);
  }

  const organisation = await db.query.organisations.findFirst({
    where: eq(organisations.id, keyRecord.orgId),
  });

  if (!organisation) {
    return context.json({ error: 'Organisation not found for API key' }, 401);
  }

  const billingSnapshot = await getBillingSnapshotForOrg(organisation.id).catch(() => null);

  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyRecord.id));

  context.set('org', {
    userId: keyRecord.createdBy ?? null,
    userRole: null,
    orgId: organisation.id,
    orgPlan: organisation.plan,
    orgName: organisation.name,
    apiKeyId: keyRecord.id,
    seatLimit: organisation.seatLimit,
    orgMetadata: organisation.metadata ?? {},
    credits: billingSnapshot?.credits ?? {
      remaining: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
      limit: organisation.monthlyCreditLimit ?? 0,
      used: organisation.creditsUsed ?? 0,
      execution: {
        available: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
        committedThisCycle: organisation.creditsUsed ?? 0,
        includedAvailable: Math.max((organisation.monthlyCreditLimit ?? 0) - (organisation.creditsUsed ?? 0), 0),
        purchasedAvailable: 0,
        reserved: 0,
        percentUsed: organisation.monthlyCreditLimit > 0
          ? Math.min(((organisation.creditsUsed ?? 0) / organisation.monthlyCreditLimit) * 100, 100)
          : 0,
        threshold: null,
      },
      video: {
        available: 0,
        committedThisCycle: 0,
        includedAvailable: 0,
        purchasedAvailable: 0,
        reserved: 0,
        percentUsed: 0,
        threshold: null,
      },
    },
  });

  await next();
}

export async function deductCredits(orgId, credits) {
  try {
    await applyCreditAdjustment({
      orgId,
      creditType: 'execution',
      delta: -Math.abs(credits),
      source: 'burn',
      entryType: 'legacy_commit',
      metadata: {
        route: 'auth.middleware',
      },
    });
  } catch (error) {
    console.error('[AUTH] Credit deduction failed:', error.message);
  }
}

async function hashKey(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('');
}
