import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member']);
export const planEnum = pgEnum('plan', ['free', 'solo', 'pro', 'teams', 'agency']);
export const agentIdEnum = pgEnum('agent_id', [
  'cipher',
  'herald',
  'lore',
  'forge',
  'atlas',
  'echo',
  'pixel',
  'oracle',
  'vance',
  'wren',
  'ledger',
  'nexus',
  'scout',
  'sage',
  'sentinel',
]);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const sourceTypeEnum = pgEnum('source_type', [
  'manual',
  'url',
  'text',
  'markdown',
  'csv',
  'pdf',
  'docx',
  'notion',
  'gdrive',
]);
export const docStatusEnum = pgEnum('doc_status', ['pending', 'indexing', 'indexed', 'failed']);
export const triggerTypeEnum = pgEnum('trigger_type', ['manual', 'schedule', 'webhook', 'event']);
export const runStatusEnum = pgEnum('run_status', ['queued', 'running', 'completed', 'failed', 'cancelled']);
export const memoryTypeEnum = pgEnum('memory_type', ['preference', 'fact', 'instruction', 'pattern']);
export const memoryScopeEnum = pgEnum('memory_scope', [
  'org',
  'user',
  'agent_private',
  'restricted',
  'workflow_run',
  'temporary_session',
]);
export const invitationStatusEnum = pgEnum('invitation_status', ['pending', 'accepted', 'revoked', 'expired']);

export const organisations = pgTable('organisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubId: text('stripe_sub_id'),
  monthlyCreditLimit: integer('monthly_credit_limit').notNull().default(50),
  seatLimit: integer('seat_limit').notNull().default(1),
  creditsUsed: integer('credits_used').notNull().default(0),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    orgId: uuid('org_id').references(() => organisations.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull().default('member'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    avatarUrl: text('avatar_url'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('users_org_idx').on(table.orgId),
  }),
);

export const loreDocuments = pgTable(
  'lore_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by').references(() => users.id),
    title: text('title').notNull(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    sourceUrl: text('source_url'),
    rawContent: text('raw_content'),
    wordCount: integer('word_count'),
    status: docStatusEnum('status').notNull().default('pending'),
    version: integer('version').notNull().default(1),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('lore_docs_org_idx').on(table.orgId),
    statusIdx: index('lore_docs_status_idx').on(table.status),
  }),
);

export const loreChunks = pgTable(
  'lore_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id').notNull().references(() => loreDocuments.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    tokenCount: integer('token_count'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    orgIdx: index('chunks_org_idx').on(table.orgId),
    embeddingIdx: index('chunks_embedding_idx')
      .using('ivfflat', table.embedding.op('vector_cosine_ops'))
      .with({ lists: 100 }),
  }),
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    agentId: agentIdEnum('agent_id').notNull(),
    title: text('title'),
    contextSummary: text('context_summary'),
    messageCount: integer('message_count').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userAgentIdx: index('conv_user_agent_idx').on(table.userId, table.agentId),
    orgIdx: index('conv_org_idx').on(table.orgId),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    loreChunksUsed: uuid('lore_chunks_used').array(),
    tokensUsed: integer('tokens_used'),
    processingMs: integer('processing_ms'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    convIdx: index('messages_conv_idx').on(table.conversationId),
  }),
);

export const agentMemory = pgTable(
  'agent_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    agentId: agentIdEnum('agent_id').notNull(),
    scope: memoryScopeEnum('scope').notNull().default('org'),
    scopeKey: text('scope_key').notNull(),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    sessionKey: text('session_key'),
    memoryType: memoryTypeEnum('memory_type').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    provenanceKind: text('provenance_kind').notNull().default('confirmed'),
    sourceRef: text('source_ref'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    version: integer('version').notNull().default(1),
    confidence: real('confidence').notNull().default(0.5),
    usageCount: integer('usage_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgAgentIdx: index('memory_org_agent_idx').on(table.orgId, table.agentId),
    userScopeIdx: index('memory_user_scope_idx').on(table.orgId, table.userId, table.agentId),
    workflowRunIdx: index('memory_workflow_run_idx').on(table.workflowRunId),
    expiresIdx: index('memory_expires_idx').on(table.expiresAt),
    uniqueMemKey: uniqueIndex('memory_unique_key').on(table.orgId, table.agentId, table.scope, table.scopeKey, table.key),
  }),
);

