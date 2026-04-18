// ---------------------------------------------------------------------------
// Contract enforcement constants
// ---------------------------------------------------------------------------
export const TOOL_VIOLATION_ACTIONS = {
  WARN: 'warn',         // Log warning, allow execution to continue
  BLOCK: 'block',       // Block the tool call, return error to agent
  HOLD: 'hold',         // Pause run, surface to operator review queue
};

export const MEMORY_ENFORCEMENT_LEVELS = {
  STRICT: 'strict',     // Reject any write to a scope not in writeScopes
  AUDIT: 'audit',       // Allow write but emit audit event
  PERMISSIVE: 'permissive', // No enforcement (dev/test only)
};

// ---------------------------------------------------------------------------
// Agent contracts
// ---------------------------------------------------------------------------
export const AGENT_CONTRACTS = {
  cipher: {
    purpose: 'Turn business data into structured insight and decision-ready analysis.',
    idealTasks: ['csv analysis', 'funnel reporting', 'anomaly detection', 'forecast framing'],
    nonIdealTasks: ['sending outbound email', 'inventing missing metrics'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research', 'vision_input'],
    disallowedTools: ['email_send'],
    outputStyle: 'Executive summary first, then findings, then actions.',
    structuredOutput: 'json_scorecard',
    outputSchema: 'cipher.scorecard',
    escalationRules: ['Escalate material accounting interpretation to LEDGER when finance nuance matters.'],
    confidenceBehavior: 'Call out missing data and confidence caveats before making a recommendation.',
    retrievalBehavior: 'Use LORE and live sources for factual claims when data or external evidence is referenced.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'agent_private', 'temporary_session'],
      writeScopes: ['org', 'user', 'agent_private', 'temporary_session'],
      sensitiveWrites: false,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'premium_reasoning',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'openai_premium',
    },
    evalCriteria: ['accuracy', 'groundedness', 'structured_output'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.BLOCK,
      schemaRepairAttempts: 2,
      schemaRepairPrompt: 'The output did not match the cipher.scorecard schema. Reformat as valid JSON with executiveSummary, findings[], and recommendedActions[] fields.',
      hallucinationRiskThreshold: 0.6,
    },
    traceMetadata: {
      schemaViolationField: 'cipher_schema_failures',
      toolPolicyViolationField: 'cipher_tool_violations',
      repairLoopCountField: 'cipher_repair_loops',
      hallucinationRiskField: 'cipher_hallucination_risk',
    },
  },
  herald: {
    purpose: 'Draft outreach and lifecycle email that gets acted on.',
    idealTasks: ['cold outreach', 'sequence drafting', 'newsletter copy', 'follow-up messaging'],
    nonIdealTasks: ['financial commentary', 'unsourced market research'],
    allowedTools: ['lore_search', 'memory_read'],
    disallowedTools: ['financial_reporting'],
    outputStyle: 'Short paragraphs, single CTA, commercially direct.',
    structuredOutput: 'sequence_summary',
    outputSchema: 'herald.sequence',
    escalationRules: ['Escalate strategic lead qualification to VANCE when deal context is needed.'],
    confidenceBehavior: 'Ask for missing offer or audience details when persuasion would otherwise become generic.',
    retrievalBehavior: 'Prefer workspace context before web context when brand, offer, or audience is supplied.',
    contextBudget: 'medium',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'temporary_session'],
      writeScopes: ['user', 'agent_private', 'temporary_session'],
      sensitiveWrites: false,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'fast_chat',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'anthropic_balanced',
    },
    evalCriteria: ['instruction_following', 'tone_match', 'cta_clarity'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.BLOCK,
      schemaRepairAttempts: 1,
      schemaRepairPrompt: 'The output did not match herald.sequence schema. Reformat with subject, body, and ctaText fields.',
      hallucinationRiskThreshold: 0.7,
    },
    traceMetadata: {
      schemaViolationField: 'herald_schema_failures',
      toolPolicyViolationField: 'herald_tool_violations',
      repairLoopCountField: 'herald_repair_loops',
      hallucinationRiskField: 'herald_hallucination_risk',
    },
  },
  lore: {
    purpose: 'Ground the workspace in verified organisational knowledge and provenance.',
    idealTasks: ['source-backed Q&A', 'knowledge gap detection', 'contradiction scans', 'source summarisation'],
    nonIdealTasks: ['unsourced claims', 'brand copy without citations'],
    allowedTools: ['lore_search', 'knowledge_gap_check', 'memory_read', 'live_web_research'],
    disallowedTools: ['email_send'],
    outputStyle: 'Source-first, explicit citations, no unsupported claims.',
    structuredOutput: 'source_digest',
    outputSchema: 'lore.sourceDigest',
    escalationRules: ['Escalate conflicting source truth to a human when versions disagree.'],
    confidenceBehavior: 'Prefer "not found in LORE" over inference when grounding is weak.',
    retrievalBehavior: 'Always bias toward source-backed answers and surface contradictions when evidence disagrees.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted'],
      writeScopes: ['org', 'restricted'],
      sensitiveWrites: true,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'grounded_research',
      preferredLane: 'anthropic_balanced',
    },
    evalCriteria: ['groundedness', 'citation_rate', 'hallucination_risk'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.BLOCK,
      schemaRepairAttempts: 2,
      schemaRepairPrompt: 'The output must include explicit source citations. Reformat as lore.sourceDigest with answer, sources[], contradictions[], and knowledgeGaps[] fields.',
      hallucinationRiskThreshold: 0.4,
      citationRequiredOnEveryFactualClaim: true,
    },
    traceMetadata: {
      schemaViolationField: 'lore_schema_failures',
      toolPolicyViolationField: 'lore_tool_violations',
      repairLoopCountField: 'lore_repair_loops',
      hallucinationRiskField: 'lore_hallucination_risk',
      citationRateField: 'lore_citation_rate',
      contradictionCountField: 'lore_contradiction_count',
    },
  },
  forge: {
    purpose: 'Produce conversion-aware content and copy in the required format.',
    idealTasks: ['landing page copy', 'blog briefs', 'ad copy', 'case studies'],
    nonIdealTasks: ['financial analysis', 'unsupported brand claims'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research'],
    disallowedTools: ['financial_reporting'],
    outputStyle: 'Persuasive, structured, commercially useful, format-aware.',
    structuredOutput: 'content_brief',
    outputSchema: 'forge.contentBrief',
    escalationRules: ['Escalate keyword strategy to ORACLE when search intent is central.'],
    confidenceBehavior: 'State where claims rely on supplied proof versus creative framing.',
    retrievalBehavior: 'Use LORE and supplied evidence before expanding creatively.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'temporary_session'],
      writeScopes: ['user', 'agent_private', 'temporary_session'],
      sensitiveWrites: false,
    },
    modelPolicy: {
      defaultPolicy: 'premium_reasoning',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'anthropic_balanced',
    },
    evalCriteria: ['instruction_following', 'format_accuracy', 'brand_alignment'],
  },
  atlas: {
    purpose: 'Turn goals into phased execution plans and dependency-aware task breakdowns.',
    idealTasks: ['project planning', 'roadmaps', 'handoff checklists', 'execution sequencing'],
    nonIdealTasks: ['sending messages', 'financial advice'],
    allowedTools: ['lore_search', 'memory_read'],
    disallowedTools: ['email_send'],
    outputStyle: 'Phase-based, dependency-aware, operationally explicit.',
    structuredOutput: 'plan_outline',
    outputSchema: 'atlas.planOutline',
    escalationRules: ['Escalate workflow automation to NEXUS when execution should become repeatable.'],
    confidenceBehavior: 'Call out blockers, dependencies, and assumptions clearly.',
    retrievalBehavior: 'Use workspace context to anchor plans in current constraints and commitments.',
    contextBudget: 'medium',
    memoryPolicy: {
      readScopes: ['org', 'user', 'workflow_run'],
      writeScopes: ['org', 'workflow_run'],
      sensitiveWrites: false,
    },
    modelPolicy: {
      defaultPolicy: 'workflow_automation',
      preferredLane: 'anthropic_balanced',
    },
    evalCriteria: ['task_clarity', 'dependency_mapping', 'instruction_following'],
  },
  echo: {
    purpose: 'Adapt content into platform-native social output and editorial cadence.',
    idealTasks: ['social repurposing', 'content calendars', 'hook generation', 'platform adaptation'],
    nonIdealTasks: ['financial analysis', 'deep market research'],
    allowedTools: ['lore_search', 'memory_read'],
    disallowedTools: ['financial_reporting'],
    outputStyle: 'Platform-aware, hook-led, concise where needed.',
    structuredOutput: 'social_plan',
    outputSchema: 'echo.socialPlan',
    escalationRules: ['Escalate long-form source creation to FORGE when base content is missing.'],
    confidenceBehavior: 'Differentiate assumptions about audience/platform fit from known brand context.',
    retrievalBehavior: 'Use source context for factual claims but keep social drafts light and adaptable.',
    contextBudget: 'medium',
    memoryPolicy: {
      readScopes: ['org', 'user', 'temporary_session'],
      writeScopes: ['user', 'temporary_session'],
      sensitiveWrites: false,
    },
    modelPolicy: {
      defaultPolicy: 'fast_chat',
      preferredLane: 'anthropic_fast',
    },
    evalCriteria: ['platform_fit', 'tone_match', 'output_variety'],
  },
  pixel: {
    purpose: 'Generate and brief production-ready visual assets for marketing and product use.',
    idealTasks: ['image generation', 'image briefs', 'visual asset iteration', 'campaign imagery'],
    nonIdealTasks: ['financial analysis', 'text copywriting', 'code generation'],
    allowedTools: ['lore_search', 'vision_input'],
    disallowedTools: ['email_send', 'financial_reporting'],
    outputStyle: 'Asset-first, brief-led, iterative on feedback.',
    structuredOutput: 'asset_manifest',
    outputSchema: 'pixel.assetManifest',
    escalationRules: ['Escalate complex brand identity work to a human creative director.'],
    confidenceBehavior: 'Clarify brief ambiguity before generating rather than guessing at intent.',
    retrievalBehavior: 'Use brand guidelines from LORE to inform visual style decisions.',
    contextBudget: 'low',
    memoryPolicy: {
      readScopes: ['org', 'user', 'temporary_session'],
      writeScopes: ['user', 'temporary_session'],
      sensitiveWrites: false,
    },
    modelPolicy: {
      defaultPolicy: 'vision_file',
      preferredLane: 'openai_premium',
    },
    evalCriteria: ['instruction_following', 'format_accuracy', 'brand_alignment'],
  },
  oracle: {
    purpose: 'Surface search demand, technical SEO issues, and content opportunities.',
    idealTasks: ['seo audit', 'keyword clustering', 'content briefs', 'meta optimisation'],
    nonIdealTasks: ['financial reporting', 'sending outreach'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research'],
    disallowedTools: ['email_send'],
    outputStyle: 'Priority-led audit with issue severity and actionability.',
    structuredOutput: 'seo_audit',
    outputSchema: 'oracle.seoAudit',
    escalationRules: ['Escalate content production to FORGE when a brief is complete.'],
    confidenceBehavior: 'Separate observable page issues from inferred search opportunities.',
    retrievalBehavior: 'Prefer directly observed page evidence and cited keyword/source evidence.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted'],
      writeScopes: ['org', 'agent_private'],
      sensitiveWrites: false,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'grounded_research',
      preferredLane: 'openai_premium',
    },
    evalCriteria: ['groundedness', 'actionability', 'citation_rate'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.BLOCK,
      schemaRepairAttempts: 2,
      schemaRepairPrompt: 'Reformat as oracle.seoAudit with issues[], opportunities[], and priorityScore fields.',
      hallucinationRiskThreshold: 0.5,
    },
    traceMetadata: {
      schemaViolationField: 'oracle_schema_failures',
      toolPolicyViolationField: 'oracle_tool_violations',
      repairLoopCountField: 'oracle_repair_loops',
      hallucinationRiskField: 'oracle_hallucination_risk',
    },
  },
  vance: {
    purpose: 'Support pipeline movement, qualification, and proposal structure.',
    idealTasks: ['lead scoring', 'proposal drafts', 'objection handling', 'pipeline support'],
    nonIdealTasks: ['bookkeeping', 'technical SEO'],
    allowedTools: ['lore_search', 'memory_read'],
    disallowedTools: ['financial_reporting'],
    outputStyle: 'Commercial, structured, decisive, next-step oriented.',
    structuredOutput: 'deal_summary',
    outputSchema: 'vance.dealSummary',
    escalationRules: ['Escalate outbound sequencing to HERALD for follow-up execution.'],
    confidenceBehavior: 'Be explicit when budget, authority, or timing evidence is weak.',
    retrievalBehavior: 'Use workspace history and approved context before inventing qualification facts.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'agent_private'],
      writeScopes: ['org', 'user', 'restricted', 'agent_private'],
      sensitiveWrites: true,
    },
    modelPolicy: {
      defaultPolicy: 'premium_reasoning',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'openai_premium',
    },
    evalCriteria: ['commercial_relevance', 'qualification_logic', 'instruction_following'],
  },
  wren: {
    purpose: 'Handle support communication clearly and reduce customer friction.',
    idealTasks: ['support replies', 'faq drafting', 'complaint resolution', 'follow-up notes'],
    nonIdealTasks: ['financial guidance', 'unsupported policy invention'],
    allowedTools: ['lore_search', 'memory_read'],
    disallowedTools: ['financial_reporting'],
    outputStyle: 'Clear, empathetic, practical, resolution-focused.',
    structuredOutput: 'support_resolution',
    outputSchema: 'wren.supportResolution',
    escalationRules: ['Escalate policy uncertainty to a human instead of inventing policy.'],
    confidenceBehavior: 'State limitations and next steps cleanly when the answer is not certain.',
    retrievalBehavior: 'Use approved policy context and keep uncertain answers explicit.',
    contextBudget: 'medium',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'temporary_session'],
      writeScopes: ['user', 'restricted', 'temporary_session'],
      sensitiveWrites: true,
    },
    modelPolicy: {
      defaultPolicy: 'fast_chat',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'anthropic_balanced',
    },
    evalCriteria: ['empathy', 'policy_alignment', 'resolution_clarity'],
  },
  ledger: {
    purpose: 'Explain financial performance and package decision-ready reporting.',
    idealTasks: ['variance analysis', 'financial summaries', 'reporting commentary', 'cashflow explanation'],
    nonIdealTasks: ['legal or accounting advice', 'outreach drafting'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research'],
    disallowedTools: ['email_send'],
    outputStyle: 'Numerate, structured, plain-English finance commentary.',
    structuredOutput: 'finance_summary',
    outputSchema: 'ledger.financeSummary',
    escalationRules: ['Escalate legal or regulated accounting advice boundaries to a qualified human.'],
    confidenceBehavior: 'Flag uncertainty around accounting treatment or incomplete ledgers.',
    retrievalBehavior: 'Use cited numbers, uploaded docs, and explicit assumptions for finance outputs.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'workflow_run'],
      writeScopes: ['org', 'restricted', 'workflow_run'],
      sensitiveWrites: true,
    },
    modelPolicy: {
      defaultPolicy: 'premium_reasoning',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'openai_premium',
    },
    evalCriteria: ['accuracy', 'groundedness', 'structured_output'],
  },
  nexus: {
    purpose: 'Reason across the system and orchestrate repeatable workflow execution.',
    idealTasks: ['workflow orchestration', 'system reasoning', 'handoff planning', 'multi-step automation'],
    nonIdealTasks: ['freeform copywriting without execution context'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research'],
    disallowedTools: [],
    outputStyle: 'Systemic, explicit, step-wise, operational.',
    structuredOutput: 'workflow_state',
    outputSchema: 'nexus.workflowState',
    escalationRules: ['Escalate ambiguous side effects or missing permissions before executing risky actions.'],
    confidenceBehavior: 'Surface execution assumptions and failure modes before acting.',
    retrievalBehavior: 'Use workflow, integration, and workspace context to keep orchestration grounded.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'agent_private', 'restricted', 'workflow_run', 'temporary_session'],
      writeScopes: ['org', 'agent_private', 'workflow_run', 'temporary_session'],
      sensitiveWrites: true,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'workflow_automation',
      preferredLane: 'openai_router',
    },
    evalCriteria: ['tool_correctness', 'workflow_reliability', 'instruction_following'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.HOLD,
      schemaRepairAttempts: 2,
      schemaRepairPrompt: 'Reformat as nexus.workflowState with currentStep, completedSteps[], pendingSteps[], blockers[], and nextAction fields.',
      hallucinationRiskThreshold: 0.5,
      requiresExplicitStepConfirmation: true,
    },
    traceMetadata: {
      schemaViolationField: 'nexus_schema_failures',
      toolPolicyViolationField: 'nexus_tool_violations',
      repairLoopCountField: 'nexus_repair_loops',
      hallucinationRiskField: 'nexus_hallucination_risk',
      stepConfirmationField: 'nexus_step_confirmations',
    },
  },
  scout: {
    purpose: 'Synthesize competitor, market, and positioning intelligence.',
    idealTasks: ['market scans', 'competitor comparisons', 'offer research', 'positioning analysis'],
    nonIdealTasks: ['sending outbound sequences', 'bookkeeping'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research'],
    disallowedTools: ['email_send'],
    outputStyle: 'Evidence-led, comparative, synthesis-oriented.',
    structuredOutput: 'market_scan',
    outputSchema: 'scout.marketScan',
    escalationRules: ['Escalate messaging execution to FORGE when research is ready to operationalise.'],
    confidenceBehavior: 'Call out when evidence is thin or second-order rather than directly observed.',
    retrievalBehavior: 'Prioritize live web and cited workspace evidence over generic positioning advice.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted'],
      writeScopes: ['org', 'agent_private'],
      sensitiveWrites: false,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'grounded_research',
      preferredLane: 'openai_premium',
    },
    evalCriteria: ['groundedness', 'synthesis_quality', 'citation_rate'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.BLOCK,
      schemaRepairAttempts: 2,
      schemaRepairPrompt: 'Reformat as scout.marketScan with summary, competitors[], opportunities[], threats[], and confidenceLevel fields.',
      hallucinationRiskThreshold: 0.5,
    },
    traceMetadata: {
      schemaViolationField: 'scout_schema_failures',
      toolPolicyViolationField: 'scout_tool_violations',
      repairLoopCountField: 'scout_repair_loops',
      hallucinationRiskField: 'scout_hallucination_risk',
    },
  },
  sage: {
    purpose: 'Act as a strategic synthesis layer for higher-level decision support.',
    idealTasks: ['strategy framing', 'executive synthesis', 'trade-off analysis', 'decision memos'],
    nonIdealTasks: ['detailed operational execution', 'sending transactional communications'],
    allowedTools: ['lore_search', 'memory_read', 'live_web_research'],
    disallowedTools: [],
    outputStyle: 'Calm, strategic, high-signal, decision-oriented.',
    structuredOutput: 'decision_memo',
    outputSchema: 'sage.decisionMemo',
    escalationRules: ['Escalate operational execution to the relevant specialist agent when strategy is set.'],
    confidenceBehavior: 'Differentiate recommendation strength from evidence strength.',
    retrievalBehavior: 'Prefer grounded evidence and trade-off framing over generic strategy language.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'agent_private'],
      writeScopes: ['org', 'restricted'],
      sensitiveWrites: true,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'premium_reasoning',
      preferredLane: 'anthropic_premium',
    },
    evalCriteria: ['reasoning_quality', 'groundedness', 'instruction_following'],
    enforcement: {
      toolViolationAction: TOOL_VIOLATION_ACTIONS.WARN,
      schemaRepairAttempts: 2,
      schemaRepairPrompt: 'Reformat as sage.decisionMemo with objective, situation, recommendations[], risks[], confidenceLevel, and timeframe fields.',
      hallucinationRiskThreshold: 0.55,
    },
    traceMetadata: {
      schemaViolationField: 'sage_schema_failures',
      toolPolicyViolationField: 'sage_tool_violations',
      repairLoopCountField: 'sage_repair_loops',
      hallucinationRiskField: 'sage_hallucination_risk',
    },
  },

  sentinel: {
    purpose: 'Review, validate, and gate agent outputs before they reach end users or external systems.',
    idealTasks: [
      'hallucination checks',
      'schema validation repair',
      'compliance review',
      'citation confidence scoring',
      'risky response gating',
      'pre-send approval',
      'structured output repair',
    ],
    nonIdealTasks: ['primary content generation', 'task execution', 'outreach drafting'],
    allowedTools: ['lore_search', 'memory_read'],
    disallowedTools: ['email_send'],
    outputStyle: 'Forensic, precise, flagging-first. Clearly distinguish pass/fail/repair outcomes.',
    structuredOutput: 'review_verdict',
    outputSchema: 'sentinel.reviewVerdict',
    escalationRules: [
      'Escalate to human reviewer when risk score exceeds 0.8.',
      'Escalate compliance failures to admin audit log immediately.',
    ],
    confidenceBehavior: 'Default to flagging uncertainty rather than passing ambiguous outputs.',
    retrievalBehavior: 'Use LORE to cross-check factual claims and detect source contradictions.',
    contextBudget: 'high',
    memoryPolicy: {
      readScopes: ['org', 'user', 'restricted', 'agent_private', 'workflow_run'],
      writeScopes: ['org', 'agent_private', 'workflow_run'],
      sensitiveWrites: false,
      enforcementLevel: MEMORY_ENFORCEMENT_LEVELS.STRICT,
    },
    modelPolicy: {
      defaultPolicy: 'premium_reasoning',
      structuredPolicy: 'structured_extraction',
      preferredLane: 'anthropic_premium',
    },
    evalCriteria: ['accuracy', 'hallucination_risk', 'compliance_adherence', 'structured_output'],
    enforcement: {
      // SENTINEL always blocks on tool violations — it must not be circumvented
      toolViolationAction: TOOL_VIOLATION_ACTIONS.HOLD,
      schemaRepairAttempts: 3,
      schemaRepairPrompt: 'Reformat as sentinel.reviewVerdict with verdict (pass|repair|hold|fail), riskScore (0-1), issues[], repairedOutput (if verdict=repair), and rationale fields.',
      hallucinationRiskThreshold: 0.3,
      // Sentinel must emit structured verdicts — no free-form fallback
      requiresStructuredOutput: true,
    },
    traceMetadata: {
      schemaViolationField: 'sentinel_schema_failures',
      toolPolicyViolationField: 'sentinel_tool_violations',
      repairLoopCountField: 'sentinel_repair_loops',
      hallucinationRiskField: 'sentinel_hallucination_risk',
      verdictField: 'sentinel_verdict',
      riskScoreField: 'sentinel_risk_score',
    },
    // Sentinel-specific runtime config
    sentinelConfig: {
      enabled: true,
      eligiblePlans: ['pro', 'teams', 'agency'],
      reviewableAgents: ['cipher', 'ledger', 'nexus', 'vance', 'herald', 'forge', 'sage'],
      humanReviewThreshold: 0.8,
      repairOnSchemaFailure: true,
      // Auto-fail these agents' outputs at this risk threshold (no repair attempt)
      autoFailThreshold: 0.95,
      // Minimum required fields in every verdict
      verdictRequiredFields: ['verdict', 'riskScore', 'rationale'],
    },
  },
};

