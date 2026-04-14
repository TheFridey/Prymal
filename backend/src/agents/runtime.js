import { getAgentContract } from './contracts.js';
import { getOutputSchema, SCHEMA_ENFORCED_AGENTS } from './output-schemas.js';

export const HIGH_VALUE_AGENT_IDS = new Set([
  'cipher',
  'ledger',
  'nexus',
  'vance',
  'herald',
  'forge',
  'sentinel',
]);

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map((value) => String(value)))];
}

export function getRuntimeAgentContract(agentId) {
  const contract = getAgentContract(agentId);

  if (!contract) {
    return null;
  }

  const allowedTools = uniqueStrings(contract.allowedTools);
  const blockedTools = uniqueStrings(contract.blockedTools ?? contract.disallowedTools);
  const memoryReadScopes = uniqueStrings(contract.memoryPolicy?.readScopes);
  const memoryWriteScopes = uniqueStrings(contract.memoryPolicy?.writeScopes);
  const outputSchemaId = contract.outputSchema ?? null;

  return {
    ...contract,
    allowedTools,
    blockedTools,
    memoryReadScopes,
    memoryWriteScopes,
    preferredPolicyClass: contract.modelPolicy?.defaultPolicy ?? 'fast_chat',
    structuredPolicyClass: contract.modelPolicy?.structuredPolicy ?? null,
    outputSchemaId,
    outputSchema: outputSchemaId ? getOutputSchema(outputSchemaId) : null,
    schemaEnforced: SCHEMA_ENFORCED_AGENTS.has(agentId),
    strictRuntime: HIGH_VALUE_AGENT_IDS.has(agentId),
  };
}

export function isStrictRuntimeAgent(agentId) {
  return HIGH_VALUE_AGENT_IDS.has(agentId);
}

export function validateContractToolUsage(agentId, tools = []) {
  const runtimeContract = getRuntimeAgentContract(agentId);

  if (!runtimeContract) {
    return { valid: true, violations: [] };
  }

  const uniqueTools = uniqueStrings(tools);
  const violations = [];

  for (const tool of uniqueTools) {
    if (runtimeContract.blockedTools.includes(tool)) {
      violations.push({
        type: 'blocked_tool',
        tool,
        message: `Tool "${tool}" is blocked for ${agentId}.`,
      });
      continue;
    }

    if (runtimeContract.allowedTools.length > 0 && !runtimeContract.allowedTools.includes(tool)) {
      violations.push({
        type: 'tool_not_allowed',
        tool,
        message: `Tool "${tool}" is outside the allowed tool contract for ${agentId}.`,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function buildRuntimeContractSummary(agentId) {
  const runtimeContract = getRuntimeAgentContract(agentId);

  if (!runtimeContract) {
    return null;
  }

  return {
    allowedTools: runtimeContract.allowedTools,
    blockedTools: runtimeContract.blockedTools,
    memoryReadScopes: runtimeContract.memoryReadScopes,
    memoryWriteScopes: runtimeContract.memoryWriteScopes,
    preferredPolicyClass: runtimeContract.preferredPolicyClass,
    structuredPolicyClass: runtimeContract.structuredPolicyClass,
    outputSchemaId: runtimeContract.outputSchemaId,
    escalationRules: runtimeContract.escalationRules ?? [],
    strictRuntime: runtimeContract.strictRuntime,
  };
}
