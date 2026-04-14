import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organisationFeatureFlags } from '../db/schema.js';

export async function getOrgFeatureFlags(orgId) {
  if (!orgId) {
    return [];
  }

  return db.query.organisationFeatureFlags.findMany({
    where: eq(organisationFeatureFlags.orgId, orgId),
  });
}

export async function isOrgFeatureEnabled(orgId, flagKey, fallback = false) {
  if (!orgId || !flagKey) {
    return fallback;
  }

  const flag = await db.query.organisationFeatureFlags.findFirst({
    where: and(eq(organisationFeatureFlags.orgId, orgId), eq(organisationFeatureFlags.flagKey, flagKey)),
  });

  if (!flag) {
    return fallback;
  }

  return Boolean(flag.enabled);
}
