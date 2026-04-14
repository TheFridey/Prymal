// routes/admin/referrals.js
import { count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { organisations, referralCodes, referrals } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';

const router = new Hono();

router.get('/referrals', requireStaff, requireStaffPermission('admin.billing.read'), async (context) => {
  const days = Math.min(Math.max(Number(context.req.query('days') ?? 30), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalsRow] = await db
    .select({
      totalReferrals: count(referrals.id),
      converted: count(referrals.refereeOrgId),
      totalCreditsAwarded: sql`COALESCE(SUM(${referrals.bonusCreditsAwarded}), 0)`.mapWith(Number),
    })
    .from(referrals);

  const [codesRow] = await db.select({ totalCodes: count(referralCodes.id) }).from(referralCodes);

  const [windowRow] = await db
    .select({ windowReferrals: count(referrals.id) })
    .from(referrals)
    .where(gte(referrals.createdAt, since));

  const topReferrers = await db
    .select({
      referrerOrgId: referrals.referrerOrgId,
      referralCount: count(referrals.id),
      convertedCount: count(referrals.refereeOrgId),
      creditsAwarded: sql`COALESCE(SUM(${referrals.bonusCreditsAwarded}), 0)`.mapWith(Number),
      orgName: organisations.name,
      orgPlan: organisations.plan,
    })
    .from(referrals)
    .leftJoin(organisations, eq(referrals.referrerOrgId, organisations.id))
    .groupBy(referrals.referrerOrgId, organisations.name, organisations.plan)
    .orderBy(desc(count(referrals.id)))
    .limit(20);

  const recentActivity = await db
    .select({
      id: referrals.id,
      referrerOrgId: referrals.referrerOrgId,
      referrerOrgName: organisations.name,
      refereeEmail: referrals.refereeEmail,
      refereeOrgId: referrals.refereeOrgId,
      bonusCreditsAwarded: referrals.bonusCreditsAwarded,
      createdAt: referrals.createdAt,
    })
    .from(referrals)
    .leftJoin(organisations, eq(referrals.referrerOrgId, organisations.id))
    .orderBy(desc(referrals.createdAt))
    .limit(50);

  return context.json({
    days,
    stats: {
      totalReferrals: totalsRow?.totalReferrals ?? 0,
      converted: totalsRow?.converted ?? 0,
      conversionRate: totalsRow?.totalReferrals
        ? Number(((totalsRow.converted / totalsRow.totalReferrals) * 100).toFixed(1))
        : 0,
      totalCodes: codesRow?.totalCodes ?? 0,
      totalCreditsAwarded: totalsRow?.totalCreditsAwarded ?? 0,
      windowReferrals: windowRow?.windowReferrals ?? 0,
    },
    topReferrers: topReferrers.map((row) => ({
      orgId: row.referrerOrgId,
      orgName: row.orgName ?? row.referrerOrgId,
      orgPlan: row.orgPlan ?? 'free',
      referralCount: row.referralCount,
      convertedCount: row.convertedCount,
      creditsAwarded: row.creditsAwarded,
    })),
    recentActivity: recentActivity.map((row) => ({
      id: row.id,
      referrerOrgId: row.referrerOrgId,
      referrerOrgName: row.referrerOrgName ?? row.referrerOrgId,
      refereeEmail: row.refereeEmail,
      converted: Boolean(row.refereeOrgId),
      bonusCreditsAwarded: row.bonusCreditsAwarded,
      createdAt: row.createdAt,
    })),
  });
});

export default router;
