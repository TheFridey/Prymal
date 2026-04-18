// ─────────────────────────────────────────────────────────────────
// agents/output-schemas.js
// Runtime-enforceable JSON schemas for priority agent structured outputs.
// Used by agent-output-validator.js to validate and repair LLM responses.
//
// Schema format:
//   { type, properties, required, ... }
// Compatible with AJV / standard JSON Schema draft-07.
// ─────────────────────────────────────────────────────────────────

/**
 * CIPHER — cipher.scorecard
 * Structured data-analysis output with executive summary, key metrics, anomalies, recommendations.
 */
export const CIPHER_SCORECARD = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'cipher.scorecard',
  type: 'object',
  required: ['agent', 'summary', 'keyMetrics', 'anomalies', 'recommendations'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'cipher' },
    summary: { type: 'string', minLength: 10 },
    keyMetrics: {
      type: 'object',
      additionalProperties: {
        oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
      },
    },
    anomalies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          metric: { type: 'string' },
        },
      },
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    dataQuality: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
  },
};

/**
 * LEDGER — ledger.financeSummary
 * Finance commentary output with period, headline, variances, cashflow, and commentary.
 */
export const LEDGER_FINANCE_SUMMARY = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'ledger.financeSummary',
  type: 'object',
  required: ['agent', 'period', 'headline', 'commentary', 'totals', 'forecasts', 'confidenceNotes'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'ledger' },
    period: { type: 'string', minLength: 1 },
    headline: { type: 'string', minLength: 10 },
    totals: {
      type: 'object',
      required: ['revenue', 'costs', 'grossMargin'],
      properties: {
        revenue: { type: 'number' },
        costs: { type: 'number' },
        grossMargin: { type: 'number' },
        operatingProfit: { type: 'number' },
        cashBalance: { type: 'number' },
      },
    },
    forecasts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['metric', 'period', 'value'],
        properties: {
          metric: { type: 'string' },
          period: { type: 'string' },
          value: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    revenue: {
      type: 'object',
      properties: {
        actual: { type: 'number' },
        budget: { type: 'number' },
        variance: { type: 'number' },
        variancePct: { type: 'number' },
      },
    },
    costs: {
      type: 'object',
      properties: {
        actual: { type: 'number' },
        budget: { type: 'number' },
        variance: { type: 'number' },
      },
    },
    cashflow: {
      type: 'object',
      properties: {
        openingBalance: { type: 'number' },
        closingBalance: { type: 'number' },
        netMovement: { type: 'number' },
        runway: { type: 'string' },
      },
    },
    commentary: { type: 'string', minLength: 20 },
    flags: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'description'],
        properties: {
          category: { type: 'string', enum: ['risk', 'opportunity', 'anomaly', 'advisory'] },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    confidenceNotes: { type: 'array', minItems: 1, items: { type: 'string' } },
    disclaimer: { type: 'string' },
  },
};

/**
 * NEXUS — nexus.workflowState
 * Workflow orchestration plan output with steps, handoffs, failure modes.
 */
export const NEXUS_WORKFLOW_STATE = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'nexus.workflowState',
  type: 'object',
  required: ['agent', 'workflowName', 'steps', 'nodeGraph', 'executionAssumptions'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'nexus' },
    workflowName: { type: 'string', minLength: 1 },
    objective: { type: 'string' },
    nodeGraph: {
      type: 'object',
      required: ['nodes', 'edges'],
      properties: {
        nodes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['id', 'agentId', 'label'],
            properties: {
              id: { type: 'string' },
              agentId: { type: 'string' },
              label: { type: 'string' },
            },
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              condition: { type: 'string' },
            },
          },
        },
      },
    },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['stepId', 'agentId', 'task'],
        properties: {
          stepId: { type: 'string' },
          agentId: { type: 'string' },
          task: { type: 'string', minLength: 5 },
          inputFrom: { type: 'array', items: { type: 'string' } },
          outputTo: { type: 'array', items: { type: 'string' } },
          condition: { type: 'string' },
          fallback: { type: 'string' },
          estimatedDuration: { type: 'string' },
        },
      },
    },
    triggers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['manual', 'schedule', 'webhook', 'event'] },
          config: { type: 'object' },
        },
      },
    },
    failureModes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['scenario', 'mitigation'],
        properties: {
          scenario: { type: 'string' },
          mitigation: { type: 'string' },
        },
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    executionAssumptions: { type: 'array', minItems: 1, items: { type: 'string' } },
  },
};

