import { zValidator } from '@hono/zod-validator';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { AGENT_IDS, getAgent } from '../agents/config.js';
import { db } from '../db/index.js';
import { agentMemory, auditLogs, conversations, messages } from '../db/schema.js';
import { requireOrg } from '../middleware/auth.js';
import { planAwareRateLimit } from '../middleware/rateLimit.js';
import { assertCreditsAvailable, canAccessAgent, consumeCredits } from '../services/entitlements.js';
import { generateImageAsset } from '../services/image-generation.js';
import { getAccessToken } from './integrations.js';
import { streamAgentResponse } from '../services/llm.js';
import { evaluateAgentOutput } from '../services/evals.js';
import { classifyLLMFailure, recordLLMExecutionTrace } from '../services/llm-observability.js';
import { deleteMemory, extractMemoryFromTurn } from '../services/memory.js';
import { hasUsableOpenAIKey } from '../services/model-policy.js';
import { createRealtimeSessionToken, OPENAI_REALTIME_MODEL } from '../services/openai-realtime.js';
import { recordProductEvent } from '../services/telemetry.js';
import { transcribeAudioFile } from '../services/transcription.js';
import { runAgentChat } from '../services/agent-runner.js';
import { detectEscalationTrigger, dispatchWrenEscalation } from '../services/wren-escalation.js';
import { buildConversationAgentMismatchResponse } from './agent-conversation-utils.js';

const router = new Hono();

const chatSchema = z.object({
  agentId: z.enum(AGENT_IDS),
  message: z.string().trim().min(1).max(32000),
  conversationId: z.string().uuid().optional(),
  useLore: z.boolean().default(true),
  model: z.string().trim().max(80).optional(),
  attachments: z.array(z.object({
    base64: z.string().max(15_000_000),
    mediaType: z.string().max(80),
    name: z.string().max(255),
  })).max(4).optional(),
  preferences: z
    .object({
      responseLength: z.enum(['short', 'medium', 'long']).optional(),
      tone: z.enum(['official', 'balanced', 'casual']).optional(),
      customInstructions: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

const renameConversationSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

const imageGenerationSchema = z.object({
  agentId: z.enum(AGENT_IDS),
  prompt: z.string().trim().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536', 'auto']).optional().default('1024x1024'),
  quality: z.enum(['low', 'medium', 'high', 'auto']).optional().default('medium'),
  outputFormat: z.enum(['png', 'webp', 'jpeg']).optional().default('webp'),
  background: z.enum(['transparent', 'opaque', 'auto']).optional().default('auto'),
});

const realtimeTokenSchema = z.object({
  agentId: z.enum(AGENT_IDS).optional(),
});

// Internal-only agents excluded from the user-facing selector.
const INTERNAL_AGENT_IDS = new Set(['sentinel']);

router.get('/', requireOrg, (context) => {
  const org = context.get('org');

  return context.json({
    agents: AGENT_IDS
      .filter((agentId) => !INTERNAL_AGENT_IDS.has(agentId))
      .map((agentId) => {
        const agent = getAgent(agentId);
        return {
          id: agent.id,
          name: agent.name,
          title: agent.title,
          description: agent.description,
          color: agent.color,
          glyph: agent.glyph,
          locked: !canAccessAgent(org.orgPlan, agentId),
        };
      }),
  });
});

router.get('/conversations', requireOrg, async (context) => {
  const org = context.get('org');
  const limit = Math.min(Number(context.req.query('limit') ?? 10), 50);

  const result = await db.query.conversations.findMany({
    where: and(
      eq(conversations.orgId, org.orgId),
      eq(conversations.userId, org.userId),
    ),
    orderBy: [desc(conversations.lastActiveAt)],
    limit,
  });

  return context.json({ conversations: result });
});

router.get('/conversations/search', requireOrg, async (context) => {
  const org = context.get('org');
  const q = context.req.query('q')?.trim() ?? '';

  if (q.length < 2) {
    return context.json({ conversations: [] });
  }

  const result = await db
    .select({
      id: conversations.id,
      agentId: conversations.agentId,
      title: conversations.title,
      lastActiveAt: conversations.lastActiveAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, org.orgId),
        eq(conversations.userId, org.userId),
        or(
          ilike(conversations.title, `%${q}%`),
          ilike(conversations.contextSummary, `%${q}%`),
        ),
      ),
    )
    .orderBy(desc(conversations.lastActiveAt))
    .limit(12);

  return context.json({ conversations: result });
});

router.get('/:agentId/conversations', requireOrg, async (context) => {
  const org = context.get('org');
  const { agentId } = context.req.param();

  if (!AGENT_IDS.includes(agentId)) {
    return context.json({ error: 'Invalid agent' }, 400);
  }

  const result = await db.query.conversations.findMany({
    where: and(
      eq(conversations.orgId, org.orgId),
      eq(conversations.userId, org.userId),
      eq(conversations.agentId, agentId),
    ),
    orderBy: [desc(conversations.lastActiveAt)],
    limit: 50,
  });

  return context.json({ conversations: result });
});

router.get('/conversations/:conversationId/messages', requireOrg, async (context) => {
  const org = context.get('org');
  const { conversationId } = context.req.param();

  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.orgId, org.orgId),
      eq(conversations.userId, org.userId),
    ),
  });

  if (!conversation) {
    return context.json({ error: 'Conversation not found' }, 404);
  }

  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversation.id),
    orderBy: [asc(messages.createdAt)],
  });

  return context.json({ messages: history });
});

