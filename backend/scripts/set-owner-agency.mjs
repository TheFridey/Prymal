#!/usr/bin/env node
/**
 * One-off: set a user's role to owner and move their organisation to the agency plan
 * (matches billing-engine setSubscriptionPlan — org plan, seat/credit limits, subscription balances).
 *
 * Usage (from backend/, with .env + DATABASE_URL):
 *   node scripts/set-owner-agency.mjs --contains PD9E4M
 *   node scripts/set-owner-agency.mjs --contains Rhys
 *   node scripts/set-owner-agency.mjs --email you@domain.com
 *   node scripts/set-owner-agency.mjs --user-id user_xxxxxxxxxxxxx
 */

import { eq, ilike, or } from 'drizzle-orm';
import { loadBackendEnv } from '../src/env/parse.js';

function parseArgs(argv) {
  const flags = new Set();
  let userId = null;
  let email = null;
  let contains = null;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--force') {
      flags.add(a);
      continue;
    }
    if (a === '--user-id' && argv[i + 1]) {
      userId = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === '--email' && argv[i + 1]) {
      email = argv[i + 1];
      i += 1;
      continue;
    }
    if (a === '--contains' && argv[i + 1]) {
      contains = argv[i + 1];
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    }
    if (!userId && !email && !contains) {
      if (a.startsWith('user_')) {
        userId = a;
      } else {
        contains = a;
      }
    }
  }

  return { userId, email, contains, hasFlag: (name) => flags.has(name) };
}

const argv = process.argv.slice(2);
const { userId, email, contains, hasFlag } = parseArgs(argv);

loadBackendEnv({ mode: process.env.NODE_ENV ?? 'development' });

const { db } = await import('../src/db/index.js');
const { users } = await import('../src/db/schema.js');
const { setSubscriptionPlan } = await import('../src/services/billing-engine.js');

async function main() {
  let rows;

  if (userId) {
    rows = await db.query.users.findMany({ where: eq(users.id, userId), limit: 5 });
  } else if (email) {
    rows = await db.query.users.findMany({ where: eq(users.email, email.trim().toLowerCase()), limit: 5 });
  } else if (contains) {
    const t = `%${contains.trim()}%`;
    rows = await db.query.users.findMany({
      where: or(
        ilike(users.id, t),
        ilike(users.email, t),
        ilike(users.firstName, t),
        ilike(users.lastName, t),
      ),
      limit: 20,
    });
  } else {
    console.error('Usage: node scripts/set-owner-agency.mjs [SEARCH | user_xxx] [--email ADDR] [--contains SUB] [--user-id ID] [--dry-run] [--force]');
    console.error('Examples (npm may drop --flags on Windows — positional works):');
    console.error('  node scripts/set-owner-agency.mjs PD9E4M');
    console.error('  npm run staff:set-owner-agency -- PD9E4M');
    process.exit(1);
  }

  if (rows.length === 0) {
    console.error('No user matched.');
    process.exit(1);
  }

  if (rows.length > 1 && !hasFlag('--force')) {
    console.error('Multiple users matched — pick one and pass --user-id, or narrow --contains:\n');
    for (const r of rows) {
      console.error(`  ${r.id}  ${r.email}  ${r.firstName ?? ''} ${r.lastName ?? ''}  role=${r.role} orgId=${r.orgId}`);
    }
    console.error('\nRe-run with --user-id <id> or add --force to apply to the first match only.');
    process.exit(1);
  }

  const user = rows[0];
  if (!user.orgId) {
    console.error(`User ${user.id} has no org_id — complete onboarding first.`);
    process.exit(1);
  }

  console.log('Target user:', {
    id: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    role: user.role,
    orgId: user.orgId,
  });

  if (hasFlag('--dry-run')) {
    console.log('[dry-run] Would set role=owner and plan=agency for org', user.orgId);
    process.exit(0);
  }

  await db
    .update(users)
    .set({ role: 'owner', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const result = await setSubscriptionPlan({
    orgId: user.orgId,
    planId: 'agency',
    source: 'script_set_owner_agency',
  });

  if (result.skipped) {
    console.warn('Subscription sync skipped:', result.reason);
  }

  console.log('Done.');
  console.log('Organisation plan:', result.organisation?.plan);
  console.log('User role: owner');
  if (result.subscription) {
    console.log('Execution credits (included):', result.subscription.executionIncludedBalance);
    console.log('Video credits (included):', result.subscription.videoIncludedBalance);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