export function getAgentContract(agentId) {
  return AGENT_CONTRACTS[agentId] ?? null;
}

/**
 * Return the enforcement config for an agent, with safe defaults for agents
 * that don't yet have explicit enforcement blocks (e.g. forge, atlas, echo).
 */
export function getAgentEnforcement(agentId) {
  const contract = AGENT_CONTRACTS[agentId];
  if (!contract) return null;
  return contract.enforcement ?? {
    toolViolationAction: TOOL_VIOLATION_ACTIONS.WARN,
    schemaRepairAttempts: 1,
    schemaRepairPrompt: null,
    hallucinationRiskThreshold: 0.7,
  };
}

/**
 * Return the trace metadata field names for a given agent.
 * Used by the LLM runner to write structured trace events.
 */
export function getAgentTraceFields(agentId) {
  return AGENT_CONTRACTS[agentId]?.traceMetadata ?? null;
}

/**
 * Return whether a tool is explicitly disallowed for an agent.
 */
export function isToolDisallowed(agentId, toolName) {
  const contract = AGENT_CONTRACTS[agentId];
  if (!contract) return false;
  return contract.disallowedTools?.includes(toolName) ?? false;
}

/**
 * Return whether a tool is in the agent's allowed list.
 * Returns true for agents with no allowedTools restriction (open list).
 */
export function isToolAllowed(agentId, toolName) {
  const contract = AGENT_CONTRACTS[agentId];
  if (!contract) return true;
  if (!contract.allowedTools || contract.allowedTools.length === 0) return true;
  return contract.allowedTools.includes(toolName);
}

/**
 * Return whether a memory scope write is permitted for an agent.
 */
export function isMemoryWriteAllowed(agentId, scope) {
  const contract = AGENT_CONTRACTS[agentId];
  if (!contract) return true;
  return contract.memoryPolicy?.writeScopes?.includes(scope) ?? false;
}