/**
 * VANCE — vance.dealSummary
 * Sales pipeline qualification output.
 */
export const VANCE_DEAL_SUMMARY = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'vance.dealSummary',
  type: 'object',
  required: ['agent', 'companyName', 'qualificationScore', 'stage', 'nextAction', 'confidence', 'suggestedNextAction'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'vance' },
    companyName: { type: 'string', minLength: 1 },
    contactName: { type: 'string' },
    qualificationScore: { type: 'number', minimum: 0, maximum: 10 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    stage: {
      type: 'string',
      enum: ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'nurture'],
    },
    budget: {
      type: 'object',
      properties: {
        confirmed: { type: 'boolean' },
        estimatedValue: { type: 'number' },
        currency: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    authority: {
      type: 'object',
      properties: {
        decisionMaker: { type: 'string' },
        championName: { type: 'string' },
        stakeholders: { type: 'array', items: { type: 'string' } },
      },
    },
    need: { type: 'string' },
    timeline: { type: 'string' },
    objections: { type: 'array', items: { type: 'string' } },
    competitorsIdentified: { type: 'array', items: { type: 'string' } },
    nextAction: { type: 'string', minLength: 5 },
    suggestedNextAction: { type: 'string', minLength: 5 },
    recommendedAgent: { type: 'string' },
    confidenceNotes: { type: 'string' },
  },
};

/**
 * HERALD — herald.sequence
 * Outreach email sequence output.
 */
export const HERALD_SEQUENCE = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'herald.sequence',
  type: 'object',
  required: ['agent', 'sequenceName', 'emails'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'herald' },
    sequenceName: { type: 'string', minLength: 1 },
    targetAudience: { type: 'string' },
    totalEmails: { type: 'integer', minimum: 1 },
    emails: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['emailNumber', 'sendDay', 'subject', 'body', 'cta'],
        properties: {
          emailNumber: { type: 'integer', minimum: 1 },
          sendDay: { type: 'integer', minimum: 0 },
          subject: { type: 'string', minLength: 5 },
          preview: { type: 'string' },
          body: { type: 'string', minLength: 20 },
          cta: { type: 'string', minLength: 5 },
          tone: { type: 'string' },
          abVariants: {
            type: 'array',
            items: {
              type: 'object',
              required: ['variant', 'subject'],
              properties: {
                variant: { type: 'string' },
                subject: { type: 'string' },
              },
            },
          },
        },
      },
    },
    notes: { type: 'string' },
  },
};

/**
 * LORE — lore.sourceDigest
 * Knowledge retrieval output with sources, gaps identified, and contradictions flagged.
 */
export const LORE_SOURCE_DIGEST = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'lore.sourceDigest',
  type: 'object',
  required: ['agent', 'chunksRetrieved', 'sources'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'lore' },
    chunksRetrieved: { type: 'integer', minimum: 0 },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        required: ['documentTitle'],
        properties: {
          documentTitle: { type: 'string' },
          sourceUrl: { type: 'string' },
          chunkIndex: { type: 'integer' },
          similarity: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    gapsIdentified: {
      type: 'array',
      items: { type: 'string' },
    },
    contradictionsFound: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          existingDocumentTitle: { type: 'string' },
          type: { type: 'string' },
          excerpt: { type: 'string' },
        },
      },
    },
    knowledgeGapDetected: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'ungrounded'] },
  },
};

/**
 * FORGE — forge.contentBrief
 * Content production output (landing page, blog, ad copy, case study).
 */