router.post('/chat', requireOrg, planAwareRateLimit({
  free: 10,
  solo: 30,
  pro: 60,
  teams: 100,
  agency: null,
  keyPrefix: 'agents-chat',
}), zValidator('json', chatSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');

  if (!canAccessAgent(org.orgPlan, payload.agentId)) {
    return context.json(
      {
        error: 'This agent is not available on your current plan.',
        upgrade: true,
      },
      403,
    );
  }

  assertCreditsAvailable(org, 1);

  let conversation = null;

  if (payload.conversationId) {
    conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, payload.conversationId),
        eq(conversations.orgId, org.orgId),
        eq(conversations.userId, org.userId),
      ),
    });

    if (!conversation) {
      return context.json({ error: 'Conversation not found' }, 404);
    }

    const mismatchResponse = buildConversationAgentMismatchResponse({
      conversation,
      requestedAgentId: payload.agentId,
    });

    if (mismatchResponse) {
      return context.json(mismatchResponse.body, mismatchResponse.status);
    }
  } else {
    [conversation] = await db
      .insert(conversations)
      .values({
        orgId: org.orgId,
        userId: org.userId,
        agentId: payload.agentId,
        lastActiveAt: new Date(),
      })
      .returning();
  }

  const history = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversation.id),
    orderBy: [asc(messages.createdAt)],
    limit: 40,
  });

  await db.insert(messages).values({
    conversationId: conversation.id,
    role: 'user',
    content: payload.message,
  });

  return streamSSE(context, async (stream) => {
    const startedAt = Date.now();
    const attachments = payload.attachments ?? [];
    const safeErrorMessage = (error) => {
      const message = String(error?.message ?? '').trim();
      return message || 'Generation failed.';
    };

    const runner = runAgentChat({
      agentId: payload.agentId,
      orgId: org.orgId,
      orgPlan: org.orgPlan,
      orgMetadata: org.orgMetadata ?? {},
      userId: org.userId,
      conversationId: conversation.id,
      userMessage: payload.message,
      messages: history.map((entry) => ({ role: entry.role, content: entry.content })),
      useLore: payload.useLore,
      preferences: payload.preferences,
      model: payload.model || undefined,
      attachments,
      mode: 'chat',
      requestId: context.get('requestId') ?? null,
    });

    await stream.writeSSE({
      data: JSON.stringify({
        type: 'started',
        conversationId: conversation.id,
        agentId: payload.agentId,
      }),
    });

    try {
      for await (const event of runner) {
        if (event.type === 'chunk') {
          await stream.writeSSE({ data: JSON.stringify({ type: 'chunk', text: event.text }) });
        } else if (event.type === 'done') {
          // Base LLM credits + extra per attachment type
          const attachmentCredits = attachments.reduce((sum, a) => {
            if (a.mediaType.startsWith('image/')) return sum + 2;
            if (a.mediaType === 'application/pdf') return sum + 3;
            return sum;
          }, 0);
          const creditsUsed = Math.max(Math.ceil((event.tokensUsed ?? 0) / 1000), 1) + attachmentCredits;
          await consumeCredits(org.orgId, creditsUsed);

          const [savedMessage] = await db
            .insert(messages)
            .values({
              conversationId: conversation.id,
              role: 'assistant',
              content: event.assistantText,
              loreChunksUsed: event.loreChunkIds ?? [],
              tokensUsed: event.tokensUsed ?? null,
              processingMs: Date.now() - startedAt,
              metadata: {
                model: event.model ?? null,
                provider: event.provider ?? null,
                policyKey: event.policyKey ?? null,
                policyClass: event.policyKey ?? null,
                route: event.route ?? null,
                routeReason: event.routeReason ?? null,
                fallbackModel: event.selectionDetails?.fallbackModelUsed ?? null,
                sources: event.sources ?? [],
                schemaValidation: event.schemaValidation ?? null,
                sentinelReview: event.sentinelReview ?? null,
              },
            })
            .returning();

          await db
            .update(conversations)
            .set({
              title: conversation.title || buildConversationTitle(payload.message),
              lastActiveAt: new Date(),
              messageCount: history.length + 2,
              totalTokens: (conversation.totalTokens ?? 0) + (event.tokensUsed ?? 0),
            })
            .where(eq(conversations.id, conversation.id));

          await Promise.all([
            recordProductEvent({
              orgId: org.orgId,
              userId: org.userId,
              eventName: 'chat.message_completed',
              metadata: {
                agentId: payload.agentId,
                conversationId: conversation.id,
                creditsUsed,
                usedLore: payload.useLore,
              },
            }),
            recordProductEvent({
              orgId: org.orgId,
              userId: org.userId,
              eventName: 'activation.useful_output',
              metadata: {
                agentId: payload.agentId,
                conversationId: conversation.id,
                outputType: 'chat_response',
              },
            }),
          ]);

          let escalationResult = { triggered: false, triggerReason: null };

          if (payload.agentId === 'wren') {
            const recentMessages = history.slice(-3).map((m) => ({ role: m.role, content: m.content }));
            escalationResult = detectEscalationTrigger(event.assistantText, recentMessages);

            if (escalationResult.triggered) {
              await dispatchWrenEscalation({
                orgId: org.orgId,
                userId: org.userId,
                conversationId: conversation.id,
                triggerReason: escalationResult.triggerReason,
                severity: escalationResult.severity,
                recentMessages,
                db,
              });
            }
          }

          await stream.writeSSE({
            data: JSON.stringify({
              type: 'done',
              messageId: savedMessage.id,
              conversationId: conversation.id,
              tokensUsed: event.tokensUsed ?? 0,
              creditsUsed,
              processingMs: Date.now() - startedAt,
              sources: event.sources ?? [],
              model: event.model ?? null,
              provider: event.provider ?? null,
              policyKey: event.policyKey ?? null,
              policyClass: event.policyKey ?? null,
              route: event.route ?? null,
              routeReason: event.routeReason ?? null,
              fallbackModel: event.selectionDetails?.fallbackModelUsed ?? null,
              schemaValidation: event.schemaValidation ?? null,
              sentinelReview: event.sentinelReview ?? null,
              escalated: escalationResult.triggered,
              escalationReason: escalationResult.triggerReason ?? null,
            }),
          });
        } else if (event.type === 'hold') {
          const [heldMessage] = await db
            .insert(messages)
            .values({
              conversationId: conversation.id,
              role: 'assistant',
              content: '',
              processingMs: Date.now() - startedAt,
              metadata: {
                held: true,
                sentinelConcerns: event.sentinelConcerns ?? [],
                sentinelRepairActions: event.sentinelRepairActions ?? [],
              },
            })
            .returning();

          await db
            .update(conversations)
            .set({
              title: conversation.title || buildConversationTitle(payload.message),
              lastActiveAt: new Date(),
              messageCount: history.length + 2,
            })
            .where(eq(conversations.id, conversation.id));

          await stream.writeSSE({
            data: JSON.stringify({
              type: 'hold',
              messageId: heldMessage.id,
              conversationId: conversation.id,
              agentId: payload.agentId,
              message: event.message,
              sentinelConcerns: event.sentinelConcerns ?? [],
              sentinelRepairActions: event.sentinelRepairActions ?? [],
            }),
          });
        } else if (event.type === 'error') {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'error',
              message: event.message || 'Generation failed.',
              code: event.code || 'CHAT_FAILED',
              upgrade: Boolean(event.upgrade),
              conversationId: conversation.id,
            }),
          });
        }
      }
    } catch (error) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          message: safeErrorMessage(error),
          code: error?.code || 'CHAT_STREAM_FAILED',
          upgrade: Boolean(error?.upgrade),
          conversationId: conversation.id,
        }),
      });
    }
  });
});

