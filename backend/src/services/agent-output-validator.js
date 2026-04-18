// ─────────────────────────────────────────────────────────────────
// services/agent-output-validator.js
// Runtime validation + repair pipeline for structured agent outputs.
//
// Flow:
//   1. Parse: extract JSON block from LLM response text
//   2. Validate: check against agent's JSON schema
//   3. Repair (one attempt): inject missing required fields with
//      sensible defaults, re-validate
//   4. Return result with verdict: 'pass' | 'repaired' | 'failed'
//
// Callers in llm.js use this before streaming the done event
// for schema-enforced agents.
// ─────────────────────────────────────────────────────────────────

import { getAgentContract } from '../agents/contracts.js';
import { getOutputSchema, SCHEMA_ENFORCED_AGENTS } from '../agents/output-schemas.js';

// ─── JSON extraction ─────────────────────────────────────────────

/**
 * Extract the first valid JSON object from a text string.
 * Handles ```json ... ``` fences and bare { } blocks.
 * @param {string} text
 * @returns {{ parsed: object|null, raw: string|null }}
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    return { parsed: null, raw: null };
  }

  // 1. Try fenced ```json``` block
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      return { parsed, raw: fencedMatch[1].trim() };
    } catch {
      // fall through
    }
  }

  // 2. Try first { ... } block (greedy from first { to last })
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate);
        return { parsed, raw: candidate };
      } catch {
        // fall through
      }
    }
  }

  return { parsed: null, raw: null };
}

export function extractStructuredJson(text) {
  return extractJson(text);
}

// ─── Schema validation (no external dep) ─────────────────────────

/**
 * Minimal JSON Schema draft-07 validator sufficient for our schemas.
 * Handles: type, required, properties, additionalProperties, const,
 *          enum, minLength, minimum, maximum, minItems, oneOf, items.
 *
 * Returns { valid: boolean, errors: string[] }
 */