export const FORGE_CONTENT_BRIEF = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'forge.contentBrief',
  type: 'object',
  required: ['agent', 'contentType', 'headline', 'body'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'forge' },
    contentType: {
      type: 'string',
      enum: ['landing_page', 'blog_post', 'ad_copy', 'case_study', 'email', 'social', 'other'],
    },
    headline: { type: 'string', minLength: 5 },
    subheadline: { type: 'string' },
    body: { type: 'string', minLength: 30 },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['heading', 'content'],
        properties: {
          heading: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string', enum: ['intro', 'feature', 'proof', 'cta', 'faq', 'other'] },
        },
      },
    },
    cta: { type: 'string' },
    seoKeywords: { type: 'array', items: { type: 'string' } },
    wordCount: { type: 'integer' },
    targetAudience: { type: 'string' },
    tone: { type: 'string' },
    brandAlignment: { type: 'string', enum: ['strong', 'moderate', 'speculative'] },
    sourcesUsed: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * ATLAS — atlas.planOutline
 * Project and operations planning output with phases, tasks, and delivery risk.
 */
export const ATLAS_PLAN_OUTLINE = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'atlas.planOutline',
  type: 'object',
  required: ['agent', 'objective', 'phases', 'totalTasks'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'atlas' },
    objective: { type: 'string', minLength: 10 },
    phases: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name', 'tasks'],
        properties: {
          name: { type: 'string', minLength: 2 },
          goal: { type: 'string' },
          tasks: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['title', 'owner', 'dueDay', 'successCriteria'],
              properties: {
                title: { type: 'string', minLength: 5 },
                owner: { type: 'string', minLength: 2 },
                dueDay: { type: 'string', minLength: 1 },
                dependencies: { type: 'array', items: { type: 'string' } },
                successCriteria: { type: 'string', minLength: 5 },
              },
            },
          },
        },
      },
    },
    totalTasks: { type: 'integer', minimum: 1 },
    agentTasksAssigned: { type: 'array', items: { type: 'string' } },
    exportFormat: {
      type: 'string',
      enum: ['notion', 'trello', 'linear', 'asana', 'markdown', 'none'],
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string', minLength: 5 },
          mitigation: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * ECHO — echo.socialContent
 * Social media and brand voice content output.
 */
export const ECHO_SOCIAL_CONTENT = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'echo.socialContent',
  type: 'object',
  required: ['agent', 'platform', 'posts'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'echo' },
    platform: {
      type: 'string',
      enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'threads', 'multi', 'other'],
    },
    campaignName: { type: 'string' },
    posts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 5 },
          platform: { type: 'string' },
          scheduledFor: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          mediaPrompt: { type: 'string' },
          tone: { type: 'string' },
          abVariants: { type: 'array', items: { type: 'object', properties: { variant: { type: 'string' }, content: { type: 'string' } } } },
        },
      },
    },
    brandVoiceScore: { type: 'number', minimum: 0, maximum: 10 },
    notes: { type: 'string' },
  },
};

/**
 * PIXEL — pixel.assetManifest
 * Visual asset output with generated URLs, briefs, and iteration metadata.
 */
export const PIXEL_ASSET_MANIFEST = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'pixel.assetManifest',
  type: 'object',
  required: ['agent', 'objective', 'assetsGenerated', 'assetUrls', 'briefs', 'iterationsUsed'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'pixel' },
    objective: { type: 'string', minLength: 10 },
    assetType: {
      type: 'string',
      enum: ['logo', 'banner', 'social_graphic', 'illustration', 'infographic', 'ui_mockup', 'hero_image', 'presentation', 'other'],
    },
    assetsGenerated: { type: 'integer', minimum: 0 },
    assetUrls: { type: 'array', items: { type: 'string', minLength: 5 } },
    briefs: { type: 'array', items: { type: 'string', minLength: 5 } },
    iterationsUsed: { type: 'integer', minimum: 0 },
    generatedImagePrompts: { type: 'array', items: { type: 'string' } },
    brandAligned: { type: 'boolean' },
    notes: { type: 'string' },
  },
};