router.post('/generate-image', requireOrg, zValidator('json', imageGenerationSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');

  if (!canAccessAgent(org.orgPlan, payload.agentId)) {
    return context.json(
      {
        error: 'This agent is not available on your current plan.',
        upgrade: true,
      },
      403,
    );
  }

  const creditsRequired = getImageCreditCost(payload.quality);
  assertCreditsAvailable(org, creditsRequired);

  let conversation = null;

  if (payload.conversationId) {
    conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, payload.conversationId),
        eq(conversations.orgId, org.orgId),
        eq(conversations.userId, org.userId),
      ),
    });

    if (!conversation) {
      return context.json({ error: 'Conversation not found' }, 404);
    }

    const mismatchResponse = buildConversationAgentMismatchResponse({
      conversation,
      requestedAgentId: payload.agentId,
    });

    if (mismatchResponse) {
      return context.json(mismatchResponse.body, mismatchResponse.status);
    }
  } else {
    [conversation] = await db
      .insert(conversations)
      .values({
        orgId: org.orgId,
        userId: org.userId,
        agentId: payload.agentId,
        lastActiveAt: new Date(),
      })
      .returning();
  }

  const agent = getAgent(payload.agentId);
  const userContent = `/image ${payload.prompt}`;

  const [userMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: 'user',
      content: userContent,
      metadata: {
        tool: 'image-generation',
        size: payload.size,
        quality: payload.quality,
      },
    })
    .returning();

  const startedAt = Date.now();
  const generatedImage = await generateImageAsset({
    prompt: payload.prompt,
    agent,
    size: payload.size,
    quality: payload.quality,
    outputFormat: payload.outputFormat,
    background: payload.background,
  });

  await consumeCredits(org.orgId, creditsRequired);

  const assistantContent = buildImageMessage(agent.name, generatedImage.revisedPrompt ?? payload.prompt);
  const [assistantMessage] = await db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      processingMs: Date.now() - startedAt,
      metadata: {
        provider: 'openai',
        route: 'openai-image',
        routeReason: 'Used the OpenAI image generation pipeline for a direct visual asset request.',
        model: generatedImage.model,
        generatedImages: [generatedImage],
      },
    })
    .returning();

  await db
    .update(conversations)
    .set({
      title: conversation.title || buildConversationTitle(userContent),
      lastActiveAt: new Date(),
      messageCount: (conversation.messageCount ?? 0) + 2,
      totalTokens: conversation.totalTokens ?? 0,
    })
    .where(eq(conversations.id, conversation.id));

  await Promise.all([
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'image.generated',
      metadata: {
        agentId: payload.agentId,
        conversationId: conversation.id,
        creditsUsed: creditsRequired,
        model: generatedImage.model,
        size: generatedImage.size,
        quality: generatedImage.quality,
      },
    }),
    recordProductEvent({
      orgId: org.orgId,
      userId: org.userId,
      eventName: 'activation.useful_output',
      metadata: {
        agentId: payload.agentId,
        conversationId: conversation.id,
        outputType: 'generated_image',
      },
    }),
  ]);

  return context.json({
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    message: {
      id: assistantMessage.id,
      role: 'assistant',
      content: assistantContent,
      metadata: {
        provider: 'openai',
        route: 'openai-image',
        routeReason: 'Used the OpenAI image generation pipeline for a direct visual asset request.',
        model: generatedImage.model,
        generatedImages: [generatedImage],
      },
      processingMs: Date.now() - startedAt,
    },
    image: generatedImage,
    creditsUsed: creditsRequired,
  });
});

