import { getAgentContract } from '../agents/contracts.js';

export function shouldRunSentinelReview({ agentId, orgPlan }) {
  const sentinelContract = getAgentContract('sentinel');
  const sentinelConfig = sentinelContract?.sentinelConfig;

  if (!sentinelConfig?.enabled) {
    return false;
  }

  return (
    sentinelConfig.eligiblePlans.includes(orgPlan) &&
    sentinelConfig.reviewableAgents.includes(agentId)
  );
}

export function reviewAgentOutputWithSentinel({
  agentId,
  orgPlan,
  assistantText = '',
  evaluation = {},
  schemaValidation = null,
  sources = [],
}) {
  if (!shouldRunSentinelReview({ agentId, orgPlan })) {
    return null;
  }

  const sentinelConfig = getAgentContract('sentinel')?.sentinelConfig ?? {};
  const concerns = [];
  const repairActions = [];
  const groundedness = evaluation.groundedness ?? 'unknown';
  const hallucinationRisk = evaluation.hallucinationRisk ?? 'medium';
  const groundedAgent = ['well_grounded', 'partially_grounded', 'weak_grounding', 'ungrounded'].includes(groundedness);
  const schemaVerdict = schemaValidation?.verdict ?? 'skipped';
  const toolUsePass = evaluation.toolUsePass !== false;
  const instructionAdherence = evaluation.instructionAdherence ?? 'pass';
  const citationConfidencePass = groundedAgent ? sources.length > 0 : true;
  const accuracyPass =
    hallucinationRisk !== 'high' &&
    !['ungrounded', 'weak_grounding'].includes(groundedness);
  const compliancePass = toolUsePass && instructionAdherence !== 'failed';
  const schemaPass = schemaVerdict !== 'failed';

  if (!accuracyPass) {
    concerns.push('Grounding confidence is too weak for an automatic pass.');
  }

  if (!citationConfidencePass) {
    concerns.push('The response did not include citations or source evidence.');
    repairActions.push('Add citations or evidence links before sharing this output externally.');
  }

  if (!toolUsePass) {
    concerns.push('The response violated the allowed tool policy.');
  }

  if (instructionAdherence === 'warn') {
    concerns.push('The response format only partially matched the agent contract.');
    repairActions.push('Tighten the response structure to match the specialist output style.');
  }

  if (instructionAdherence === 'failed') {
    concerns.push('The response did not follow the required output style.');
  }

  if (schemaVerdict === 'repaired') {
    repairActions.push(
      schemaValidation?.repairNotes || 'Structured output was auto-repaired to satisfy the schema contract.',
    );
  }

  if (schemaVerdict === 'failed') {
    concerns.push('Structured output failed validation and could not be repaired safely.');
  }

  if (!assistantText.trim()) {
    concerns.push('The output was empty.');
  }

  let riskScore = 0.08;
  if (!accuracyPass) riskScore += 0.42;
  if (!citationConfidencePass) riskScore += 0.18;
  if (!compliancePass) riskScore += 0.22;
  if (schemaVerdict === 'repaired') riskScore += 0.12;
  if (schemaVerdict === 'failed') riskScore += 0.35;
  if (instructionAdherence === 'warn') riskScore += 0.06;
  if (!assistantText.trim()) riskScore += 0.2;
  riskScore = Number(Math.min(riskScore, 1).toFixed(2));

  const holdDecision = buildHoldDecision({
    accuracyPass,
    citationConfidencePass,
    compliancePass,
    schemaPass,
    schemaVerdict,
    riskScore,
    threshold: sentinelConfig.humanReviewThreshold ?? 0.8,
  });

  const verdict = holdDecision.reason
    ? 'HOLD'
    : schemaVerdict === 'repaired' || repairActions.length > 0 || concerns.length > 0
      ? 'REPAIR'
      : 'PASS';

  return {
    verdict,
    riskScore,
    reviewedAgentId: agentId,
    concerns,
    repair_actions: dedupeStrings(repairActions),
    hold_reason: holdDecision.reason,
    hold_reason_code: holdDecision.code,
    hold_risk_category: holdDecision.riskCategory,
    hold_confidence: holdDecision.confidence,
    suggested_next_action: holdDecision.reason
      ? 'Route this response to a human reviewer or regenerate with stronger grounding.'
      : verdict === 'REPAIR'
        ? 'Review the suggested repairs before forwarding or saving the output.'
        : 'Output can be shared with its attached evidence trail.',
    checks: {
      accuracy: {
        pass: accuracyPass,
        notes: accuracyPass ? 'Grounding risk stayed within the automatic-review threshold.' : 'Grounding or hallucination risk exceeded the automatic-review threshold.',
      },
      compliance: {
        pass: compliancePass,
        notes: compliancePass ? 'No contract or policy violations were detected.' : 'Tool or output-policy violations require a follow-up review.',
      },
      schemaValidity: {
        pass: schemaPass,
        notes:
          schemaVerdict === 'repaired'
            ? schemaValidation?.repairNotes || 'Schema issues were repaired automatically.'
            : schemaPass
              ? 'Schema requirements passed or were not required for this response.'
              : 'Schema validation failed.',
      },
      citationConfidence: {
        pass: citationConfidencePass,
        notes: citationConfidencePass ? 'Evidence or citations were attached where expected.' : 'The response needs citations or source evidence.',
      },
    },
    explainability: {
      verdict,
      riskScore,
      policyTrigger: holdDecision.code,
      riskCategory: holdDecision.riskCategory,
      confidence: holdDecision.confidence,
      threshold: sentinelConfig.humanReviewThreshold ?? 0.8,
      schemaVerdict,
      groundedness,
      hallucinationRisk,
      toolUsePass,
      instructionAdherence,
      sourceCount: sources.length,
    },
  };
}

function buildHoldDecision({
  accuracyPass,
  citationConfidencePass,
  compliancePass,
  schemaPass,
  schemaVerdict,
  riskScore,
  threshold,
}) {
  if (!schemaPass && schemaVerdict === 'failed') {
    return {
      reason: 'Structured output validation failed and could not be repaired safely.',
      code: 'schema_validation_failed',
      riskCategory: 'schema_integrity',
      confidence: 0.95,
    };
  }

  if (!accuracyPass) {
    return {
      reason: 'Grounding confidence fell below the Sentinel approval threshold.',
      code: 'grounding_confidence_low',
      riskCategory: 'hallucination_grounding',
      confidence: 0.9,
    };
  }

  if (!compliancePass) {
    return {
      reason: 'The response violated the contract or policy checks and needs human review.',
      code: 'contract_or_policy_violation',
      riskCategory: 'policy_compliance',
      confidence: 0.88,
    };
  }

  if (!citationConfidencePass && riskScore >= Math.max(threshold - 0.1, 0.65)) {
    return {
      reason: 'The response is missing the evidence trail required for a trusted pass.',
      code: 'missing_evidence_trail',
      riskCategory: 'evidence_confidence',
      confidence: 0.74,
    };
  }

  if (riskScore >= threshold) {
    return {
      reason: 'The overall review risk score exceeded the automatic approval threshold.',
      code: 'risk_score_threshold_exceeded',
      riskCategory: 'aggregate_risk',
      confidence: 0.72,
    };
  }

  return {
    reason: null,
    code: null,
    riskCategory: null,
    confidence: null,
  };
}

function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean))];
}
