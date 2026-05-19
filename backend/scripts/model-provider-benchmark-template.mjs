import process from 'node:process';

const template = {
  benchmarkRun: {
    generatedAt: new Date().toISOString(),
    generatedBy: 'model-provider-benchmark-template',
    internalOnly: true,
    notes: 'Template only. No API calls were made.',
  },
  currentInternalProviders: [
    'OpenAI',
    'Anthropic',
    'Gemini/Veo',
  ],
  optionalImageProvidersToEvaluate: [
    'GPT Image',
    'Imagen 4',
  ],
  optionalVideoProvidersToEvaluate: [
    'Sora 2',
    'Runway',
    'Luma',
    'Kling',
  ],
  evaluationCriteria: [
    'cost',
    'latency',
    'quality',
    'prompt_adherence',
    'brand_consistency',
    'text_rendering',
    'safety_refusal_rate',
    'api_maturity',
    'commercial_rights',
    'moderation',
  ],
  scorecardTemplate: {
    provider: '',
    modality: 'text|image|video',
    scenario: '',
    promptVersion: '',
    runCount: 0,
    summary: '',
    scores: {
      cost: null,
      latency: null,
      quality: null,
      promptAdherence: null,
      brandConsistency: null,
      textRendering: null,
      safetyRefusalRate: null,
      apiMaturity: null,
      commercialRights: null,
      moderation: null,
    },
    evidence: {
      screenshots: [],
      promptArtifacts: [],
      operatorNotes: [],
    },
    recommendation: 'keep|evaluate_further|reject',
  },
};

process.stdout.write(`${JSON.stringify(template, null, 2)}\n`);
