import { AGENT_CONTRACTS } from '../agents/contracts.js';

/**
 * Default retrieval policy merged with per-agent `memoryPolicy` on contracts.
 * Prefer extending AGENT_CONTRACTS rather than branching on agent id strings here.
 */
const BASE_DEFAULT = {
  allowedScopes: ['org', 'user'],
  preferredTypes: [],
  blockedTypes: [],
  maxMemories: 20,
  maxMemoriesPerType: 6,
  maxTokenBudget: 1400,
  requireSource: false,
  minConfidence: 0.35,
  includeContradictions: false,
  includeExpired: false,
  includeConflicted: true,
};

const AGENT_POLICY_OVERRIDES = {
  lore: {
    preferredTypes: ['document_fact', 'business_fact', 'brand_voice', 'project_fact', 'warning'],
    maxMemories: 24,
    maxTokenBudget: 2000,
    minConfidence: 0.3,
    includeContradictions: true,
  },
  cipher: {
    preferredTypes: ['business_fact', 'integration_fact', 'agent_observation', 'correction'],
    maxMemories: 18,
    minConfidence: 0.45,
  },
  herald: {
    preferredTypes: ['brand_voice', 'user_preference', 'contact_fact', 'business_fact'],
    maxMemories: 16,
  },
  echo: {
    preferredTypes: ['brand_voice', 'user_preference', 'pattern', 'instruction'],
    maxMemories: 14,
  },
  atlas: {
    preferredTypes: ['task_state', 'workflow_state', 'decision', 'project_fact'],
    maxMemories: 18,
  },
  sentinel: {
    preferredTypes: ['warning', 'correction', 'business_fact', 'agent_observation'],
    blockedTypes: [],
    maxMemories: 22,
    minConfidence: 0.25,
    includeContradictions: true,
  },
};

/**
 * Returns merged memory retrieval policy for an agent (spec: getMemoryPolicyForAgent).
 * `allowedScopes` mirrors contract `readScopes` when present.
 */
export function getMemoryPolicyForAgent(agentId) {
  const contract = AGENT_CONTRACTS[agentId] ?? {};
  const mp = contract.memoryPolicy ?? {};
  const override = AGENT_POLICY_OVERRIDES[agentId] ?? {};

  const allowedScopes = mp.readScopes ?? BASE_DEFAULT.allowedScopes;

  return {
    allowedScopes,
    preferredTypes: override.preferredTypes ?? mp.preferredMemoryTypes ?? BASE_DEFAULT.preferredTypes,
    blockedTypes: override.blockedTypes ?? mp.blockedMemoryTypes ?? BASE_DEFAULT.blockedTypes,
    maxMemories: override.maxMemories ?? mp.maxMemoriesRetrieved ?? BASE_DEFAULT.maxMemories,
    maxMemoriesPerType: mp.maxMemoriesPerType ?? BASE_DEFAULT.maxMemoriesPerType,
    maxTokenBudget: override.maxTokenBudget ?? mp.maxMemoryTokenBudget ?? BASE_DEFAULT.maxTokenBudget,
    requireSource: mp.requireMemorySource ?? BASE_DEFAULT.requireSource,
    minConfidence: override.minConfidence ?? mp.minConfidenceFloor ?? BASE_DEFAULT.minConfidence,
    includeContradictions: override.includeContradictions ?? mp.includeContradictions ?? BASE_DEFAULT.includeContradictions,
    includeExpired: mp.includeExpiredMemory ?? BASE_DEFAULT.includeExpired,
    includeConflicted: mp.includeConflictedMemory ?? BASE_DEFAULT.includeConflicted,
  };
}