router.post('/transcribe', requireOrg, async (context) => {
  const formData = await context.req.formData();
  const audio = formData.get('audio');
  const language = String(formData.get('language') ?? 'en').trim() || 'en';
  const prompt = String(formData.get('prompt') ?? '').trim();

  if (!(audio instanceof File)) {
    return context.json({ error: 'Audio file is required.' }, 400);
  }

  if (audio.size === 0) {
    return context.json({ error: 'Audio file is empty.' }, 400);
  }

  if (audio.size > 12 * 1024 * 1024) {
    return context.json({ error: 'Audio file is too large. Keep voice clips under 12 MB.' }, 400);
  }

  const transcript = await transcribeAudioFile(audio, {
    language,
    prompt: prompt || 'Transcribe this short business chat prompt for an AI workspace.',
  });

  return context.json({ text: transcript });
});

router.post('/realtime-token', requireOrg, zValidator('json', realtimeTokenSchema), async (context) => {
  const org = context.get('org');
  const payload = context.req.valid('json');
  const agentId = payload.agentId ?? 'cipher';
  const startedAt = Date.now();

  if (!hasUsableOpenAIKey()) {
    await recordLLMExecutionTrace({
      orgId: org.orgId,
      userId: org.userId,
      agentId,
      provider: 'openai',
      model: OPENAI_REALTIME_MODEL,
      policyKey: 'realtime_voice',
      route: 'openai-realtime-webrtc',
      routeReason: 'Requested an ephemeral OpenAI Realtime session token for browser WebRTC transcription.',
      latencyMs: Date.now() - startedAt,
      outcomeStatus: 'failed',
      failureClass: 'configuration',
      metadata: {
        endpoint: '/agents/realtime-token',
      },
    });

    return context.json(
      {
        error: 'OpenAI Realtime is not configured for this environment.',
        code: 'REALTIME_NOT_CONFIGURED',
      },
      503,
    );
  }

  try {
    const session = await createRealtimeSessionToken();

    await recordLLMExecutionTrace({
      orgId: org.orgId,
      userId: org.userId,
      agentId,
      provider: 'openai',
      model: OPENAI_REALTIME_MODEL,
      policyKey: 'realtime_voice',
      route: 'openai-realtime-webrtc',
      routeReason: 'Requested an ephemeral OpenAI Realtime session token for browser WebRTC transcription.',
      latencyMs: Date.now() - startedAt,
      outcomeStatus: 'succeeded',
      metadata: {
        endpoint: '/agents/realtime-token',
        expiresAt: session.expiresAt,
      },
    });

    return context.json({
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    await recordLLMExecutionTrace({
      orgId: org.orgId,
      userId: org.userId,
      agentId,
      provider: 'openai',
      model: OPENAI_REALTIME_MODEL,
      policyKey: 'realtime_voice',
      route: 'openai-realtime-webrtc',
      routeReason: 'Requested an ephemeral OpenAI Realtime session token for browser WebRTC transcription.',
      latencyMs: Date.now() - startedAt,
      outcomeStatus: 'failed',
      failureClass: classifyLLMFailure({
        status: error?.status,
        code:
          error?.code === 'REALTIME_RATE_LIMITED'
            ? 'RATE_LIMIT'
            : error?.code === 'REALTIME_AUTH_FAILED'
              ? 'AUTH_FAILED'
              : error?.code === 'REALTIME_NOT_CONFIGURED'
                ? 'MODEL_INVALID'
                : 'UNAVAILABLE',
      }),
      metadata: {
        endpoint: '/agents/realtime-token',
        errorCode: error?.code ?? null,
      },
    });

    return context.json(
      {
        error: error?.message || 'Failed to create a realtime token.',
        code: error?.code || 'REALTIME_TOKEN_FAILED',
      },
      error?.status ?? 503,
    );
  }
});

router.delete('/conversations/:conversationId', requireOrg, async (context) => {
  const org = context.get('org');
  const { conversationId } = context.req.param();

  const deleted = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.orgId, org.orgId),
        eq(conversations.userId, org.userId),
      ),
    )
    .returning({ id: conversations.id });

  if (deleted.length === 0) {
    return context.json({ error: 'Conversation not found' }, 404);
  }

  return context.json({ success: true });
});