/**
 * ORACLE — oracle.auditReport
 * URL and content audit output.
 */
export const ORACLE_AUDIT_REPORT = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'oracle.auditReport',
  type: 'object',
  required: ['agent', 'url', 'overallScore', 'findings'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'oracle' },
    url: { type: 'string', minLength: 5 },
    auditedAt: { type: 'string' },
    overallScore: { type: 'number', minimum: 0, maximum: 10 },
    findings: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['category', 'description', 'severity'],
        properties: {
          category: {
            type: 'string',
            enum: ['seo', 'performance', 'accessibility', 'content', 'trust', 'conversion', 'brand', 'legal', 'technical', 'other'],
          },
          description: { type: 'string', minLength: 5 },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          recommendation: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    categories: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: 0, maximum: 10 },
          summary: { type: 'string' },
        },
      },
    },
    quickWins: { type: 'array', items: { type: 'string' } },
    strategicRecommendations: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * WREN — wren.supportResponse
 * Customer support response and escalation decision output.
 */
export const WREN_SUPPORT_RESPONSE = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'wren.supportResponse',
  type: 'object',
  required: ['agent', 'intent', 'response', 'escalate'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'wren' },
    intent: {
      type: 'string',
      enum: ['billing_query', 'technical_issue', 'feature_request', 'complaint', 'refund_request', 'account_access', 'general_query', 'other'],
    },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'frustrated', 'angry', 'confused'] },
    response: { type: 'string', minLength: 20 },
    escalate: { type: 'boolean' },
    escalationReason: { type: 'string' },
    escalationSeverity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    suggestedActions: { type: 'array', items: { type: 'string' } },
    refundAmount: { type: 'number', minimum: 0 },
    refundCurrency: { type: 'string' },
    ticketCategory: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
};

/**
 * SCOUT — scout.researchReport
 * Competitive intelligence and market research output.
 */
export const SCOUT_RESEARCH_REPORT = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'scout.researchReport',
  type: 'object',
  required: ['agent', 'topic', 'summary', 'sources'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'scout' },
    topic: { type: 'string', minLength: 3 },
    summary: { type: 'string', minLength: 30 },
    keyFindings: { type: 'array', minItems: 1, items: { type: 'string' } },
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          marketPosition: { type: 'string' },
        },
      },
    },
    trends: { type: 'array', items: { type: 'string' } },
    opportunities: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          publishedAt: { type: 'string' },
          relevanceScore: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    researchDepth: { type: 'string', enum: ['surface', 'moderate', 'deep'] },
  },
};

/**
 * SAGE — sage.strategicBrief
 * Strategic advisory and business planning output.
 */
export const SAGE_STRATEGIC_BRIEF = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'sage.strategicBrief',
  type: 'object',
  required: ['agent', 'objective', 'situation', 'recommendations'],
  additionalProperties: true,
  properties: {
    agent: { type: 'string', const: 'sage' },
    objective: { type: 'string', minLength: 10 },
    situation: { type: 'string', minLength: 20 },
    stakeholders: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          interest: { type: 'string' },
          influence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    options: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          pros: { type: 'array', items: { type: 'string' } },
          cons: { type: 'array', items: { type: 'string' } },
          estimatedImpact: { type: 'string', enum: ['low', 'medium', 'high'] },
          estimatedEffort: { type: 'string', enum: ['low', 'medium', 'high'] },
          recommendationScore: { type: 'number', minimum: 0, maximum: 10 },
        },
      },
    },
    recommendations: { type: 'array', minItems: 1, items: { type: 'string' } },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string' },
          likelihood: { type: 'string', enum: ['low', 'medium', 'high'] },
          impact: { type: 'string', enum: ['low', 'medium', 'high'] },
          mitigation: { type: 'string' },
        },
      },
    },
    timeframe: { type: 'string' },
    successMetrics: { type: 'array', items: { type: 'string' } },
    confidenceLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

/**
 * SENTINEL — sentinel.reviewVerdict
 * Output review verdict from the Sentinel QA agent.
 */
