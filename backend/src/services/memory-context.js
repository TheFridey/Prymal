const SENSITIVE_FACT_PATTERNS = [
  /\bapi[_ -]?key\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /\bprivate key\b/i,
  /\bcard\b/i,
  /\bcvv\b/i,
  /\bmedical\b/i,
  /\bdiagnosis\b/i,
];

const INTERNAL_ROUTING_PATTERNS = [
  /\bprovider\b/i,
  /\bmodel\b/i,
  /\broute(reason)?\b/i,
  /\bfallback\b/i,
  /\bcost\b/i,
  /\bpolicy(key| class)?\b/i,
];

function compactWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function makeFact({
  key,
  value,
  confidence = 0.8,
  source = 'user_stated',
  sensitivity = 'normal',
  expiresAt = null,
  summary = null,
}) {
  return {
    key,
    value: compactWhitespace(value),
    confidence,
    source,
    sensitivity,
    expiresAt,
    lastSeenAt: new Date().toISOString(),
    summary: summary ?? compactWhitespace(value),
  };
}

export function isUnsafeMemoryFact(value = '') {
  const text = compactWhitespace(value);
  return SENSITIVE_FACT_PATTERNS.some((pattern) => pattern.test(text))
    || INTERNAL_ROUTING_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildConversationMemoryUpdate({
  agentId,
  conversationId = null,
  userMessage = '',
  assistantText = '',
}) {
  const text = compactWhitespace(userMessage);
  const assistantSummary = compactWhitespace(assistantText).slice(0, 280);

  if (text.length < 18) {
    return null;
  }

  const facts = [];
  const preferences = [];
  const openQuestions = [];
  const doNotPersist = [];
  const suggestedLoreTags = new Set();

  const addFact = (fact) => {
    if (!fact?.value || fact.value.length < 3 || isUnsafeMemoryFact(fact.value)) {
      return;
    }
    facts.push(fact);
  };

  const extract = (regex, builder) => {
    const match = text.match(regex);
    if (match?.[1]) {
      builder(compactWhitespace(match[1]));
    }
  };

  extract(/our brand voice is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('brand');
    preferences.push('brand_voice');
    addFact(makeFact({
      key: 'brand_voice',
      value,
      confidence: 0.86,
      sensitivity: 'normal',
    }));
  });

  extract(/our ideal customer is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('audience');
    addFact(makeFact({
      key: 'ideal_customer_profile',
      value,
      confidence: 0.84,
    }));
  });

  extract(/our product(?:\/service)? is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('offer');
    addFact(makeFact({
      key: 'product_description',
      value,
      confidence: 0.82,
    }));
  });

  extract(/our pricing is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('pricing');
    addFact(makeFact({
      key: 'pricing',
      value,
      confidence: 0.8,
    }));
  });

  extract(/we (?:mainly )?sell to ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('audience');
    addFact(makeFact({
      key: 'target_customers',
      value,
      confidence: 0.8,
    }));
  });

  extract(/we(?:'re| are) focused on ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('goals');
    addFact(makeFact({
      key: 'active_goals',
      value,
      confidence: 0.78,
      source: 'user_stated',
    }));
  });

  extract(/remember(?: that)? ([^.]+)(?:\.|$)/i, (value) => {
    if (isUnsafeMemoryFact(value)) {
      doNotPersist.push(value);
      return;
    }
    addFact(makeFact({
      key: 'durable_context_note',
      value,
      confidence: 0.58,
      source: 'agent_inferred',
      sensitivity: 'restricted',
    }));
  });

  if (facts.length === 0) {
    return null;
  }

  const globalSummary = facts
    .slice(0, 4)
    .map((fact) => `${fact.key.replace(/_/g, ' ')}: ${fact.value}`)
    .join('; ');

  const agentSummary = assistantSummary
    || `Recent ${agentId} conversation clarified: ${globalSummary}`;

  return {
    global: {
      scope: 'global',
      agentId,
      conversationId,
      summary: globalSummary,
      facts,
      preferences,
      openQuestions,
      doNotPersist,
      suggestedLoreTags: [...suggestedLoreTags],
    },
    agent: {
      scope: 'agent',
      agentId,
      conversationId,
      summary: agentSummary,
      facts: facts.map((fact) => ({
        ...fact,
        source: fact.confidence < 0.7 ? 'agent_inferred' : fact.source,
      })),
      preferences,
      openQuestions,
      doNotPersist,
      suggestedLoreTags: [...suggestedLoreTags, agentId],
    },
  };
}

export function dedupeMemoryFacts(facts = []) {
  const map = new Map();

  for (const fact of facts) {
    if (!fact?.key || !fact?.value) continue;
    const dedupeKey = `${fact.key}:${compactWhitespace(fact.value).toLowerCase()}`;
    const existing = map.get(dedupeKey);
    if (!existing || Number(fact.confidence ?? 0) > Number(existing.confidence ?? 0)) {
      map.set(dedupeKey, {
        ...fact,
        value: compactWhitespace(fact.value),
      });
    }
  }

  return [...map.values()];
}