router.patch(
  '/conversations/:conversationId',
  requireOrg,
  zValidator('json', renameConversationSchema),
  async (context) => {
    const org = context.get('org');
    const { conversationId } = context.req.param();
    const payload = context.req.valid('json');

    const updated = await db
      .update(conversations)
      .set({
        title: payload.title,
        lastActiveAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, org.orgId),
          eq(conversations.userId, org.userId),
        ),
      )
      .returning({
        id: conversations.id,
        title: conversations.title,
      });

    if (updated.length === 0) {
      return context.json({ error: 'Conversation not found' }, 404);
    }

    return context.json({ conversation: updated[0] });
  },
);

router.get('/memory', requireOrg, async (context) => {
  const org = context.get('org');
  const agentId = context.req.query('agentId');

  const where = [eq(agentMemory.orgId, org.orgId)];
  if (agentId && AGENT_IDS.includes(agentId)) {
    where.push(eq(agentMemory.agentId, agentId));
  }

  const entries = await db.query.agentMemory.findMany({
    where: and(...where),
    orderBy: [desc(agentMemory.updatedAt)],
    limit: 200,
  });

  return context.json({ memory: entries });
});

router.delete('/memory/:memoryId', requireOrg, async (context) => {
  const org = context.get('org');
  const { memoryId } = context.req.param();

  const entry = await db.query.agentMemory.findFirst({
    where: and(eq(agentMemory.id, memoryId), eq(agentMemory.orgId, org.orgId)),
  });

  if (!entry) {
    return context.json({ error: 'Memory entry not found' }, 404);
  }

  await deleteMemory(memoryId);
  return context.json({ success: true });
});

