import { desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../../db/index.js';
import { agentMemory, organisations } from '../../db/schema.js';
import { requireStaff, requireStaffPermission } from '../../middleware/auth.js';
import { buildMemoryIntelligenceSummary } from '../../services/memory-intelligence.js';

const router = new Hono();

const querySchema = z.object({
  orgId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

router.get(
  '/memory-intelligence',
  requireStaff,
  requireStaffPermission('admin.activity.read'),
  zValidator('query', querySchema),
  async (context) => {
    const { orgId, limit } = context.req.valid('query');

    if (orgId) {
      const rows = await db.query.agentMemory.findMany({
        where: eq(agentMemory.orgId, orgId),
        orderBy: [desc(agentMemory.updatedAt)],
        limit: 500,
      });

      return context.json({
        orgId,
        summary: buildMemoryIntelligenceSummary(rows, { internal: true }),
      });
    }

    const orgRows = await db.query.organisations.findMany({
      orderBy: [desc(organisations.updatedAt)],
      limit: 60,
    });
    const orgIds = orgRows.map((row) => row.id);
    const memories = orgIds.length > 0
      ? await db.query.agentMemory.findMany({
          where: inArray(agentMemory.orgId, orgIds),
          orderBy: [desc(agentMemory.updatedAt)],
          limit: 2000,
        })
      : [];

    const summaries = orgRows.map((org) => {
      const rows = memories.filter((row) => row.orgId === org.id);
      return {
        orgId: org.id,
        orgName: org.name,
        orgSlug: org.slug,
        plan: org.plan,
        summary: buildMemoryIntelligenceSummary(rows, { internal: true }),
      };
    });

    const ranked = summaries
      .sort((left, right) => {
        const leftRisk = (left.summary.overview.contradictionsCount * 4) + (left.summary.overview.staleFactsCount * 2) - (left.summary.overview.activeProjectsCount);
        const rightRisk = (right.summary.overview.contradictionsCount * 4) + (right.summary.overview.staleFactsCount * 2) - (right.summary.overview.activeProjectsCount);
        return rightRisk - leftRisk;
      })
      .slice(0, limit);

    return context.json({
      generatedAt: new Date().toISOString(),
      organisations: ranked,
      totals: {
        contradictionsCount: ranked.reduce((sum, row) => sum + row.summary.overview.contradictionsCount, 0),
        staleFactsCount: ranked.reduce((sum, row) => sum + row.summary.overview.staleFactsCount, 0),
        unsupportedClaimsCount: ranked.reduce((sum, row) => sum + row.summary.overview.unsupportedClaimsCount, 0),
      },
    });
  },
);

export default router;