export const organisationInvitations = pgTable(
  'organisation_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: userRoleEnum('role').notNull().default('member'),
    invitedBy: text('invited_by').references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    tokenPreview: text('token_preview').notNull(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    seatCount: integer('seat_count').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('org_invites_org_idx').on(table.orgId),
    emailIdx: index('org_invites_email_idx').on(table.email),
    statusIdx: index('org_invites_status_idx').on(table.status),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organisations.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('audit_logs_org_idx').on(table.orgId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
  }),
);

export const adminActionLogs = pgTable(
  'admin_action_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organisations.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id),
    actorStaffRole: text('actor_staff_role').notNull(),
    action: text('action').notNull(),
    permission: text('permission').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    requestId: text('request_id'),
    idempotencyKey: text('idempotency_key'),
    reasonCode: text('reason_code').notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('admin_action_logs_org_idx').on(table.orgId),
    actionIdx: index('admin_action_logs_action_idx').on(table.action),
    staffRoleIdx: index('admin_action_logs_staff_role_idx').on(table.actorStaffRole),
    createdIdx: index('admin_action_logs_created_idx').on(table.createdAt),
    idempotencyIdx: uniqueIndex('admin_action_logs_idempotency_idx').on(
      table.actorUserId,
      table.action,
      table.idempotencyKey,
    ),
  }),
);

export const productEvents = pgTable(
  'product_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organisations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    eventName: text('event_name').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('product_events_org_idx').on(table.orgId),
    eventIdx: index('product_events_name_idx').on(table.eventName),
  }),
);

export const creditAdjustments = pgTable(
  'credit_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id),
    delta: integer('delta').notNull(),
    previousCreditsUsed: integer('previous_credits_used').notNull(),
    nextCreditsUsed: integer('next_credits_used').notNull(),
    reasonCode: text('reason_code').notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('credit_adjustments_org_idx').on(table.orgId),
    actorIdx: index('credit_adjustments_actor_idx').on(table.actorUserId),
    createdIdx: index('credit_adjustments_created_idx').on(table.createdAt),
  }),
);

export const organisationFeatureFlags = pgTable(
  'organisation_feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    flagKey: text('flag_key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    createdBy: text('created_by').references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('org_feature_flags_org_idx').on(table.orgId),
    uniqueFlag: uniqueIndex('org_feature_flags_unique').on(table.orgId, table.flagKey),
  }),
);

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    source: text('source').notNull().default('landing'),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex('waitlist_entries_email_unique').on(table.email),
    createdIdx: index('waitlist_entries_created_idx').on(table.createdAt),
  }),
);

export const powerups = pgTable(
  'powerups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: text('agent_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    prompt: text('prompt').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex('powerups_slug_unique').on(table.slug),
    agentIdx: index('powerups_agent_idx').on(table.agentId),
  }),
);

export const emailUnsubscribes = pgTable(
  'email_unsubscribes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex('email_unsubscribes_email_unique').on(table.email),
  }),
);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    service: text('service').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    accountId: text('account_id'),
    accountEmail: text('account_email'),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgServiceIdx: uniqueIndex('integrations_org_service_idx').on(table.orgId, table.service),
  }),
);

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    triggerType: triggerTypeEnum('trigger_type').notNull(),
    triggerConfig: jsonb('trigger_config').notNull().default(sql`'{}'::jsonb`),
    nodes: jsonb('nodes').notNull().default(sql`'[]'::jsonb`),
    edges: jsonb('edges').notNull().default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(false),
    runCount: integer('run_count').notNull().default(0),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('workflows_org_idx').on(table.orgId),
  }),
);

export const workflowWebhooks = pgTable(
  'workflow_webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: text('events').array().notNull().default(sql`'{}'::text[]`),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('workflow_webhooks_org_idx').on(table.orgId),
    workflowIdx: index('workflow_webhooks_workflow_idx').on(table.workflowId),
  }),
);