function validateAgainstSchema(data, schema, path = '') {
  const errors = [];

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const variants = schema.oneOf
      .map((candidate) => validateAgainstSchema(data, candidate, path))
      .filter((result) => result.valid);

    if (variants.length === 0) {
      errors.push(`${path || 'root'}: value did not satisfy any allowed schema variant`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
    const matchesDeclaredType = types.some((declaredType) => {
      if (declaredType === 'integer') {
        return actualType === 'number' && Number.isInteger(data);
      }

      return declaredType === actualType;
    });

    if (!matchesDeclaredType) {
      errors.push(`${path || 'root'}: expected type ${types.join('|')}, got ${actualType}`);
      return { valid: false, errors };
    }
  }

  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path || 'root'}: expected const "${schema.const}", got "${data}"`);
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path || 'root'}: "${data}" not in enum [${schema.enum.join(', ')}]`);
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path || 'root'}: string length ${data.length} < minLength ${schema.minLength}`);
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path || 'root'}: ${data} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${path || 'root'}: ${data} > maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path || 'root'}: array length ${data.length} < minItems ${schema.minItems}`);
    }
    if (schema.items) {
      data.forEach((item, i) => {
        const { errors: itemErrors } = validateAgainstSchema(item, schema.items, `${path}[${i}]`);
        errors.push(...itemErrors);
      });
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push(`${path || 'root'}: missing required field "${key}"`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const { errors: propErrors } = validateAgainstSchema(data[key], propSchema, `${path}.${key}`);
          errors.push(...propErrors);
        }
      }
    }
    const declaredKeys = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(data)) {
      if (declaredKeys.has(key)) {
        continue;
      }

      if (schema.additionalProperties === false) {
        errors.push(`${path || 'root'}: additional property "${key}" is not allowed`);
        continue;
      }

      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        const { errors: propErrors } = validateAgainstSchema(
          data[key],
          schema.additionalProperties,
          `${path}.${key}`,
        );
        errors.push(...propErrors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Repair helpers ───────────────────────────────────────────────

/**
 * Attempt to fill in missing required fields with defaults.
 * This is intentionally conservative — only fills structural gaps.
 * @param {object} data
 * @param {object} schema
 * @param {string} agentId
 * @returns {object} patched clone
 */
function repairMissingFields(data, schema, agentId) {
  const patched = { ...data };

  if (!schema.required || !schema.properties) {
    return patched;
  }

  for (const key of schema.required) {
    if (key in patched) continue;

    const propSchema = schema.properties[key];
    if (!propSchema) continue;

    const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];

    if (propSchema.const !== undefined) {
      patched[key] = propSchema.const;
    } else if (types.includes('string')) {
      patched[key] = propSchema.enum ? propSchema.enum[0] : '';
    } else if (types.includes('integer')) {
      patched[key] = propSchema.minimum ?? 0;
    } else if (types.includes('number')) {
      patched[key] = propSchema.minimum ?? 0;
    } else if (types.includes('array')) {
      patched[key] = [];
    } else if (types.includes('object')) {
      // Recursively build the required sub-object
      patched[key] = repairMissingFields({}, propSchema, agentId);
    } else if (types.includes('boolean')) {
      patched[key] = false;
    } else {
      patched[key] = null;
    }
  }

  // Ensure 'agent' field is always correct for the agent
  if ('agent' in (schema.properties ?? {}) && schema.properties.agent?.const) {
    patched.agent = schema.properties.agent.const;
  }

  return applyAgentSpecificRepair({ patched, original: data, agentId });
}

function getSchemaRepairDefaults(agentId, schemaId) {
  if (agentId === 'lore' || schemaId === 'lore.sourceDigest') {
    return {
      agent: 'lore',
      chunksRetrieved: 0,
      sources: [],
      gapsIdentified: [],
      knowledgeGapDetected: false,
      confidence: 'ungrounded',
    };
  }

  if (agentId === 'sage' || schemaId === 'sage.decisionMemo') {
    return {
      agent: 'sage',
      objective: 'Provide strategic guidance on the current business position.',
      situation:
        'The previous response did not return a valid strategic memo, so only a minimal structured summary could be preserved safely.',
      recommendations: ['Regenerate the memo with explicit recommendations grounded in the available evidence.'],
      risks: [
        {
          description: 'The original response could not be validated against the expected strategy schema.',
          likelihood: 'high',
          impact: 'medium',
          mitigation: 'Retry with the required structured memo fields and supporting evidence.',
        },
      ],
      confidenceLevel: 'low',
      timeframe: 'Next 90 days',
    };
  }

  return null;
}

function applyAgentSpecificRepair({ patched, original, agentId }) {
  if (agentId === 'sage') {
    return repairSageStructuredOutput(patched, original);
  }

  return patched;
}

function repairSageStructuredOutput(patched, original) {
  const analysisType = formatIdentifierLabel(patched.analysisType ?? original.analysisType);
  const topPriorities = ensureStringArray(patched.topPriorities ?? original.topPriorities);
  const keyRisks = ensureStringArray(patched.keyRisks ?? original.keyRisks);

  if (!isMeaningfulString(patched.objective, 10)) {
    patched.objective = analysisType
      ? `Provide strategic guidance for the current ${analysisType}.`
      : 'Provide strategic guidance for the current business position.';
  }

  if (!isMeaningfulString(patched.situation, 20)) {
    patched.situation = buildSageSituationSummary({ analysisType, topPriorities, keyRisks });
  }

  if (!Array.isArray(patched.recommendations) || patched.recommendations.length === 0) {
    patched.recommendations = topPriorities.length > 0
      ? topPriorities
      : ['Prioritise the next move with the strongest evidence and clearest commercial impact.'];
  }

  if ((!Array.isArray(patched.risks) || patched.risks.length === 0) && keyRisks.length > 0) {
    patched.risks = keyRisks.map((description) => ({
      description,
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Review this risk explicitly before committing the next strategic phase.',
    }));
  }

  if (!isMeaningfulString(patched.confidenceLevel, 1)) {
    patched.confidenceLevel = 'medium';
  }

  if (!isMeaningfulString(patched.timeframe, 1)) {
    patched.timeframe = 'Next 90 days';
  }

  if (topPriorities.length > 0) {
    delete patched.topPriorities;
  }

  if (keyRisks.length > 0) {
    delete patched.keyRisks;
  }

  return patched;
}

function buildSageSituationSummary({ analysisType, topPriorities, keyRisks }) {
  const fragments = [];

  if (analysisType) {
    fragments.push(`This appears to be a ${analysisType}.`);
  }

  if (topPriorities.length > 0) {
    fragments.push(`Current strategic priorities include ${topPriorities.slice(0, 2).join('; ')}.`);
  }

  if (keyRisks.length > 0) {
    fragments.push(`Key risks include ${keyRisks.slice(0, 2).join('; ')}.`);
  }

  if (fragments.length === 0) {
    fragments.push('The business needs a grounded view of its current position, next priorities, and main execution risks.');
  }

  return fragments.join(' ');
}

function ensureStringArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function isMeaningfulString(value, minLength = 1) {
  return typeof value === 'string' && value.trim().length >= minLength;
}

function formatIdentifierLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Main export ──────────────────────────────────────────────────

/**
 * Validate and optionally repair the structured JSON output of an agent response.
 *
 * @param {string} agentId
 * @param {string} responseText  Full LLM response text (may contain non-JSON preamble)
 * @returns {{
 *   verdict: 'pass'|'repaired'|'failed'|'skipped',
 *   parsed: object|null,
 *   errors: string[],
 *   repairNotes: string|null,
 * }}
 */
export function validateAgentOutput(agentId, responseText) {
  // Only enforce for schema-enforced agents
  if (!SCHEMA_ENFORCED_AGENTS.has(agentId)) {
    return { verdict: 'skipped', parsed: null, errors: [], repairNotes: null };
  }

  const contract = getAgentContract(agentId);
  if (!contract?.outputSchema) {
    return { verdict: 'skipped', parsed: null, errors: [], repairNotes: null };
  }

  const schema = getOutputSchema(contract.outputSchema);
  if (!schema) {
    return { verdict: 'skipped', parsed: null, errors: [], repairNotes: null };
  }

  // 1. Extract JSON
  const { parsed, raw } = extractJson(responseText);
  if (!parsed || typeof parsed !== 'object') {
    const defaultRepair = getSchemaRepairDefaults(agentId, contract.outputSchema);
    if (defaultRepair) {
      const { valid: defaultRepairValid, errors: defaultRepairErrors } = validateAgainstSchema(defaultRepair, schema);

      if (defaultRepairValid) {
        return {
          verdict: 'repaired',
          parsed: defaultRepair,
          errors: ['No valid JSON object found in response'],
          repairNotes: 'Auto-repaired structured output with schema defaults because no valid JSON block was returned.',
        };
      }

      return {
        verdict: 'failed',
        parsed: defaultRepair,
        errors: defaultRepairErrors,
        repairNotes: 'Default schema repair was attempted but did not satisfy validation.',
      };
    }

    return {
      verdict: 'failed',
      parsed: null,
      errors: ['No valid JSON object found in response'],
      repairNotes: null,
    };
  }

  // 2. Validate
  const { valid, errors } = validateAgainstSchema(parsed, schema);
  if (valid) {
    return { verdict: 'pass', parsed, errors: [], repairNotes: null };
  }

  // 3. Repair attempt — only structural/missing-field repairs
  const repaired = repairMissingFields(parsed, schema, agentId);
  const { valid: repairedValid, errors: repairedErrors } = validateAgainstSchema(repaired, schema);

  if (repairedValid) {
    return {
      verdict: 'repaired',
      parsed: repaired,
      errors,
      repairNotes: `Auto-repaired missing fields: ${errors.map((e) => e.match(/"([^"]+)"/)?.[1]).filter(Boolean).join(', ')}`,
    };
  }

  return {
    verdict: 'failed',
    parsed,
    errors: repairedErrors,
    repairNotes: `Repair attempted but ${repairedErrors.length} error(s) remain.`,
  };
}

export function formatStructuredOutput(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return '';
  }

  return JSON.stringify(parsed, null, 2);
}

