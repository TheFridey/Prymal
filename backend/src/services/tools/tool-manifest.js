import { z } from 'zod';
import {
  WARDEN_SOURCE_TYPES,
  WARDEN_TOOL_RISK,
} from '../warden/warden-policy.js';

const TRUSTED_SOURCES = [WARDEN_SOURCE_TYPES.USER, WARDEN_SOURCE_TYPES.SYSTEM];
const ALL_UNTRUSTED_SOURCES = [
  WARDEN_SOURCE_TYPES.EXTERNAL_URL,
  WARDEN_SOURCE_TYPES.UPLOAD,
  WARDEN_SOURCE_TYPES.OCR,
  WARDEN_SOURCE_TYPES.PASTED,
  WARDEN_SOURCE_TYPES.LORE_RETRIEVAL,
];

const baseManifest = {
  lore_search: {
    name: 'lore_search',
    risk: WARDEN_TOOL_RISK.LOW,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ query: z.string().trim().min(1).max(1000) }).passthrough(),
    redactionPaths: [],
  },
  knowledge_gap_check: {
    name: 'knowledge_gap_check',
    risk: WARDEN_TOOL_RISK.LOW,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  memory_read: {
    name: 'memory_read',
    risk: WARDEN_TOOL_RISK.LOW,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  live_web_research: {
    name: 'live_web_research',
    risk: WARDEN_TOOL_RISK.LOW,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ query: z.string().trim().min(1).max(2000) }).passthrough(),
    redactionPaths: [],
  },
  vision_input: {
    name: 'vision_input',
    risk: WARDEN_TOOL_RISK.LOW,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  file_input: {
    name: 'file_input',
    risk: WARDEN_TOOL_RISK.LOW,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  create_draft: {
    name: 'create_draft',
    risk: WARDEN_TOOL_RISK.MEDIUM,
    sideEffect: false,
    requiresConfirmation: false,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  external_request: {
    name: 'external_request',
    risk: WARDEN_TOOL_RISK.MEDIUM,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ url: z.string().url() }).passthrough(),
    redactionPaths: ['headers.Authorization', 'headers.authorization', 'body.token', 'body.secret'],
  },
  email_send: {
    name: 'email_send',
    risk: WARDEN_TOOL_RISK.HIGH,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({
      to: z.union([z.string().email(), z.array(z.string().email())]),
      subject: z.string().trim().min(1).max(998),
      body: z.string().min(1).max(200_000),
    }).passthrough(),
    redactionPaths: ['body'],
  },
  workflow_execute: {
    name: 'workflow_execute',
    risk: WARDEN_TOOL_RISK.HIGH,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ workflowId: z.string().uuid() }).passthrough(),
    redactionPaths: [],
  },
  workflow_run: {
    name: 'workflow_run',
    risk: WARDEN_TOOL_RISK.HIGH,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ workflowId: z.string().uuid() }).passthrough(),
    redactionPaths: [],
  },
  post_external: {
    name: 'post_external',
    risk: WARDEN_TOOL_RISK.HIGH,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ url: z.string().url() }).passthrough(),
    redactionPaths: ['body'],
  },
  integration_write: {
    name: 'integration_write',
    risk: WARDEN_TOOL_RISK.HIGH,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  file_delete: {
    name: 'file_delete',
    risk: WARDEN_TOOL_RISK.HIGH,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: false,
    allowedSourceTypes: TRUSTED_SOURCES,
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES,
    argumentSchema: z.object({ fileId: z.string().min(1) }).passthrough(),
    redactionPaths: [],
  },
  billing_update: {
    name: 'billing_update',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  billing_credit_grant: {
    name: 'billing_credit_grant',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({ orgId: z.string().min(1), amount: z.number().positive() }).passthrough(),
    redactionPaths: [],
  },
  admin_action: {
    name: 'admin_action',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  delete_org: {
    name: 'delete_org',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({ orgId: z.string().min(1) }).passthrough(),
    redactionPaths: [],
  },
  delete_user: {
    name: 'delete_user',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({ userId: z.string().min(1) }).passthrough(),
    redactionPaths: [],
  },
  permission_change: {
    name: 'permission_change',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  export_data: {
    name: 'export_data',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  env_access: {
    name: 'env_access',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: true,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
  secret_read: {
    name: 'secret_read',
    risk: WARDEN_TOOL_RISK.CRITICAL,
    sideEffect: false,
    requiresConfirmation: true,
    requiresAdmin: true,
    allowedSourceTypes: [WARDEN_SOURCE_TYPES.USER],
    blockedSourceTypes: ALL_UNTRUSTED_SOURCES.concat([WARDEN_SOURCE_TYPES.SYSTEM]),
    argumentSchema: z.object({}).passthrough(),
    redactionPaths: [],
  },
};

const TOOL_MANIFEST = Object.freeze(Object.fromEntries(
  Object.entries(baseManifest).map(([key, entry]) => [key, Object.freeze(entry)]),
));

export function getToolManifest(toolName) {
  return TOOL_MANIFEST[String(toolName ?? '').trim()] ?? null;
}

export function getKnownManifestTools() {
  return Object.keys(TOOL_MANIFEST);
}

export function listToolManifest() {
  return Object.values(TOOL_MANIFEST);
}

export function isSourceAllowedByManifest(manifest, sourceType) {
  if (!manifest) return false;
  const blocked = new Set(manifest.blockedSourceTypes ?? []);
  if (blocked.has(sourceType)) return false;
  const allowed = new Set(manifest.allowedSourceTypes ?? []);
  if (allowed.size === 0) return true;
  return allowed.has(sourceType);
}

export function getManifestRiskFor(toolName) {
  const entry = getToolManifest(toolName);
  return entry ? entry.risk : null;
}

export { TOOL_MANIFEST };