router.post('/conversations/:conversationId/request-review', requireOrg, async (context) => {
  const org = context.get('org');
  const { conversationId } = context.req.param();

  await db.insert(auditLogs).values({
    orgId: org.orgId,
    actorUserId: org.userId,
    action: 'sentinel.hold.review_requested',
    targetType: 'conversation',
    targetId: conversationId,
    metadata: { requestedAt: new Date().toISOString() },
  });

  return context.json({ queued: true });
});

const urlAuditSchema = z.object({
  url: z.string().url().max(2000),
});

router.post('/oracle/audit', requireOrg, zValidator('json', urlAuditSchema), async (context) => {
  const org = context.get('org');
  const { url } = context.req.valid('json');

  assertCreditsAvailable(org, 2);

  const auditPrompt = `Please perform a full technical SEO and content audit of this URL: ${url}

Cover all of the following:
- Title tag and meta description (presence, length, keyword use)
- H1/H2/H3 heading hierarchy
- Canonical tag status
- Image alt text coverage
- Internal linking density and quality
- Page content quality and thin-content risk
- Mobile-friendliness and performance signals (if detectable)
- Any critical issues blocking indexation or ranking

End your response with a structured JSON summary block:
\`\`\`json
{ "agent": "oracle", "url": "${url}", "criticalIssues": 0, "warnings": 0, "passed": 0, "overallScore": 0 }
\`\`\``;

  return streamSSE(context, async (stream) => {
    let assistantText = '';
    let lastDoneEvent = null;
    const startedAt = Date.now();

    try {
      const generator = streamAgentResponse({
        agentId: 'oracle',
        orgId: org.orgId,
        orgPlan: org.orgPlan,
        orgMetadata: org.orgMetadata ?? {},
        userId: org.userId,
        taskType: 'grounded_research',
        messages: [],
        userMessage: auditPrompt,
        useLore: false,
        preferences: { responseLength: 'long' },
      });

      for await (const event of generator) {
        if (event.type === 'text') {
          assistantText += event.chunk;
          await stream.writeSSE({ data: JSON.stringify({ type: 'chunk', text: event.chunk }) });
        }

        if (event.type === 'done') {
          lastDoneEvent = event;
        }
      }

      const creditsUsed = Math.max(Math.ceil((lastDoneEvent?.totalTokens ?? 0) / 1000), 2);
      await consumeCredits(org.orgId, creditsUsed);

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'done',
          url,
          tokensUsed: lastDoneEvent?.totalTokens ?? 0,
          processingMs: Date.now() - startedAt,
        }),
      });
    } catch (error) {
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: error.message }) });
    }
  });
});