export const SENTINEL_REVIEW_VERDICT = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'sentinel.reviewVerdict',
  type: 'object',
  required: ['verdict', 'riskScore', 'reviewedAgentId', 'checks'],
  additionalProperties: true,
  properties: {
    verdict: { type: 'string', enum: ['pass', 'repair', 'hold'] },
    riskScore: { type: 'number', minimum: 0, maximum: 1 },
    reviewedAgentId: { type: 'string' },
    checks: {
      type: 'object',
      required: ['accuracy', 'compliance', 'schemaValidity', 'citationConfidence'],
      properties: {
        accuracy: {
          type: 'object',
          required: ['pass'],
          properties: { pass: { type: 'boolean' }, notes: { type: 'string' } },
        },
        compliance: {
          type: 'object',
          required: ['pass'],
          properties: { pass: { type: 'boolean' }, notes: { type: 'string' } },
        },
        schemaValidity: {
          type: 'object',
          required: ['pass'],
          properties: { pass: { type: 'boolean' }, notes: { type: 'string' } },
        },
        citationConfidence: {
          type: 'object',
          required: ['pass'],
          properties: { pass: { type: 'boolean' }, notes: { type: 'string' } },
        },
      },
    },
    repairedOutput: {},
    repairNotes: { type: ['string', 'null'] },
    holdReason: { type: ['string', 'null'] },
    suggestedNextAction: { type: ['string', 'null'] },
  },
};

// ─── Registry ────────────────────────────────────────────────────

export const AGENT_OUTPUT_SCHEMAS = {
  'cipher.scorecard': CIPHER_SCORECARD,
  'ledger.financeSummary': LEDGER_FINANCE_SUMMARY,
  'nexus.workflowState': NEXUS_WORKFLOW_STATE,
  'vance.dealSummary': VANCE_DEAL_SUMMARY,
  'herald.sequence': HERALD_SEQUENCE,
  'lore.sourceDigest': LORE_SOURCE_DIGEST,
  'forge.contentBrief': FORGE_CONTENT_BRIEF,
  'atlas.contentSummary': ATLAS_PLAN_OUTLINE,
  'atlas.planOutline': ATLAS_PLAN_OUTLINE,
  'echo.socialContent': ECHO_SOCIAL_CONTENT,
  'echo.socialPlan': ECHO_SOCIAL_CONTENT,
  'pixel.designBrief': PIXEL_ASSET_MANIFEST,
  'pixel.assetManifest': PIXEL_ASSET_MANIFEST,
  'oracle.auditReport': ORACLE_AUDIT_REPORT,
  'oracle.seoAudit': ORACLE_AUDIT_REPORT,
  'wren.supportResponse': WREN_SUPPORT_RESPONSE,
  'wren.supportResolution': WREN_SUPPORT_RESPONSE,
  'scout.researchReport': SCOUT_RESEARCH_REPORT,
  'scout.marketScan': SCOUT_RESEARCH_REPORT,
  'sage.strategicBrief': SAGE_STRATEGIC_BRIEF,
  'sage.decisionMemo': SAGE_STRATEGIC_BRIEF,
  'sentinel.reviewVerdict': SENTINEL_REVIEW_VERDICT,
};

/**
 * Get the output schema for an agent by its outputSchema contract field.
 * @param {string} schemaId  e.g. 'cipher.scorecard'
 * @returns {object|null}
 */
export function getOutputSchema(schemaId) {
  return AGENT_OUTPUT_SCHEMAS[schemaId] ?? null;
}

/**
 * Agents that require runtime schema validation on every structured response.
 * These are the 6 priority agents + sentinel.
 */
export const SCHEMA_ENFORCED_AGENTS = new Set([
  'cipher',
  'ledger',
  'nexus',
  'vance',
  'herald',
  'lore',
  'forge',
  'atlas',
  'echo',
  'pixel',
  'oracle',
  'wren',
  'scout',
  'sage',
  'sentinel',
]);