export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    triggeredBy: text('triggered_by'),
    triggerSource: text('trigger_source').notNull().default('manual'),
    status: runStatusEnum('status').notNull().default('queued'),
    idempotencyKey: text('idempotency_key'),
    executionMode: text('execution_mode').notNull().default('inline'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    failureClass: text('failure_class'),
    nodeOutputs: jsonb('node_outputs').notNull().default(sql`'{}'::jsonb`),
    runLog: jsonb('run_log').notNull().default(sql`'[]'::jsonb`),
    errorLog: text('error_log'),
    creditsUsed: integer('credits_used').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    timeoutAt: timestamp('timeout_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    replayOfRunId: uuid('replay_of_run_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index('runs_workflow_idx').on(table.workflowId),
    orgIdx: index('runs_org_idx').on(table.orgId),
    idempotencyIdx: index('runs_idempotency_idx').on(table.workflowId, table.idempotencyKey),
    statusIdx: index('runs_status_idx').on(table.status),
    failureClassIdx: index('runs_failure_class_idx').on(table.failureClass),
  }),
);

export const llmExecutionTraces = pgTable(
  'llm_execution_traces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => organisations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
    workflowRunId: uuid('workflow_run_id').references(() => workflowRuns.id, { onDelete: 'set null' }),
    agentId: agentIdEnum('agent_id').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    policyKey: text('policy_key').notNull(),
    route: text('route').notNull(),
    routeReason: text('route_reason'),
    fallbackUsed: boolean('fallback_used').notNull().default(false),
    latencyMs: integer('latency_ms'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    estimatedCostUsd: real('estimated_cost_usd'),
    toolsUsed: text('tools_used').array().notNull().default(sql`'{}'::text[]`),
    loreChunkIds: uuid('lore_chunk_ids').array(),
    loreDocumentIds: uuid('lore_document_ids').array(),
    memoryReadIds: uuid('memory_read_ids').array(),
    memoryWriteKeys: text('memory_write_keys').array().notNull().default(sql`'{}'::text[]`),
    outcomeStatus: text('outcome_status').notNull(),
    failureClass: text('failure_class'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('llm_traces_org_idx').on(table.orgId),
    agentIdx: index('llm_traces_agent_idx').on(table.agentId),
    modelIdx: index('llm_traces_model_idx').on(table.model),
    conversationIdx: index('llm_traces_conversation_idx').on(table.conversationId),
    workflowRunIdx: index('llm_traces_workflow_run_idx').on(table.workflowRunId),
    createdIdx: index('llm_traces_created_idx').on(table.createdAt),
  }),
);

export const powerUps = pgTable('power_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: agentIdEnum('agent_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  promptTemplate: text('prompt_template').notNull(),
  inputSchema: jsonb('input_schema').notNull().default(sql`'{}'::jsonb`),
  isPremium: boolean('is_premium').notNull().default(false),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailQueue = pgTable(
  'email_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toEmail: text('to_email').notNull(),
    templateName: text('template_name').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    sendAfter: timestamp('send_after', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sendAfterIdx: index('email_queue_send_after_idx').on(table.sendAfter),
    sentAtIdx: index('email_queue_sent_at_idx').on(table.sentAt),
  }),
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').references(() => users.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: text('scopes').array().notNull().default(sql`ARRAY['read','write']::text[]`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index('api_keys_org_idx').on(table.orgId),
  }),
);

export const referralCodes = pgTable(
  'referral_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().unique().references(() => organisations.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: index('referral_codes_code_idx').on(table.code),
  }),
);

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerOrgId: uuid('referrer_org_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
    refereeEmail: text('referee_email').notNull(),
    refereeOrgId: uuid('referee_org_id').references(() => organisations.id, { onDelete: 'set null' }),
    bonusCreditsAwarded: integer('bonus_credits_awarded').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    referrerIdx: index('referrals_referrer_idx').on(table.referrerOrgId),
    emailUnique: uniqueIndex('referrals_email_unique').on(table.referrerOrgId, table.refereeEmail),
  }),
);
