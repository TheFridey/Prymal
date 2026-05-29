import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { logger } from '../lib/logger.js';

const log = logger.child({ component: 'powerups' });
import { z } from 'zod';
import { db } from '../db/index.js';
import { powerups as powerupsTable } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { canAccessAgent } from '../services/entitlements.js';
import {
  commitExecutionUsage,
  releaseExecutionUsage,
  reserveExecutionCredits,
} from '../services/billing-engine.js';
import { applyReservationThrottle } from '../services/billing-throttle.js';
import { estimateModelCostUsd } from '../services/llm-observability.js';
import { streamAgentResponse } from '../services/llm.js';

const router = new Hono();

const BUILTIN_POWERUPS = [
  { agentId: 'forge', slug: 'ab-headlines', name: '5 A/B Headlines', prompt: 'Generate 5 A/B test headline variants for: {{topic}}. Give each one a distinct angle.' },
  { agentId: 'forge', slug: 'product-desc', name: 'Product Description', prompt: 'Write a compelling product description for {{product}} in a {{tone|sharp}} tone.' },
  { agentId: 'herald', slug: 'cold-email', name: 'Cold Outreach Email', prompt: 'Write a cold outreach email to {{prospect}} at {{company}}. Goal: {{goal}}.' },
  { agentId: 'echo', slug: 'linkedin-post', name: 'LinkedIn Post', prompt: 'Write a LinkedIn post about {{topic}} with a strong hook.' },
  { agentId: 'cipher', slug: 'data-summary', name: 'Data Summary Report', prompt: 'Analyse this data and provide a concise executive summary.\n\n{{data}}' },
  { agentId: 'oracle', slug: 'content-brief', name: 'SEO Content Brief', prompt: 'Create an SEO content brief for the keyword "{{keyword}}".' },
  { agentId: 'wren', slug: 'faq-builder', name: 'Generate FAQ', prompt: 'Generate 10 FAQs for {{product_or_service}} using the knowledge base.' },
  { agentId: 'vance', slug: 'proposal', name: 'Project Proposal', prompt: 'Draft a project proposal for {{client}} based on this project description:\n\n{{projectDescription}}' },
  { agentId: 'ledger', slug: 'investor-update', name: 'Investor Update', prompt: 'Write an investor update for {{period}} using these metrics: {{metrics}}' },
  { agentId: 'scout', slug: 'competitor-snapshot', name: 'Competitor Snapshot', prompt: 'Analyse {{competitor}} and outline positioning, pricing, strengths, and weaknesses.' },
  { agentId: 'sage', slug: 'swot', name: 'SWOT Analysis', prompt: 'Run a SWOT analysis for {{business}} using this context:\n\n{{context}}' },
];

const runSchema = z.object({
  slug: z.string().min(1),
  agentId: z.string().min(1),
  inputs: z.record(z.string()),
});

router.get('/', requireOrg, async (context) => {
  const agentId = context.req.query('agentId');

  const dbRows = await db
    .select()
    .from(powerupsTable)
    .where(eq(powerupsTable.isActive, true));

  const customPowerUps = dbRows.map((row) => ({
    agentId: row.agentId,
    slug: row.slug,
    name: row.name,
    prompt: row.prompt,
  }));

  const allPowerUps = [...BUILTIN_POWERUPS, ...customPowerUps];
  const powerUps = agentId ? allPowerUps.filter((entry) => entry.agentId === agentId) : allPowerUps;

  return context.json({ powerUps });
});

router.post('/run', requireOrg, zValidator('json', runSchema), async (context) => {
  const org = context.get('org');
  const { slug, agentId, inputs } = context.req.valid('json');

  let powerUp = BUILTIN_POWERUPS.find((entry) => entry.slug === slug && entry.agentId === agentId);

  if (!powerUp) {
    const dbRow = await db.query.powerups.findFirst({
      where: (table, { and: dbAnd, eq: dbEq }) =>
        dbAnd(dbEq(table.slug, slug), dbEq(table.agentId, agentId), dbEq(table.isActive, true)),
    });

    if (!dbRow) {
      return context.json({ error: 'Power-Up not found.' }, 404);
    }

    powerUp = dbRow;
  }

  if (!canAccessAgent(org.orgPlan, agentId)) {
    return context.json({ error: 'This Power-Up requires a higher plan.', upgrade: true }, 403);
  }

  const prompt = fillTemplate(powerUp.prompt, inputs);
  const reservation = await reserveExecutionCredits({
    orgId: org.orgId,
    userId: org.userId,
    agentId,
    requestId: null,
    baseCredits: 1,
    estimatedContextTokens: Math.ceil(prompt.length / 4),
    agentCount: 1,
    metadata: {
      route: '/powerups/run',
      slug,
    },
  });

  return streamSSE(context, async (stream) => {
    let creditsCommitted = false;
    try {
      await applyReservationThrottle(reservation);

      const generator = streamAgentResponse({
        agentId,
        orgId: org.orgId,
        orgPlan: org.orgPlan,
        orgMetadata: org.orgMetadata ?? {},
        messages: [],
        userMessage: prompt,
        useLore: true,
      });

      for await (const event of generator) {
        if (event.type === 'text') {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'chunk', text: event.chunk }),
          });
        }

        if (event.type === 'done') {
          await commitExecutionUsage({
            usageEventId: reservation.usageEvent.id,
            provider: event.provider ?? null,
            model: event.model ?? null,
            promptTokens: event.inputTokens ?? null,
            completionTokens: event.outputTokens ?? null,
            totalTokens: event.totalTokens ?? null,
            estimatedCostUsd: estimateModelCostUsd({
              provider: event.provider,
              model: event.model,
              promptTokens: event.inputTokens ?? 0,
              completionTokens: event.outputTokens ?? 0,
            }),
            metadata: {
              slug,
              route: '/powerups/run',
            },
          });
          creditsCommitted = true;
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'done',
              tokensUsed: event.totalTokens,
              creditsUsed: reservation.burn.creditsUsed,
              sources: event.sources,
            }),
          });
        }
      }
    } catch (error) {
      if (!creditsCommitted) {
        await releaseExecutionUsage({
          usageEventId: reservation.usageEvent.id,
          reason: error.message,
          metadata: {
            slug,
            route: '/powerups/run',
          },
        }).catch((releaseError) => log.error({ err: releaseError }, 'billing.release_powerup_failed'));
      }

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          message: error.message,
          code: error.code ?? 'POWERUP_FAILED',
        }),
      });
    }
  });
});

function fillTemplate(template, inputs) {
  return template.replace(/{{(\w+)(?:\|([^}]+))?}}/g, (_, key, fallback) => inputs[key] ?? fallback ?? `[${key}]`);
}

export default router;
