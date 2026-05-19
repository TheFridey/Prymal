import { z } from 'zod';

export const POLICY_ACTIONS = {
  ALLOW: 'allow',
  BLOCK: 'block',
  REQUIRE_APPROVAL: 'require_approval',
  MODIFY_REQUEST: 'modify_request',
};

const policyConditionSchema = z.object({
  user_roles: z.array(z.string()).optional(),
  workflow_types: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  data_sensitivity: z.array(z.string()).optional(),
  runtime_types: z.array(z.string()).optional(),
  node_types: z.array(z.string()).optional(),
  risk_at_least: z.number().min(0).max(1).optional(),
  context: z.record(z.any()).optional(),
}).default({});

export const declarativePolicySchema = z.object({
  id: z.string().min(1).max(160),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(10_000).default(100),
  action: z.enum(Object.values(POLICY_ACTIONS)),
  conditions: policyConditionSchema,
  risk_score: z.number().min(0).max(1).default(0),
  reason: z.string().min(1).max(500).default('Policy matched.'),
  modifications: z.record(z.any()).default({}),
});

const policyDocumentSchema = z.object({
  version: z.string().min(1).default('1'),
  default_action: z.enum([POLICY_ACTIONS.ALLOW, POLICY_ACTIONS.REQUIRE_APPROVAL, POLICY_ACTIONS.BLOCK])
    .default(POLICY_ACTIONS.REQUIRE_APPROVAL),
  cumulative_risk_limit: z.number().min(0).max(1).default(0.85),
  policies: z.array(declarativePolicySchema).default([]),
});

export class DeclarativePolicyEngine {
  constructor({ policyProvider, clock = () => new Date() } = {}) {
    this.policyProvider = policyProvider ?? (() => DEFAULT_POLICY_DOCUMENT);
    this.clock = clock;
    this.cached = null;
  }

  async reload() {
    const raw = await this.policyProvider();
    this.cached = parsePolicyDocument(raw);
    return this.cached;
  }

  async evaluate(input = {}) {
    const document = this.cached ?? await this.reload();
    const normalized = normalizePolicyInput(input);
    const matched = document.policies
      .filter((policy) => policy.enabled)
      .filter((policy) => matchesPolicy(policy.conditions, normalized))
      .sort((left, right) => right.priority - left.priority);
    const cumulativeRisk = Number(Math.min(1, (normalized.cumulativeRisk ?? 0) + sumRisk(matched)).toFixed(4));
    const blockingPolicy = matched.find((policy) => policy.action === POLICY_ACTIONS.BLOCK);
    const approvalPolicy = matched.find((policy) => policy.action === POLICY_ACTIONS.REQUIRE_APPROVAL);
    const modifyingPolicies = matched.filter((policy) => policy.action === POLICY_ACTIONS.MODIFY_REQUEST);
    const allowPolicy = matched.find((policy) => policy.action === POLICY_ACTIONS.ALLOW);
    const action = resolveAction({
      document,
      matched,
      blockingPolicy,
      approvalPolicy,
      allowPolicy,
      cumulativeRisk,
    });

    return {
      action,
      allowed: action === POLICY_ACTIONS.ALLOW || action === POLICY_ACTIONS.MODIFY_REQUEST,
      blocked: action === POLICY_ACTIONS.BLOCK,
      requiresApproval: action === POLICY_ACTIONS.REQUIRE_APPROVAL,
      riskScore: matched.length ? Math.max(...matched.map((policy) => policy.risk_score)) : normalized.baseRisk,
      cumulativeRisk,
      modifications: mergeModifications(modifyingPolicies),
      matchedPolicies: matched.map((policy) => ({
        id: policy.id,
        action: policy.action,
        priority: policy.priority,
        riskScore: policy.risk_score,
        reason: policy.reason,
      })),
      evaluatedAt: this.clock().toISOString(),
      simulation: Boolean(normalized.simulation),
    };
  }
}

