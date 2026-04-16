import { getAuth } from '@hono/clerk-auth';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, organisations, users } from '../db/schema.js';
import { consumeCredits, creditsRemaining } from '../services/entitlements.js';
import { getStaffRole, hasStaffPermission, isStaffUser, listStaffPermissions } from '../services/staff.js';

export async function requireOrg(context, next) {
  const auth = getAuth(context);

  if (!auth?.userId) {
    return context.json({ error: 'Unauthorised' }, 401);
  }

  let user;
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
  } catch (error) {
    console.error('[AUTH] Database lookup failed in requireOrg:', error?.message ?? error);
    return context.json({ error: 'Database unavailable. Please retry shortly.' }, 503);
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
    console.error('[AUTH] Organisation lookup failed in requireOrg:', error?.message ?? error);
    return context.json({ error: 'Database unavailable. Please retry shortly.' }, 503);
  }

  if (!organisation) {
    return context.json({ error: 'Organisation not found.' }, 403);
  }

  context.set('org', {
    userId: user.id,
    userRole: user.role,
    orgId: organisation.id,
    orgPlan: organisation.plan,
    orgName: organisation.name,
    seatLimit: organisation.seatLimit,
    orgMetadata: organisation.metadata ?? {},
    credits: creditsRemaining(organisation),
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
    return context.json({ error: 'Unauthorised' }, 401);
  }

  let user;
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });
  } catch (error) {
    console.error('[AUTH] Database lookup failed in requireStaff:', error?.message ?? error);
    return context.json({ error: 'Database unavailable. Please retry shortly.' }, 503);
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
    credits: creditsRemaining(organisation),
  });

  await next();
}

export async function deductCredits(orgId, credits) {
  try {
    await consumeCredits(orgId, credits);
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
