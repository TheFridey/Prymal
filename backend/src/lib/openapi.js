export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Prymal API',
    version: '1.0.0',
    description:
      'Multi-agent AI orchestration platform API.\n\n' +
      '**Authentication**: All `/api/*` routes require a valid Clerk JWT or (Agency plan) a Prymal API key ' +
      'passed as a `Bearer` token in the `Authorization` header.\n\n' +
      'API keys are available to Agency-plan organisations under Settings → API Keys.',
    contact: { name: 'Prymal Support', url: 'https://prymal.io' },
  },
  servers: [
    { url: 'https://prymal.io/api', description: 'Production' },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    { name: 'Agents', description: 'Send messages to Prymal agents and stream responses.' },
    { name: 'Workflows', description: 'Build, run, and manage multi-agent workflow automations.' },
    { name: 'LORE', description: 'Upload and search workspace knowledge.' },
    { name: 'Memory', description: 'Read and write the agent memory graph.' },
    { name: 'Usage', description: 'Credit usage and billing summary.' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Clerk session JWT **or** Prymal API key (Agency plan). ' +
          'API key format: `prym_live_xxxxxxxxxxxxxxxx`.',
      },
    },
    schemas: {
      AgentId: {
        type: 'string',
        enum: [
          'CIPHER', 'HERALD', 'LORE', 'FORGE', 'ATLAS', 'ECHO',
          'ORACLE', 'VANCE', 'WREN', 'LEDGER', 'NEXUS', 'SCOUT', 'SAGE', 'PIXEL',
        ],
        description: 'Agent identifier. SENTINEL is internal-only and not available via the API.',
      },
      ChatRequest: {
        type: 'object',
        required: ['agent_id', 'message'],
        properties: {
          agent_id: { $ref: '#/components/schemas/AgentId' },
          message: { type: 'string', maxLength: 32000, description: 'User message text.' },
          conversation_id: { type: 'string', nullable: true, description: 'Resume an existing conversation.' },
          stream: { type: 'boolean', default: true, description: 'Set false to receive a single JSON response instead of SSE.' },
          use_lore: { type: 'boolean', default: false, description: 'Enable LORE retrieval for this turn.' },
          preferences: {
            type: 'object',
            properties: {
              response_length: { type: 'string', enum: ['short', 'medium', 'long'] },
              tone: { type: 'string' },
              custom_instructions: { type: 'string' },
            },
          },
        },
      },
      ChatResponseSSE: {
        type: 'string',
        description:
          'Server-Sent Events stream. Each `data:` line is a JSON object with a `type` field.\n\n' +
          '- `type: "started"` — conversation ID confirmed\n' +
          '- `type: "chunk"` — text delta (`text` field)\n' +
          '- `type: "done"` — completion with token counts, sources, and SENTINEL verdict\n' +
          '- `type: "hold"` — SENTINEL held the response for review\n' +
          '- `type: "error"` — terminal error',
      },
      Agent: {
        type: 'object',
        properties: {
          id: { $ref: '#/components/schemas/AgentId' },
          name: { type: 'string' },
          description: { type: 'string' },
          default_policy: { type: 'string' },
        },
      },
      Workflow: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          trigger_type: { type: 'string', enum: ['manual', 'schedule', 'webhook', 'event'] },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      WorkflowRun: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          workflow_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
          triggered_by: { type: 'string', enum: ['manual', 'schedule', 'webhook', 'api'] },
          credits_used: { type: 'integer' },
          started_at: { type: 'string', format: 'date-time', nullable: true },
          completed_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      LoreDocument: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          source_type: { type: 'string', enum: ['text', 'file', 'url'] },
          chunk_count: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      LoreSearchResult: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          document_id: { type: 'string' },
          document_title: { type: 'string', nullable: true },
          content: { type: 'string' },
          similarity: { type: 'number', format: 'float' },
          source_url: { type: 'string', nullable: true },
        },
      },
      MemoryEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          key: { type: 'string' },
          value: { type: 'string' },
          scope: { type: 'string', enum: ['org', 'user', 'agent_private', 'restricted', 'temporary_session', 'workflow_run'] },
          agent_id: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      UsageSummary: {
        type: 'object',
        properties: {
          execution: {
            type: 'object',
            properties: {
              available: { type: 'integer' },
              used: { type: 'integer' },
              limit: { type: 'integer' },
              percent_used: { type: 'number' },
            },
          },
          video: {
            type: 'object',
            properties: {
              available: { type: 'integer' },
              used: { type: 'integer' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string', nullable: true },
          request_id: { type: 'string', nullable: true },
          upgrade: { type: 'boolean', nullable: true },
        },
      },
    },
    responses: {
      Unauthorised: {
        description: 'Missing or invalid authentication token.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Authenticated but not permitted to access this resource.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Request rate or credit limit exceeded for your plan tier.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    // ── Agents ─────────────────────────────────────────────────────────────
    '/agents': {
      get: {
        summary: 'List available agents',
        operationId: 'listAgents',
        tags: ['Agents'],
        responses: {
          '200': {
            description: 'Array of agents available to your organisation (SENTINEL excluded).',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Agent' } } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/agents/chat': {
      post: {
        summary: 'Send a message to an agent',
        operationId: 'chatWithAgent',
        tags: ['Agents'],
        description:
          'Sends a message to the specified agent. When `stream: true` (default) the response is ' +
          'a Server-Sent Events stream. SENTINEL review runs automatically; a `hold` event means ' +
          'the response was flagged for operator review.\n\n' +
          'Set `Content-Type: application/json` and `Accept: text/event-stream` when streaming.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } },
        },
        responses: {
          '200': {
            description: 'SSE stream (stream=true) or JSON response (stream=false).',
            content: {
              'text/event-stream': { schema: { $ref: '#/components/schemas/ChatResponseSSE' } },
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    conversation_id: { type: 'string' },
                    tokens_used: { type: 'integer' },
                    model: { type: 'string' },
                    provider: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '402': {
            description: 'Execution credits exhausted.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/agents/conversations': {
      get: {
        summary: 'List conversations',
        operationId: 'listConversations',
        tags: ['Agents'],
        parameters: [
          { name: 'agent_id', in: 'query', schema: { $ref: '#/components/schemas/AgentId' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': { description: 'Paginated conversation list.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/agents/conversations/{conversationId}/messages': {
      get: {
        summary: 'Get messages in a conversation',
        operationId: 'getConversationMessages',
        tags: ['Agents'],
        parameters: [
          { name: 'conversationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Message history for the conversation.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '404': { description: 'Conversation not found.' },
        },
      },
    },
    '/agents/conversations/{conversationId}': {
      delete: {
        summary: 'Delete a conversation',
        operationId: 'deleteConversation',
        tags: ['Agents'],
        parameters: [
          { name: 'conversationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Conversation deleted.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    // ── Workflows ───────────────────────────────────────────────────────────
    '/workflows': {
      get: {
        summary: 'List workflows',
        operationId: 'listWorkflows',
        tags: ['Workflows'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Workflow list.',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Workflow' } } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
      post: {
        summary: 'Create a workflow',
        operationId: 'createWorkflow',
        tags: ['Workflows'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'trigger_type', 'nodes', 'edges'],
                properties: {
                  name: { type: 'string', maxLength: 120 },
                  description: { type: 'string', maxLength: 500 },
                  trigger_type: { type: 'string', enum: ['manual', 'schedule', 'webhook', 'event'] },
                  trigger_config: { type: 'object' },
                  nodes: { type: 'array', items: { type: 'object' } },
                  edges: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Workflow created.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Workflow' } } } },
          '400': { description: 'Invalid workflow definition.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/workflows/{id}': {
      get: {
        summary: 'Get a workflow',
        operationId: 'getWorkflow',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Workflow detail.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Workflow' } } } },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '404': { description: 'Not found.' },
        },
      },
      put: {
        summary: 'Update a workflow',
        operationId: 'updateWorkflow',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Workflow' } } } },
        responses: {
          '200': { description: 'Updated.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
      delete: {
        summary: 'Delete a workflow',
        operationId: 'deleteWorkflow',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Deleted.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/workflows/{id}/run': {
      post: {
        summary: 'Trigger a workflow run',
        operationId: 'runWorkflow',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '202': {
            description: 'Run queued.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkflowRun' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '402': { description: 'Credits exhausted.' },
        },
      },
    },
    '/workflows/{id}/runs': {
      get: {
        summary: 'List runs for a workflow',
        operationId: 'listWorkflowRuns',
        tags: ['Workflows'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Run history.',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/WorkflowRun' } } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    // ── LORE ───────────────────────────────────────────────────────────────
    '/lore': {
      get: {
        summary: 'List LORE documents',
        operationId: 'listLoreDocuments',
        tags: ['LORE'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Document list.',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/LoreDocument' } } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/lore/search': {
      get: {
        summary: 'Search the LORE knowledge base',
        operationId: 'searchLore',
        tags: ['LORE'],
        description: 'Hybrid RAG search combining semantic similarity and keyword matching.',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query.' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } },
        ],
        responses: {
          '200': {
            description: 'Ranked search results.',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/LoreSearchResult' } } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/lore/text': {
      post: {
        summary: 'Ingest text into LORE',
        operationId: 'ingestLoreText',
        tags: ['LORE'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string' },
                  title: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Ingestion queued.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/lore/crawl': {
      post: {
        summary: 'Crawl a URL into LORE',
        operationId: 'crawlLoreUrl',
        tags: ['LORE'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: { url: { type: 'string', format: 'uri' } },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Crawl queued.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/lore/{id}': {
      delete: {
        summary: 'Delete a LORE document',
        operationId: 'deleteLoreDocument',
        tags: ['LORE'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Deleted.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '404': { description: 'Not found.' },
        },
      },
    },
    // ── Memory ─────────────────────────────────────────────────────────────
    '/memory': {
      get: {
        summary: 'List memory entries',
        operationId: 'listMemory',
        tags: ['Memory'],
        parameters: [
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['org', 'user', 'agent_private', 'restricted'] } },
          { name: 'agent_id', in: 'query', schema: { $ref: '#/components/schemas/AgentId' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Memory entries.',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MemoryEntry' } } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
      post: {
        summary: 'Write a memory entry',
        operationId: 'writeMemory',
        tags: ['Memory'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'value', 'scope'],
                properties: {
                  key: { type: 'string' },
                  value: { type: 'string' },
                  scope: { type: 'string', enum: ['org', 'user', 'agent_private'] },
                  agent_id: { $ref: '#/components/schemas/AgentId' },
                  expires_at: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Memory entry written.', content: { 'application/json': { schema: { $ref: '#/components/schemas/MemoryEntry' } } } },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/memory/{id}': {
      get: {
        summary: 'Get a memory entry',
        operationId: 'getMemoryEntry',
        tags: ['Memory'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Memory entry.', content: { 'application/json': { schema: { $ref: '#/components/schemas/MemoryEntry' } } } },
          '401': { $ref: '#/components/responses/Unauthorised' },
          '404': { description: 'Not found.' },
        },
      },
      patch: {
        summary: 'Update a memory entry',
        operationId: 'updateMemoryEntry',
        tags: ['Memory'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { value: { type: 'string' }, expires_at: { type: 'string', format: 'date-time', nullable: true } } },
            },
          },
        },
        responses: {
          '200': { description: 'Updated.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
      delete: {
        summary: 'Delete a memory entry',
        operationId: 'deleteMemoryEntry',
        tags: ['Memory'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Deleted.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    // ── Usage ──────────────────────────────────────────────────────────────
    '/usage/summary': {
      get: {
        summary: 'Credit usage summary',
        operationId: 'getUsageSummary',
        tags: ['Usage'],
        responses: {
          '200': {
            description: 'Current credit balances for execution and video.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UsageSummary' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
    '/usage/breakdown': {
      get: {
        summary: 'Detailed usage breakdown',
        operationId: 'getUsageBreakdown',
        tags: ['Usage'],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'Usage breakdown by agent and day.' },
          '401': { $ref: '#/components/responses/Unauthorised' },
        },
      },
    },
  },
};