export function buildSchemaRepairPrompt({ agentId, responseText, validation }) {
  const contract = getAgentContract(agentId);
  const schema = contract?.outputSchema ? getOutputSchema(contract.outputSchema) : null;

  return [
    `The previous response for agent "${agentId}" failed contract validation.`,
    'Return ONLY a valid JSON object that satisfies the schema below.',
    contract?.outputSchema ? `Schema id: ${contract.outputSchema}` : null,
    schema ? `Schema:\n${JSON.stringify(schema, null, 2)}` : null,
    validation?.errors?.length ? `Validation errors:\n- ${validation.errors.join('\n- ')}` : null,
    responseText?.trim() ? `Previous response:\n${responseText.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function createSchemaValidationError(agentId, validation, stage = 'validation') {
  const contract = getAgentContract(agentId);
  const error = new Error(
    `Structured output validation failed for ${agentId}${contract?.outputSchema ? ` (${contract.outputSchema})` : ''}.`,
  );
  error.code = 'SCHEMA_VALIDATION_FAILED';
  error.status = 422;
  error.validation = {
    ...(validation ?? {}),
    stage,
  };
  return error;
}

/**
 * Returns true if the given agent requires structured output validation.
 * @param {string} agentId
 */
export function agentRequiresSchemaValidation(agentId) {
  return SCHEMA_ENFORCED_AGENTS.has(agentId);
}
