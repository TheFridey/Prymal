import { detectPromptInjection } from './prompt-injection-detector.js';
import { createWardenDecision } from './warden-service.js';
import {
  WARDEN_CATEGORIES,
  WARDEN_RISK_LEVELS,
  WARDEN_SOURCE_TYPES,
  WARDEN_VERDICTS,
} from './warden-policy.js';

const TOOL_EXECUTION_RE = /\b(email_send|send email|post externally|publish|delete|export|billing|admin|grant credits|permission|integration write|webhook|external request)\b/i;
const DESTRUCTIVE_RE = /\b(delete|export|billing|admin|grant credits|permission|remove user|delete org|secret|env)\b/i;
const EXTERNAL_INPUT_RE = /\b(url|webhook|upload|file|ocr|lore|external|scraped|pasted)\b/i;

export async function scanWorkflowPlan({
  workflow,
  inputs,
  nodes = workflow?.nodes ?? [],
  edges = workflow?.edges ?? [],
  userId,
  orgId,
  dbClient,
} = {}) {
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];
  const workflowText = JSON.stringify({
    triggerType: workflow?.triggerType,
    triggerConfig: workflow?.triggerConfig ?? {},
    inputs: inputs ?? {},
    nodes: normalizedNodes.map((node) => ({
      id: node.id,
      agentId: node.agentId,
      prompt: node.prompt,
      label: node.label,
    })),
    edges,
  });
  const categories = [];
  const reasons = [];
  const injection = detectPromptInjection(workflowText);
  categories.push(...injection.categories);
  reasons.push(...injection.reasons);

  const hasExternalInput = workflow?.triggerType === 'webhook'
    || EXTERNAL_INPUT_RE.test(workflowText)
    || Object.keys(inputs ?? {}).length > 0;
  const hasToolExecution = TOOL_EXECUTION_RE.test(workflowText);
  const hasDestructiveAction = DESTRUCTIVE_RE.test(workflowText);

  if (hasExternalInput && hasToolExecution) {
    categories.push(WARDEN_CATEGORIES.TOOL_ABUSE);
    reasons.push('Workflow appears to route external input into tool execution.');
  }

  if (hasExternalInput && hasDestructiveAction) {
    categories.push(WARDEN_CATEGORIES.BILLING_ADMIN_ACTION);
    reasons.push('Workflow appears to route external or retrieved content into destructive, admin, billing, permission, export, or secret actions.');
  }

  const critical = categories.includes(WARDEN_CATEGORIES.BILLING_ADMIN_ACTION);
  const highRisk = categories.length > 0;

  return createWardenDecision({
    input: workflowText,
    userIntent: workflow?.description ?? workflow?.name ?? '',
    surface: 'workflow_execution',
    action: 'scan_workflow_plan',
    sourceType: hasExternalInput ? WARDEN_SOURCE_TYPES.PASTED : WARDEN_SOURCE_TYPES.USER,
    orgId,
    userId,
    categories,
    reasons,
    riskLevel: critical ? WARDEN_RISK_LEVELS.CRITICAL : highRisk ? WARDEN_RISK_LEVELS.HIGH : WARDEN_RISK_LEVELS.LOW,
    verdict: critical
      ? WARDEN_VERDICTS.BLOCK
      : highRisk
        ? WARDEN_VERDICTS.REQUIRE_CONFIRMATION
        : WARDEN_VERDICTS.ALLOW,
    metadata: {
      workflowId: workflow?.id ?? null,
      workflowHasExternalInput: hasExternalInput,
      workflowHasToolExecution: hasToolExecution,
      workflowHasDestructiveAction: hasDestructiveAction,
      nodeCount: normalizedNodes.length,
      edgeCount: Array.isArray(edges) ? edges.length : 0,
    },
  }, { dbClient });
}
