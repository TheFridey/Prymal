export class LoreContextProvider {
  constructor({
    vectorMemory,
    knowledgeGraph,
    executionMemory,
    clock = () => new Date(),
    defaultTopK = 5,
  } = {}) {
    this.vectorMemory = vectorMemory ?? { search: async () => [] };
    this.knowledgeGraph = knowledgeGraph ?? { query: async () => [] };
    this.executionMemory = executionMemory ?? { findRelevant: async () => [] };
    this.clock = clock;
    this.defaultTopK = defaultTopK;
  }

  async buildContext({
    orgId,
    userId = null,
    workflowId,
    workflowType,
    nodeId,
    nodeType,
    input,
    topK = this.defaultTopK,
  }) {
    const query = buildContextQuery(input);
    const now = this.clock();
    const [vectorItems, graphItems, executionItems] = await Promise.all([
      this.vectorMemory.search({ orgId, userId, workflowId, nodeId, query, limit: topK * 2 }),
      this.knowledgeGraph.query({ orgId, userId, workflowId, workflowType, nodeId, nodeType, input, limit: topK * 2 }),
      this.executionMemory.findRelevant({ orgId, workflowId, workflowType, nodeId, nodeType, input, limit: topK * 2 }),
    ]);

    return normalizeItems([
      ...vectorItems.map((item) => ({ ...item, layer: 'vector_memory' })),
      ...graphItems.map((item) => ({ ...item, layer: 'knowledge_graph' })),
      ...executionItems.map((item) => ({ ...item, layer: 'execution_memory' })),
    ], now)
      .sort((left, right) => right.contextScore - left.contextScore)
      .slice(0, topK)
      .map((item) => ({
        id: item.id,
        layer: item.layer,
        title: item.title ?? null,
        content: item.content,
        context_score: item.contextScore,
        relevance_score: item.relevanceScore,
        recency_score: item.recencyScore,
        metadata: item.metadata ?? {},
      }));
  }

  async recordExecutionOutcome(_outcome) {
    if (typeof this.executionMemory.recordOutcome === 'function') {
      return this.executionMemory.recordOutcome(_outcome);
    }

    return null;
  }
}

function normalizeItems(items, now) {
  return items
    .filter((item) => item && item.content !== undefined)
    .map((item, index) => {
      const relevanceScore = clampScore(item.relevanceScore ?? item.similarity ?? item.score ?? 0.5);
      const recencyScore = calculateRecencyScore(item.updatedAt ?? item.createdAt, now);
      const workflowScore = clampScore(item.workflowScore ?? 0.5);
      const contextScore = Number((relevanceScore * 0.52 + recencyScore * 0.24 + workflowScore * 0.24).toFixed(4));

      return {
        id: String(item.id ?? `${item.layer}-${index}`),
        layer: item.layer,
        title: item.title,
        content: item.content,
        metadata: item.metadata ?? {},
        relevanceScore,
        recencyScore,
        contextScore,
      };
    });
}

function buildContextQuery(input) {
  if (typeof input === 'string') {
    return input;
  }

  if (!input || typeof input !== 'object') {
    return '';
  }

  return Object.values(input)
    .filter((value) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(String)
    .join(' ')
    .slice(0, 4000);
}

function calculateRecencyScore(dateLike, now) {
  if (!dateLike) {
    return 0.45;
  }

  const updated = new Date(dateLike).getTime();
  if (!Number.isFinite(updated)) {
    return 0.45;
  }

  const ageDays = Math.max(0, (now.getTime() - updated) / 86_400_000);
  return Number(Math.max(0.15, Math.min(1, 1 / (1 + ageDays / 30))).toFixed(4));
}

function clampScore(value) {
  return Math.min(1, Math.max(0, Number(value ?? 0)));
}
