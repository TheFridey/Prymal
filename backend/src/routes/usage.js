import { Hono } from 'hono';
import { requireOrg } from '../middleware/auth.js';
import { getUsageBreakdown, getUsageSummary, normalizeUsagePeriod } from '../services/usage-summary.js';

const router = new Hono();

router.get('/summary', requireOrg, async (context) => {
  const org = context.get('org');
  return context.json(await getUsageSummary({ orgId: org.orgId }));
});

router.get('/breakdown', requireOrg, async (context) => {
  const org = context.get('org');
  const period = normalizeUsagePeriod(context.req.query('period') ?? 'month');
  return context.json(await getUsageBreakdown({ orgId: org.orgId, period }));
});

export default router;