function buildConversationTitle(message) {
  return message.length > 60 ? `${message.slice(0, 57).trim()}...` : message.trim();
}

function getImageCreditCost(quality) {
  if (quality === 'high') {
    return 8;
  }

  if (quality === 'low') {
    return 2;
  }

  return 4;
}

function buildImageMessage(agentName, prompt) {
  return `Generated a visual concept with ${agentName}. Use it as a draft asset, then refine or iterate if you want a tighter direction.\n\nPrompt: ${prompt}`;
}

// ─── Herald: send via Gmail ──────────────────────────────────────────────────

const heraldSendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(100_000),
});

router.post('/herald/send-email', requireOrg, zValidator('json', heraldSendEmailSchema), async (context) => {
  const org = context.get('org');
  const { to, subject, body } = context.req.valid('json');

  let accessToken;

  try {
    accessToken = await getAccessToken(org.orgId, 'gmail');
  } catch {
    return context.json({ error: 'Gmail is not connected. Connect it in Integrations first.' }, 400);
  }

  const rfcMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');

  const encoded = Buffer.from(rfcMessage).toString('base64url');

  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  const gmailData = await gmailResponse.json().catch(() => ({}));

  if (!gmailResponse.ok) {
    const message = gmailData?.error?.message || 'Gmail send failed.';
    return context.json({ error: message }, 502);
  }

  return context.json({ success: true, messageId: gmailData.id ?? null });
});

// ─── Atlas: export summary to Notion ────────────────────────────────────────

const atlasNotionExportSchema = z.object({
  title: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(200_000),
  pageId: z.string().trim().optional(),
});

router.post('/atlas/export-notion', requireOrg, zValidator('json', atlasNotionExportSchema), async (context) => {
  const org = context.get('org');
  const { title, content, pageId } = context.req.valid('json');

  let accessToken;

  try {
    accessToken = await getAccessToken(org.orgId, 'notion');
  } catch {
    return context.json({ error: 'Notion is not connected. Connect it in Integrations first.' }, 400);
  }

  const paragraphs = content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: line.slice(0, 2000) } }],
      },
    }));

  const createBody = {
    parent: pageId ? { page_id: pageId } : { database_id: undefined },
    properties: {
      title: { title: [{ type: 'text', text: { content: title } }] },
    },
    children: paragraphs.slice(0, 100),
  };

  if (!pageId) {
    delete createBody.parent.database_id;
    createBody.parent = { workspace: true };
  } else {
    delete createBody.parent.database_id;
  }

  const notionResponse = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });

  const notionData = await notionResponse.json().catch(() => ({}));

  if (!notionResponse.ok) {
    const message = notionData?.message || 'Notion export failed.';
    return context.json({ error: message }, 502);
  }

  return context.json({ success: true, pageUrl: notionData.url ?? null, pageId: notionData.id ?? null });
});

export default router;
