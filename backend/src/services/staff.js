const STAFF_ROLES = ['support', 'ops', 'finance', 'superadmin'];

const STAFF_PERMISSIONS = {
  support: new Set([
    'admin.view',
    'admin.org.read',
    'admin.user.read',
    'admin.billing.read',
    'admin.activity.read',
    'admin.workflow.read',
    'admin.integration.read',
    'admin.waitlist.read',
  ]),
  ops: new Set([
    'admin.view',
    'admin.org.read',
    'admin.org.update',
    'admin.org.timeline',
    'admin.org.flags.read',
    'admin.org.flags.write',
    'admin.user.read',
    'admin.user.update',
    'admin.billing.read',
    'admin.activity.read',
    'admin.workflow.read',
    'admin.workflow.replay',
    'admin.integration.read',
    'admin.waitlist.read',
    'admin.credits.read',
    'admin.credits.adjust',
    'admin.memory.prune',
    'admin.powerups.manage',
    'admin.email.process',
  ]),
  finance: new Set([
    'admin.view',
    'admin.org.read',
    'admin.user.read',
    'admin.billing.read',
    'admin.billing.write',
    'admin.activity.read',
    'admin.waitlist.read',
    'admin.credits.read',
    'admin.credits.adjust',
  ]),
  superadmin: new Set(['*']),
};

function parseList(value) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getEnvIdentitySet(prefix, suffix) {
  return new Set(parseList(process.env[`${prefix}_${suffix}`]).map((value) => value.toLowerCase()));
}

function matchesIdentity(user, ids, emails) {
  if (!user) {
    return false;
  }

  if (user.id && ids.has(user.id.toLowerCase())) {
    return true;
  }

  if (user.email && emails.has(user.email.toLowerCase())) {
    return true;
  }

  return false;
}

function getLegacyStaffIds() {
  return new Set(parseList(process.env.STAFF_USER_IDS).map((value) => value.toLowerCase()));
}

function getLegacyStaffEmails() {
  return new Set(parseList(process.env.STAFF_EMAILS).map((value) => value.toLowerCase()));
}

export function getStaffRole(user) {
  if (!user) {
    return null;
  }

  const identity = {
    id: user.id?.toLowerCase() ?? null,
    email: user.email?.toLowerCase() ?? null,
  };

  if (matchesIdentity(identity, getLegacyStaffIds(), getLegacyStaffEmails())) {
    return 'superadmin';
  }

  for (const role of [...STAFF_ROLES].reverse()) {
    const ids = getEnvIdentitySet(`STAFF_${role.toUpperCase()}`, 'USER_IDS');
    const emails = getEnvIdentitySet(`STAFF_${role.toUpperCase()}`, 'EMAILS');

    if (matchesIdentity(identity, ids, emails)) {
      return role;
    }
  }

  return null;
}

export function isStaffUser(user) {
  return Boolean(getStaffRole(user));
}

export function hasStaffPermission(staff, permission) {
  if (!staff?.staffRole || !permission) {
    return false;
  }

  const permissions = STAFF_PERMISSIONS[staff.staffRole];

  if (!permissions) {
    return false;
  }

  return permissions.has('*') || permissions.has(permission);
}

export function assertStaffPermission(staff, permission) {
  if (hasStaffPermission(staff, permission)) {
    return;
  }

  const error = new Error('This admin action is outside your Prymal staff permissions.');
  error.status = 403;
  error.code = 'STAFF_PERMISSION_DENIED';
  error.permission = permission;
  throw error;
}

export function listStaffPermissions(role) {
  return [...(STAFF_PERMISSIONS[role] ?? [])];
}
