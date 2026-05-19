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

function slugifyProjectId(value) {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildIsoNow() {
  return new Date().toISOString();
}

function confidenceLevelForScore(score) {
  const numeric = Number(score ?? 0);
  if (numeric >= 0.8) return 'high';
  if (numeric >= 0.55) return 'medium';
  return 'low';
}

function makeFact({
  key,
  value,
  confidence = 0.8,
  source = 'user_stated',
  sensitivity = 'normal',
  expiresAt = null,
  summary = null,
  lastSeenAt = buildIsoNow(),
  lastConfirmedAt = null,
  contradictionDetected = false,
  projectId = null,
  projectName = null,
  projectStatus = null,
}) {
  return {
    key,
    value: compactWhitespace(value),
    confidence,
    confidenceLevel: confidenceLevelForScore(confidence),
    source,
    sensitivity,
    expiresAt,
    lastSeenAt,
    lastConfirmedAt,
    contradictionDetected,
    projectId,
    projectName,
    projectStatus,
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
  const nowIso = buildIsoNow();

  if (text.length < 18) {
    return null;
  }

  const facts = [];
  const preferences = [];
  const openQuestions = [];
  const doNotPersist = [];
  const suggestedLoreTags = new Set();
  let detectedProject = null;

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

  const ensureProject = (projectName, overrides = {}) => {
    const safeName = compactWhitespace(projectName);
    if (!safeName || safeName.length < 3 || isUnsafeMemoryFact(safeName)) {
      return null;
    }
    if (!detectedProject) {
      detectedProject = {
        projectId: slugifyProjectId(safeName),
        projectName: safeName,
        status: 'active',
        objective: null,
        relatedAgents: [agentId],
        facts: [],
        decisions: [],
        openQuestions: [],
        milestones: [],
        risks: [],
        lastUpdatedAt: nowIso,
      };
    }
    if (overrides.status) detectedProject.status = overrides.status;
    if (overrides.objective) detectedProject.objective = compactWhitespace(overrides.objective);
    return detectedProject;
  };

  const addProjectFact = ({
    key,
    value,
    confidence = 0.8,
    source = 'user_stated',
    sensitivity = 'normal',
  }) => {
    if (!detectedProject || !value || isUnsafeMemoryFact(value)) {
      return;
    }
    detectedProject.facts.push(makeFact({
      key,
      value,
      confidence,
      source,
      sensitivity,
      projectId: detectedProject.projectId,
      projectName: detectedProject.projectName,
      projectStatus: detectedProject.status,
      lastSeenAt: nowIso,
      lastConfirmedAt: source === 'agent_inferred' ? null : nowIso,
    }));
  };

  extract(/our brand voice is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('brand');
    preferences.push('brand_voice');
    addFact(makeFact({
      key: 'brand_voice',
      value,
      confidence: 0.86,
      sensitivity: 'normal',
      lastSeenAt: nowIso,
      lastConfirmedAt: nowIso,
    }));
  });

  extract(/our ideal customer is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('audience');
    addFact(makeFact({
      key: 'ideal_customer_profile',
      value,
      confidence: 0.84,
      lastSeenAt: nowIso,
      lastConfirmedAt: nowIso,
    }));
  });

  extract(/our product(?:\/service)? is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('offer');
    addFact(makeFact({
      key: 'product_description',
      value,
      confidence: 0.82,
      lastSeenAt: nowIso,
      lastConfirmedAt: nowIso,
    }));
  });

  extract(/our pricing is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('pricing');
    addFact(makeFact({
      key: 'pricing',
      value,
      confidence: 0.8,
      lastSeenAt: nowIso,
      lastConfirmedAt: nowIso,
    }));
  });

  extract(/we (?:mainly )?sell to ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('audience');
    addFact(makeFact({
      key: 'target_customers',
      value,
      confidence: 0.8,
      lastSeenAt: nowIso,
      lastConfirmedAt: nowIso,
    }));
  });

  extract(/we(?:'re| are) focused on ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('goals');
    addFact(makeFact({
      key: 'active_goals',
      value,
      confidence: 0.78,
      source: 'user_stated',
      lastSeenAt: nowIso,
      lastConfirmedAt: nowIso,
    }));
  });

  extract(/(?:our active project|this project|the project|our launch campaign|this campaign|our initiative) (?:is called|is named|is|called|named) ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('project');
    ensureProject(value);
  });

  extract(/we(?:'re| are) launching ([^.]+?)(?: in| with| for|\.|$)/i, (value) => {
    suggestedLoreTags.add('launch');
    ensureProject(`${value} launch`);
  });

  extract(/project objective is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('project');
    const project = ensureProject('Current Project');
    if (project) {
      project.objective = value;
      addProjectFact({ key: 'project_objective', value, confidence: 0.84 });
    }
  });

  extract(/launch objective is ([^.]+)(?:\.|$)/i, (value) => {
    suggestedLoreTags.add('launch');
    const project = ensureProject('Launch Initiative');
    if (project) {
      project.objective = value;
      addProjectFact({ key: 'project_objective', value, confidence: 0.84 });
    }
  });

  extract(/project status is (active|paused|completed|archived)(?:\.|$)/i, (value) => {
    const project = ensureProject('Current Project');
    if (project) {
      project.status = value.toLowerCase();
    }
  });

  extract(/milestone(?: is|:)? ([^.]+)(?:\.|$)/i, (value) => {
    const project = ensureProject('Current Project');
    if (project && !isUnsafeMemoryFact(value)) {
      project.milestones.push(value);
      addProjectFact({ key: 'project_milestone', value, confidence: 0.76 });
    }
  });

  extract(/project risk(?: is|:)? ([^.]+)(?:\.|$)/i, (value) => {
    const project = ensureProject('Current Project');
    if (project && !isUnsafeMemoryFact(value)) {
      project.risks.push(value);
      addProjectFact({ key: 'project_risk', value, confidence: 0.72, source: 'agent_inferred' });
    }
  });

  extract(/open question(?: is|:)? ([^.]+)(?:\.|$)/i, (value) => {
    const project = ensureProject('Current Project');
    if (project && !isUnsafeMemoryFact(value)) {
      project.openQuestions.push(value);
      addProjectFact({ key: 'project_open_question', value, confidence: 0.7, source: 'agent_inferred' });
    }
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
      lastSeenAt: nowIso,
    }));
  });

  if (facts.length === 0) {
    if (!detectedProject) {
      return null;
    }
  }

  const globalSummary = facts
    .slice(0, 4)
    .map((fact) => `${fact.key.replace(/_/g, ' ')}: ${fact.value}`)
    .join('; ');

  const agentSummary = assistantSummary
    || `Recent ${agentId} conversation clarified: ${globalSummary}`;

  if (detectedProject && !detectedProject.objective && facts.length > 0) {
    const bestObjective = facts.find((fact) => ['active_goals', 'product_description', 'pricing'].includes(fact.key));
    if (bestObjective) {
      detectedProject.objective = bestObjective.value;
    }
  }

  const projectSummary = detectedProject
    ? `Project ${detectedProject.projectName}: ${detectedProject.objective ?? 'Active initiative context updated.'}`
    : null;

  const update = {
    global: {
      scope: 'global',
      agentId,
      conversationId,
      summary: globalSummary || projectSummary,
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

  if (detectedProject) {
    update.project = {
      scope: 'project',
      agentId,
      conversationId,
      projectId: detectedProject.projectId,
      projectName: detectedProject.projectName,
      status: detectedProject.status,
      objective: detectedProject.objective,
      relatedAgents: [...new Set(detectedProject.relatedAgents)],
      facts: dedupeMemoryFacts(detectedProject.facts).map((fact) => ({
        ...fact,
        projectId: detectedProject.projectId,
        projectName: detectedProject.projectName,
        projectStatus: detectedProject.status,
      })),
      decisions: detectedProject.decisions,
      openQuestions: detectedProject.openQuestions,
      milestones: detectedProject.milestones,
      risks: detectedProject.risks,
      lastUpdatedAt: nowIso,
      summary: projectSummary,
      suggestedLoreTags: [...new Set([...suggestedLoreTags, 'project', detectedProject.projectId])],
    };
  }

  return update;
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