export const DEFAULT_POLICY_DOCUMENT = {
  version: '1',
  default_action: POLICY_ACTIONS.ALLOW,
  cumulative_risk_limit: 0.85,
  policies: [
    {
      id: 'block-critical-credential-access',
      action: POLICY_ACTIONS.BLOCK,
      priority: 1000,
      risk_score: 1,
      reason: 'Credential and environment access are not executable workflow actions.',
      conditions: {
        tools: ['env_access', 'secret_read'],
      },
    },
    {
      id: 'approval-for-high-risk-side-effects',
      action: POLICY_ACTIONS.REQUIRE_APPROVAL,
      priority: 900,
      risk_score: 0.82,
      reason: 'High-risk side-effect tools require approval.',
      conditions: {
        tools: [
          'email_send',
          'slack_post',
          'google_drive_write',
          'google_drive_append',
          'webhook_post',
          'cms_publish',
          'social_post',
          'billing_mutation',
          'admin_mutation',
          'integration_write',
          'post_external',
          'workflow_execute',
          'workflow_run',
        ],
      },
    },
    {
      id: 'approval-for-sensitive-data',
      action: POLICY_ACTIONS.REQUIRE_APPROVAL,
      priority: 800,
      risk_score: 0.75,
      reason: 'Sensitive data workflows require approval before external execution.',
      conditions: {
        data_sensitivity: ['restricted', 'secret'],
      },
    },
  ],
};

export function parsePolicyDocument(raw) {
  return policyDocumentSchema.parse(raw ?? DEFAULT_POLICY_DOCUMENT);
}

function normalizePolicyInput(input) {
  return {
    userRole: String(input.userRole ?? input.user_role ?? 'member'),
    workflowType: String(input.workflowType ?? input.workflow_type ?? 'general'),
    tool: input.tool ? String(input.tool) : null,
    dataSensitivity: String(input.dataSensitivity ?? input.data_sensitivity ?? 'internal'),
    runtimeType: String(input.runtimeType ?? input.runtime_type ?? 'native'),
    nodeType: String(input.nodeType ?? input.node_type ?? 'agent'),
    baseRisk: clampRisk(input.baseRisk ?? input.base_risk ?? 0),
    cumulativeRisk: clampRisk(input.cumulativeRisk ?? input.cumulative_risk ?? 0),
    context: input.context ?? {},
    simulation: Boolean(input.simulation),
  };
}

function matchesPolicy(conditions, input) {
  return (
    matchesList(conditions.user_roles, input.userRole)
    && matchesList(conditions.workflow_types, input.workflowType)
    && matchesList(conditions.tools, input.tool)
    && matchesList(conditions.data_sensitivity, input.dataSensitivity)
    && matchesList(conditions.runtime_types, input.runtimeType)
    && matchesList(conditions.node_types, input.nodeType)
    && matchesRisk(conditions.risk_at_least, input.baseRisk)
    && matchesContext(conditions.context, input.context)
  );
}

function resolveAction({ document, matched, blockingPolicy, approvalPolicy, allowPolicy, cumulativeRisk }) {
  if (blockingPolicy || cumulativeRisk >= document.cumulative_risk_limit) {
    return POLICY_ACTIONS.BLOCK;
  }

  if (approvalPolicy) {
    return POLICY_ACTIONS.REQUIRE_APPROVAL;
  }

  if (matched.some((policy) => policy.action === POLICY_ACTIONS.MODIFY_REQUEST)) {
    return POLICY_ACTIONS.MODIFY_REQUEST;
  }

  if (allowPolicy) {
    return POLICY_ACTIONS.ALLOW;
  }

  return document.default_action;
}

function matchesList(list, value) {
  if (!list || list.length === 0) {
    return true;
  }

  return value !== null && list.includes(value);
}

function matchesRisk(minimum, risk) {
  return minimum === undefined || risk >= minimum;
}

function matchesContext(expected = {}, context = {}) {
  return Object.entries(expected).every(([key, value]) => context[key] === value);
}

function mergeModifications(policies) {
  return policies.reduce((merged, policy) => ({ ...merged, ...policy.modifications }), {});
}

function sumRisk(policies) {
  return policies.reduce((sum, policy) => sum + policy.risk_score, 0);
}

function clampRisk(value) {
  return Math.min(1, Math.max(0, Number(value ?? 0)));
}
