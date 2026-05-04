import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  organisations,
  workflowCatalogueInstalls,
  workflowCatalogueItems,
  workflowCataloguePurchases,
  workflowCatalogueReviews,
  workflowCatalogueVersions,
  workflows,
} from '../db/schema.js';
import { recordProductEvent } from './telemetry.js';
import { validateWorkflowDefinition } from './workflow-engine.js';
import { scanWorkflowPlan, WARDEN_VERDICTS } from './warden/index.js';

export const WORKFLOW_CATALOGUE_PLATFORM_FEE_BPS = Number(process.env.WORKFLOW_CATALOGUE_PLATFORM_FEE_BPS ?? 2500);

const PLAN_RANK = {
  free: 0,
  solo: 1,
  pro: 2,
  teams: 3,
  agency: 4,
};

const UNSAFE_SECRET_PATTERN =
  /(sk_live_|sk_test_|rk_live_|rk_test_|whsec_|xox[baprs]-|ghp_|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|bearer\s+[a-z0-9._-]{20,})/i;
const PRIVATE_DATA_PATTERN = /\b(customer|client|patient|password|secret|api[_-\s]?key|access[_-\s]?token|refresh[_-\s]?token)\b/i;
const TOKENIZED_URL_PATTERN = /https?:\/\/[^\s"]+(?:token|key|secret|signature|sig|auth)=/i;
const EXFILTRATION_PATTERN = /\b(exfiltrate|leak|steal|dump|send all|ignore previous|bypass policy|reveal secrets?)\b/i;

export const OFFICIAL_WORKFLOW_CATALOGUE_ITEMS = [
  {
    slug: '30-day-content-engine',
    title: '30-Day Content Engine',
    shortDescription: 'Turn one business goal into a month of useful content direction.',
    longDescription: 'Plan content themes, platform-specific post ideas, campaign angles, and a repurposing rhythm from a single business goal.',
    category: 'Content',
    tags: ['content', 'campaigns', 'social', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '5-8 minutes',
    requiredPlan: 'free',
    expectedOutput: ['Content calendar', 'Post ideas', 'Campaign themes', 'Repurposing plan'],
    requiredInputs: ['Business goal', 'Audience', 'Primary platforms'],
    templateWorkflowDefinition: {
      name: '30-Day Content Engine',
      description: 'Create a practical 30-day content plan from one business goal.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'strategy',
          agentId: 'forge',
          label: 'Campaign strategy',
          prompt: 'Create content pillars, campaign themes, and audience angles for the provided business goal. Return practical themes and assumptions to validate.',
          outputVar: 'campaignStrategy',
        },
        {
          id: 'calendar',
          agentId: 'echo',
          label: 'Calendar builder',
          prompt: 'Turn the campaign strategy into a 30-day calendar with platform-specific post ideas and repurposing notes.',
          outputVar: 'contentCalendar',
        },
      ],
      edges: [{ from: 'strategy', to: 'calendar' }],
    },
  },
  {
    slug: 'website-audit-sprint',
    title: 'Website Audit Sprint',
    shortDescription: 'Identify SEO, UX, and conversion fixes with a priority-ranked roadmap.',
    longDescription: 'Review website positioning, search basics, user experience friction, and conversion opportunities before turning them into next steps.',
    category: 'Marketing',
    tags: ['website', 'seo', 'conversion', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '6-10 minutes',
    requiredPlan: 'free',
    expectedOutput: ['SEO issues', 'UX issues', 'Conversion fixes', 'Priority roadmap'],
    requiredInputs: ['Website URL', 'Target audience', 'Primary conversion goal'],
    templateWorkflowDefinition: {
      name: 'Website Audit Sprint',
      description: 'Produce a practical website improvement roadmap.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'seo',
          agentId: 'oracle',
          label: 'SEO review',
          prompt: 'Assess the provided website context for SEO gaps, search intent mismatch, missing metadata, and content opportunities.',
          outputVar: 'seoFindings',
        },
        {
          id: 'ux',
          agentId: 'atlas',
          label: 'UX and conversion review',
          prompt: 'Review the SEO findings and website goal. Suggest UX improvements, conversion fixes, and a priority-ranked action roadmap.',
          outputVar: 'auditRoadmap',
        },
      ],
      edges: [{ from: 'seo', to: 'ux' }],
    },
  },
  {
    slug: 'agency-lead-generation-system',
    title: 'Agency Lead Generation System',
    shortDescription: 'Build ICP, outreach angles, follow-ups, and a weekly lead workflow.',
    longDescription: 'Define the right-fit prospect profile and create a repeatable agency outreach operating rhythm.',
    category: 'Sales',
    tags: ['agency', 'sales', 'outreach', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '8-12 minutes',
    requiredPlan: 'solo',
    expectedOutput: ['ICP', 'Outreach angles', 'Follow-up sequence', 'Weekly lead workflow'],
    requiredInputs: ['Agency offer', 'Target vertical', 'Proof points'],
    templateWorkflowDefinition: {
      name: 'Agency Lead Generation System',
      description: 'Create a repeatable lead generation workflow for agencies.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'icp',
          agentId: 'vance',
          label: 'ICP builder',
          prompt: 'Define the ideal customer profile, buying triggers, pain points, and qualification criteria for the agency offer.',
          outputVar: 'icp',
        },
        {
          id: 'outreach',
          agentId: 'herald',
          label: 'Outreach sequence',
          prompt: 'Create outreach angles, first-touch messages, and a polite follow-up sequence based on the ICP.',
          outputVar: 'outreachSequence',
        },
      ],
      edges: [{ from: 'icp', to: 'outreach' }],
    },
  },
  {
    slug: 'customer-support-response-builder',
    title: 'Customer Support Response Builder',
    shortDescription: 'Create clear response templates, escalation handling, and tone variants.',
    longDescription: 'Standardise helpful support responses while preserving brand voice and clear escalation paths.',
    category: 'Support',
    tags: ['support', 'templates', 'customer-care', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    expectedOutput: ['Response templates', 'Escalation handling', 'Tone variants'],
    requiredInputs: ['Support scenario', 'Brand tone', 'Escalation rules'],
    templateWorkflowDefinition: {
      name: 'Customer Support Response Builder',
      description: 'Draft reusable customer support response templates.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'support',
          agentId: 'wren',
          label: 'Support response set',
          prompt: 'Create customer support responses, escalation guidance, and tone variants for the provided scenario.',
          outputVar: 'supportTemplates',
        },
      ],
      edges: [],
    },
  },
  {
    slug: 'weekly-business-report',
    title: 'Weekly Business Report',
    shortDescription: 'Summarise progress, blockers, priorities, and metrics commentary.',
    longDescription: 'Turn weekly notes and metrics into an operator-ready business update.',
    category: 'Operations',
    tags: ['reporting', 'operations', 'weekly-review', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '6-9 minutes',
    requiredPlan: 'solo',
    expectedOutput: ['Weekly summary', 'Blockers', 'Priorities', 'Metrics commentary'],
    requiredInputs: ['Weekly notes', 'Metrics', 'Known blockers'],
    templateWorkflowDefinition: {
      name: 'Weekly Business Report',
      description: 'Create a concise weekly business report.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'metrics',
          agentId: 'ledger',
          label: 'Metrics commentary',
          prompt: 'Summarise the weekly metrics, explain movement, and identify risks or anomalies.',
          outputVar: 'metricsCommentary',
        },
        {
          id: 'ops',
          agentId: 'atlas',
          label: 'Operating report',
          prompt: 'Combine the metrics commentary with weekly notes into a clear report covering wins, blockers, priorities, and next actions.',
          outputVar: 'weeklyReport',
        },
      ],
      edges: [{ from: 'metrics', to: 'ops' }],
    },
  },
  {
    slug: 'linkedin-launch-campaign',
    title: 'LinkedIn Launch Campaign',
    shortDescription: 'Build a sharp 7-day LinkedIn launch campaign with hooks, CTAs, and launch-day copy.',
    longDescription: 'Turn a product or service launch into a focused LinkedIn campaign that covers pre-launch momentum, launch-day messaging, and follow-up angles.',
    category: 'Content',
    tags: ['content', 'linkedin', 'launch', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.06,
    expectedOutput: ['7-day LinkedIn campaign', 'Post hooks', 'CTA ideas', 'Launch-day post'],
    requiredInputs: ['Product/service', 'Launch date', 'Target audience'],
    templateWorkflowDefinition: {
      name: 'LinkedIn Launch Campaign',
      description: 'Create a focused LinkedIn launch campaign from offer, date, and audience context.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'launch-positioning',
          agentId: 'forge',
          label: 'Launch positioning',
          prompt: 'Create launch angles, audience hooks, and the core LinkedIn narrative for the product or service launch.',
          outputVar: 'launchPositioning',
        },
        {
          id: 'linkedin-calendar',
          agentId: 'echo',
          label: 'LinkedIn campaign',
          prompt: 'Turn the launch positioning into a 7-day LinkedIn campaign with post hooks, CTA ideas, launch-day copy, and follow-up prompts.',
          outputVar: 'linkedinCampaign',
        },
      ],
      edges: [{ from: 'launch-positioning', to: 'linkedin-calendar' }],
    },
  },
  {
    slug: 'local-business-seo-booster',
    title: 'Local Business SEO Booster',
    shortDescription: 'Improve local search visibility with keywords, homepage fixes, GBP suggestions, and content ideas.',
    longDescription: 'Create a practical local SEO plan for service businesses that need clearer search visibility and stronger local conversion signals.',
    category: 'Marketing',
    tags: ['seo', 'local-business', 'marketing', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.06,
    expectedOutput: ['Local keyword list', 'Homepage SEO improvements', 'Google Business Profile suggestions', 'Content ideas'],
    requiredInputs: ['Business type', 'Location', 'Website URL'],
    templateWorkflowDefinition: {
      name: 'Local Business SEO Booster',
      description: 'Create a local SEO improvement plan for a location-based business.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'local-keywords',
          agentId: 'oracle',
          label: 'Local search map',
          prompt: 'Build local keyword themes, search intent notes, and Google Business Profile improvement suggestions for the business and location.',
          outputVar: 'localSeoMap',
        },
        {
          id: 'homepage-actions',
          agentId: 'forge',
          label: 'Homepage and content plan',
          prompt: 'Turn the local search map into homepage SEO improvements, practical content ideas, and clear next actions.',
          outputVar: 'localSeoActions',
        },
      ],
      edges: [{ from: 'local-keywords', to: 'homepage-actions' }],
    },
  },
  {
    slug: 'sales-follow-up-sequence',
    title: 'Sales Follow-Up Sequence',
    shortDescription: 'Create a five-step follow-up system with objection handling and a final close email.',
    longDescription: 'Turn a stalled sales conversation into a structured follow-up sequence that feels useful, timely, and commercially clear.',
    category: 'Sales',
    tags: ['sales', 'follow-up', 'email', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '3-6 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 5,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.05,
    expectedOutput: ['5-step follow-up sequence', 'Objection handling', 'Subject lines', 'Final close email'],
    requiredInputs: ['Offer', 'Prospect type', 'Previous conversation context'],
    templateWorkflowDefinition: {
      name: 'Sales Follow-Up Sequence',
      description: 'Create a practical sales follow-up sequence from offer and prospect context.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'follow-up-angles',
          agentId: 'vance',
          label: 'Follow-up strategy',
          prompt: 'Identify buyer concerns, urgency signals, likely objections, and useful follow-up angles from the offer and conversation context.',
          outputVar: 'followUpStrategy',
        },
        {
          id: 'email-sequence',
          agentId: 'herald',
          label: 'Email sequence',
          prompt: 'Create a five-step follow-up email sequence with subject lines, objection handling, and a final close email.',
          outputVar: 'followUpSequence',
        },
      ],
      edges: [{ from: 'follow-up-angles', to: 'email-sequence' }],
    },
  },
  {
    slug: 'client-onboarding-pack',
    title: 'Client Onboarding Pack',
    shortDescription: 'Create the checklist, welcome email, discovery questions, and kickoff plan for a new client.',
    longDescription: 'Package a professional onboarding flow for service businesses and agencies that need a consistent client start experience.',
    category: 'Operations',
    tags: ['client-onboarding', 'operations', 'agency', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '6-10 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 9,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.09,
    expectedOutput: ['Onboarding checklist', 'Welcome email', 'Discovery questions', 'Project kickoff plan'],
    requiredInputs: ['Service offered', 'Client type', 'Project scope'],
    templateWorkflowDefinition: {
      name: 'Client Onboarding Pack',
      description: 'Create a repeatable client onboarding pack for an agency or service provider.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'onboarding-plan',
          agentId: 'atlas',
          label: 'Onboarding structure',
          prompt: 'Map the onboarding checklist, project phases, discovery needs, and kickoff structure for the service and client type.',
          outputVar: 'onboardingStructure',
        },
        {
          id: 'welcome-email',
          agentId: 'herald',
          label: 'Welcome email',
          prompt: 'Write a client-ready welcome email and discovery question sequence from the onboarding structure.',
          outputVar: 'welcomeEmail',
        },
        {
          id: 'client-pack',
          agentId: 'forge',
          label: 'Client pack',
          prompt: 'Package the checklist, welcome email, discovery questions, and kickoff plan into a polished client onboarding pack.',
          outputVar: 'clientOnboardingPack',
        },
      ],
      edges: [{ from: 'onboarding-plan', to: 'welcome-email' }, { from: 'welcome-email', to: 'client-pack' }],
    },
  },
  {
    slug: 'competitor-research-sprint',
    title: 'Competitor Research Sprint',
    shortDescription: 'Compare competitors, pricing signals, positioning, and opportunity gaps.',
    longDescription: 'Create a structured competitor research sprint that turns market notes into clear strategic opportunities.',
    category: 'Research',
    tags: ['research', 'competitors', 'strategy', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '7-12 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 10,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.10,
    expectedOutput: ['Competitor list', 'Positioning comparison', 'Pricing observations', 'Opportunity gaps'],
    requiredInputs: ['Business/product', 'Target market', 'Known competitors'],
    templateWorkflowDefinition: {
      name: 'Competitor Research Sprint',
      description: 'Create a structured competitor comparison and opportunity map.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'competitor-map',
          agentId: 'scout',
          label: 'Competitor map',
          prompt: 'Organise known competitors, infer comparison dimensions, and identify information gaps for further research.',
          outputVar: 'competitorMap',
        },
        {
          id: 'strategy-gaps',
          agentId: 'sage',
          label: 'Opportunity gaps',
          prompt: 'Compare positioning, pricing observations, and market gaps, then turn them into strategic opportunities.',
          outputVar: 'competitorOpportunities',
        },
      ],
      edges: [{ from: 'competitor-map', to: 'strategy-gaps' }],
    },
  },
  {
    slug: 'offer-positioning-builder',
    title: 'Offer Positioning Builder',
    shortDescription: 'Clarify your offer, target customer, value proposition, and objection responses.',
    longDescription: 'Turn a messy offer into a clear positioning frame that can drive landing pages, outreach, and sales conversations.',
    category: 'Strategy',
    tags: ['offer', 'positioning', 'strategy', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.06,
    expectedOutput: ['Offer statement', 'Target customer', 'Value proposition', 'Objections and responses'],
    requiredInputs: ['Offer details', 'Audience', 'Current pricing'],
    templateWorkflowDefinition: {
      name: 'Offer Positioning Builder',
      description: 'Clarify offer positioning for a product or service.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'positioning-frame',
          agentId: 'sage',
          label: 'Positioning frame',
          prompt: 'Clarify the target customer, core value proposition, differentiation, and buying context for the offer.',
          outputVar: 'positioningFrame',
        },
        {
          id: 'offer-copy',
          agentId: 'forge',
          label: 'Offer copy',
          prompt: 'Turn the positioning frame into an offer statement, objection responses, and concise copy blocks.',
          outputVar: 'offerPositioning',
        },
      ],
      edges: [{ from: 'positioning-frame', to: 'offer-copy' }],
    },
  },
  {
    slug: 'monthly-investor-update',
    title: 'Monthly Investor Update',
    shortDescription: 'Create an investor-ready update with KPI commentary, wins, risks, and asks.',
    longDescription: 'Turn monthly metrics and founder notes into a clear investor update that communicates progress without burying the signal.',
    category: 'Finance',
    tags: ['investor-update', 'finance', 'reporting', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '5-9 minutes',
    requiredPlan: 'pro',
    estimatedExecutionCredits: 8,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.08,
    expectedOutput: ['Investor update draft', 'KPI commentary', 'Wins', 'Risks', 'Asks'],
    requiredInputs: ['Monthly metrics', 'Progress notes', 'Blockers'],
    templateWorkflowDefinition: {
      name: 'Monthly Investor Update',
      description: 'Create a concise investor update from metrics and progress notes.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'kpi-commentary',
          agentId: 'ledger',
          label: 'KPI commentary',
          prompt: 'Interpret monthly metrics, call out movement, risks, anomalies, and useful context for investors.',
          outputVar: 'kpiCommentary',
        },
        {
          id: 'investor-draft',
          agentId: 'forge',
          label: 'Investor update',
          prompt: 'Turn the KPI commentary and founder notes into an investor update covering wins, risks, asks, and next priorities.',
          outputVar: 'investorUpdate',
        },
      ],
      edges: [{ from: 'kpi-commentary', to: 'investor-draft' }],
    },
  },
  {
    slug: 'support-faq-generator',
    title: 'Support FAQ Generator',
    shortDescription: 'Create FAQs, support answers, escalation notes, and tone variants.',
    longDescription: 'Give support teams a practical FAQ base that answers common questions clearly and keeps escalation paths visible.',
    category: 'Support',
    tags: ['support', 'faq', 'customer-care', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '3-6 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 5,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.05,
    expectedOutput: ['FAQ list', 'Support answers', 'Escalation notes', 'Tone variants'],
    requiredInputs: ['Product/service', 'Common questions', 'Brand tone'],
    templateWorkflowDefinition: {
      name: 'Support FAQ Generator',
      description: 'Create a practical FAQ and support answer set.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'support-faq',
          agentId: 'wren',
          label: 'FAQ answer set',
          prompt: 'Create a support FAQ with clear answers, escalation notes, tone variants, and safe handoff guidance.',
          outputVar: 'supportFaq',
        },
        {
          id: 'faq-polish',
          agentId: 'forge',
          label: 'FAQ polish',
          prompt: 'Polish the FAQ for clarity, consistency, and customer-friendly language while preserving escalation guidance.',
          outputVar: 'polishedFaq',
        },
      ],
      edges: [{ from: 'support-faq', to: 'faq-polish' }],
    },
  },
  {
    slug: 'workflow-automation-planner',
    title: 'Workflow Automation Planner',
    shortDescription: 'Map a manual process into automation opportunities, workflow nodes, and risk notes.',
    longDescription: 'Translate a messy business process into a practical automation blueprint with clear nodes, handoffs, and control points.',
    category: 'Automation',
    tags: ['automation', 'workflow', 'operations', 'advanced'],
    difficulty: 'advanced',
    expectedRuntimeLabel: '8-14 minutes',
    requiredPlan: 'pro',
    estimatedExecutionCredits: 12,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.12,
    expectedOutput: ['Process map', 'Automation opportunities', 'Recommended workflow nodes', 'Risk notes'],
    requiredInputs: ['Business process', 'Current manual steps', 'Desired outcome'],
    templateWorkflowDefinition: {
      name: 'Workflow Automation Planner',
      description: 'Create an automation blueprint for a manual business process.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'workflow-map',
          agentId: 'nexus',
          label: 'Workflow map',
          prompt: 'Map the current manual process into stages, dependencies, candidate workflow nodes, and automation opportunities.',
          outputVar: 'workflowMap',
        },
        {
          id: 'operating-risks',
          agentId: 'atlas',
          label: 'Risk and control points',
          prompt: 'Identify operational risks, human review points, dependencies, and failure modes in the workflow map.',
          outputVar: 'automationRisks',
        },
        {
          id: 'automation-plan',
          agentId: 'sage',
          label: 'Automation plan',
          prompt: 'Turn the workflow map and risk notes into a recommended automation plan with node sequence and rollout priorities.',
          outputVar: 'automationPlan',
        },
      ],
      edges: [{ from: 'workflow-map', to: 'operating-risks' }, { from: 'operating-risks', to: 'automation-plan' }],
    },
  },
  {
    slug: 'product-launch-checklist',
    title: 'Product Launch Checklist',
    shortDescription: 'Build a launch checklist with risks, marketing actions, launch-day plan, and follow-up.',
    longDescription: 'Create a cross-functional launch plan that keeps product, operations, marketing, and follow-up activity aligned.',
    category: 'Operations',
    tags: ['launch', 'operations', 'product', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '5-9 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 8,
    estimatedVideoCredits: 0,
    estimatedCostGbp: 0.08,
    expectedOutput: ['Launch checklist', 'Prelaunch risks', 'Marketing actions', 'Launch-day plan', 'Post-launch follow-up'],
    requiredInputs: ['Product', 'Launch date', 'Channels'],
    templateWorkflowDefinition: {
      name: 'Product Launch Checklist',
      description: 'Create a practical product launch checklist and operating plan.',
      triggerType: 'manual',
      triggerConfig: {},
      nodes: [
        {
          id: 'launch-ops',
          agentId: 'atlas',
          label: 'Launch operations',
          prompt: 'Create the operational launch checklist, risk register, launch-day sequence, and post-launch follow-up plan.',
          outputVar: 'launchOpsPlan',
        },
        {
          id: 'launch-assets',
          agentId: 'forge',
          label: 'Launch messaging',
          prompt: 'Draft the launch messaging actions, campaign prompts, and channel-specific content needs.',
          outputVar: 'launchMessaging',
        },
        {
          id: 'channel-plan',
          agentId: 'echo',
          label: 'Channel plan',
          prompt: 'Turn the launch operations and messaging into a concise channel plan with launch-day and post-launch actions.',
          outputVar: 'productLaunchPlan',
        },
      ],
      edges: [{ from: 'launch-ops', to: 'launch-assets' }, { from: 'launch-assets', to: 'channel-plan' }],
    },
  },
  createOfficialSeedWorkflow({
    slug: 'short-form-content-repurposer',
    title: 'Short-Form Content Repurposer',
    shortDescription: 'Turn one idea, article, or offer into short posts for multiple channels.',
    longDescription: 'Break a single source idea into platform-ready short-form content with hooks, angles, and repurposing notes.',
    category: 'Content',
    tags: ['content', 'repurposing', 'social', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedCostGbp: 0.06,
    expectedOutput: ['Short-form post set', 'Channel-specific hooks', 'Repurposing ideas', 'CTA variants'],
    requiredInputs: ['Source idea', 'Target platforms', 'Audience'],
    steps: [
      ['forge', 'Message angles', 'Extract the strongest message angles, audience pains, and promise from the source idea.', 'messageAngles'],
      ['echo', 'Channel repurposing', 'Turn the message angles into short-form posts, hooks, CTA variants, and platform notes.', 'repurposedContent'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'landing-page-conversion-fixer',
    title: 'Landing Page Conversion Fixer',
    shortDescription: 'Find clarity, trust, and CTA improvements for a landing page.',
    longDescription: 'Review landing page copy and structure, then generate practical fixes that improve conversion without a full redesign.',
    category: 'Marketing',
    tags: ['marketing', 'conversion', 'landing-page', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '6-10 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 9,
    estimatedCostGbp: 0.09,
    expectedOutput: ['Conversion issues', 'Messaging fixes', 'CTA improvements', 'Priority action list'],
    requiredInputs: ['Landing page URL or copy', 'Target customer', 'Conversion goal'],
    steps: [
      ['oracle', 'Page clarity review', 'Assess the landing page for clarity, message match, objections, and trust gaps.', 'clarityReview'],
      ['atlas', 'Conversion roadmap', 'Turn the review into prioritized conversion fixes, CTA improvements, and page section recommendations.', 'conversionRoadmap'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'proposal-follow-up-kit',
    title: 'Proposal Follow-Up Kit',
    shortDescription: 'Create polite follow-ups, objection responses, and next-step prompts after sending a proposal.',
    longDescription: 'Build a follow-up sequence that keeps deals moving without sounding pushy or generic.',
    category: 'Sales',
    tags: ['sales', 'proposal', 'follow-up', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '3-6 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 5,
    estimatedCostGbp: 0.05,
    expectedOutput: ['Follow-up email sequence', 'Objection responses', 'Next-step prompts', 'Final close message'],
    requiredInputs: ['Proposal summary', 'Prospect type', 'Timeline'],
    steps: [
      ['vance', 'Deal context', 'Identify buying intent, likely objections, and useful next steps from the proposal context.', 'dealContext'],
      ['herald', 'Follow-up kit', 'Create a practical follow-up sequence with subject lines, objection responses, and final close message.', 'proposalFollowUpKit'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'support-ticket-triage-playbook',
    title: 'Support Ticket Triage Playbook',
    shortDescription: 'Sort support tickets by urgency, response type, and escalation path.',
    longDescription: 'Create a triage playbook that helps teams respond consistently and escalate the right issues quickly.',
    category: 'Support',
    tags: ['support', 'triage', 'customer-care', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '5-8 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 7,
    estimatedCostGbp: 0.07,
    expectedOutput: ['Triage categories', 'Response guidance', 'Escalation rules', 'Quality checklist'],
    requiredInputs: ['Support issue types', 'Response standards', 'Escalation rules'],
    steps: [
      ['wren', 'Ticket categories', 'Create support ticket categories, urgency levels, and response expectations.', 'ticketCategories'],
      ['atlas', 'Escalation playbook', 'Turn the categories into escalation rules, quality checks, and operating guidance.', 'triagePlaybook'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'cash-flow-snapshot',
    title: 'Cash Flow Snapshot',
    shortDescription: 'Turn monthly numbers into a simple cash position, risks, and action list.',
    longDescription: 'Summarise cash inflows, outflows, runway pressure, and practical finance actions for operators.',
    category: 'Finance',
    tags: ['finance', 'cash-flow', 'reporting', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedCostGbp: 0.06,
    expectedOutput: ['Cash position summary', 'Runway risks', 'Spend notes', 'Action list'],
    requiredInputs: ['Revenue', 'Major costs', 'Cash balance'],
    steps: [
      ['ledger', 'Cash summary', 'Summarise the cash position, major inflows and outflows, runway risks, and spending patterns.', 'cashSummary'],
      ['sage', 'Finance actions', 'Turn the cash summary into practical next actions and risks to monitor.', 'financeActions'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'pricing-margin-check',
    title: 'Pricing Margin Check',
    shortDescription: 'Stress-test offer pricing against delivery effort, costs, and margin pressure.',
    longDescription: 'Review whether an offer is priced sustainably and identify changes that protect margin without hurting conversion.',
    category: 'Finance',
    tags: ['finance', 'pricing', 'margin', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '5-9 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 8,
    estimatedCostGbp: 0.08,
    expectedOutput: ['Margin risks', 'Pricing observations', 'Cost pressure notes', 'Recommended changes'],
    requiredInputs: ['Offer price', 'Delivery costs', 'Delivery time'],
    steps: [
      ['ledger', 'Margin review', 'Review offer pricing, delivery costs, effort, and likely margin pressure.', 'marginReview'],
      ['sage', 'Pricing recommendation', 'Create pricing recommendations, packaging adjustments, and risks to monitor.', 'pricingRecommendation'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'invoice-chasing-automation',
    title: 'Invoice Chasing Automation',
    shortDescription: 'Plan a respectful overdue invoice follow-up workflow.',
    longDescription: 'Create a repeatable invoice follow-up process with timing, message templates, escalation points, and tone guidance.',
    category: 'Automation',
    tags: ['automation', 'finance', 'operations', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedCostGbp: 0.06,
    expectedOutput: ['Follow-up workflow', 'Reminder messages', 'Escalation points', 'Tone guidance'],
    requiredInputs: ['Payment terms', 'Reminder cadence', 'Brand tone'],
    steps: [
      ['nexus', 'Automation sequence', 'Map a respectful overdue invoice follow-up sequence with timing and escalation points.', 'invoiceSequence'],
      ['herald', 'Reminder copy', 'Draft reminder messages that match the sequence and preserve a professional tone.', 'invoiceReminderCopy'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'handoff-automation-map',
    title: 'Handoff Automation Map',
    shortDescription: 'Map handoffs between teams and identify where workflow automation should help.',
    longDescription: 'Find bottlenecks in cross-team handoffs and design an automation map with review points and ownership.',
    category: 'Automation',
    tags: ['automation', 'handoffs', 'operations', 'advanced'],
    difficulty: 'advanced',
    expectedRuntimeLabel: '8-12 minutes',
    requiredPlan: 'pro',
    estimatedExecutionCredits: 11,
    estimatedCostGbp: 0.11,
    expectedOutput: ['Handoff map', 'Automation opportunities', 'Owner matrix', 'Risk notes'],
    requiredInputs: ['Current process', 'Teams involved', 'Failure points'],
    steps: [
      ['atlas', 'Handoff review', 'Map the current handoffs, owners, failure points, and decision points in the process.', 'handoffReview'],
      ['nexus', 'Automation map', 'Translate the handoff review into workflow automation opportunities, ownership, and control points.', 'handoffAutomationMap'],
      ['sage', 'Rollout notes', 'Create rollout recommendations, risk notes, and adoption steps for the automation map.', 'handoffRolloutNotes'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'customer-research-synthesizer',
    title: 'Customer Research Synthesizer',
    shortDescription: 'Turn notes, calls, or survey snippets into useful customer insights.',
    longDescription: 'Synthesize research notes into themes, pains, buying triggers, messaging opportunities, and follow-up questions.',
    category: 'Research',
    tags: ['research', 'customer-insights', 'messaging', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-8 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 7,
    estimatedCostGbp: 0.07,
    expectedOutput: ['Insight themes', 'Pain points', 'Buying triggers', 'Follow-up questions'],
    requiredInputs: ['Research notes', 'Audience segment', 'Business goal'],
    steps: [
      ['scout', 'Research themes', 'Extract themes, pains, buying triggers, and unanswered questions from the research notes.', 'researchThemes'],
      ['forge', 'Messaging insights', 'Turn the themes into messaging opportunities and follow-up research prompts.', 'messagingInsights'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'market-entry-brief',
    title: 'Market Entry Brief',
    shortDescription: 'Create a focused market brief before testing a new audience or vertical.',
    longDescription: 'Assess a new market with audience assumptions, competitor cues, risks, and initial go-to-market actions.',
    category: 'Research',
    tags: ['research', 'market-entry', 'strategy', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '7-11 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 10,
    estimatedCostGbp: 0.1,
    expectedOutput: ['Market assumptions', 'Competitor cues', 'Risk notes', 'First test plan'],
    requiredInputs: ['Target market', 'Offer', 'Known constraints'],
    steps: [
      ['scout', 'Market scan', 'Create a market entry scan with audience assumptions, competitor cues, and major unknowns.', 'marketScan'],
      ['sage', 'Entry plan', 'Turn the market scan into risks, validation questions, and a first test plan.', 'marketEntryPlan'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'quarterly-growth-plan',
    title: 'Quarterly Growth Plan',
    shortDescription: 'Turn business goals into a focused quarterly growth plan.',
    longDescription: 'Define growth priorities, campaign themes, operating rhythm, and risks for the next quarter.',
    category: 'Strategy',
    tags: ['strategy', 'growth', 'planning', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '7-12 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 10,
    estimatedCostGbp: 0.1,
    expectedOutput: ['Quarterly priorities', 'Growth bets', 'Operating rhythm', 'Risk register'],
    requiredInputs: ['Quarter goal', 'Current metrics', 'Constraints'],
    steps: [
      ['sage', 'Growth strategy', 'Create quarterly growth priorities, strategic bets, and assumptions from the provided goal and metrics.', 'growthStrategy'],
      ['atlas', 'Operating rhythm', 'Turn the strategy into an operating rhythm, ownership notes, risks, and review cadence.', 'growthOperatingPlan'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'brand-messaging-sprint',
    title: 'Brand Messaging Sprint',
    shortDescription: 'Clarify positioning, proof points, objections, and core messages.',
    longDescription: 'Create a concise messaging foundation that can guide landing pages, sales materials, and content.',
    category: 'Strategy',
    tags: ['strategy', 'messaging', 'positioning', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '5-8 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 7,
    estimatedCostGbp: 0.07,
    expectedOutput: ['Positioning statement', 'Proof points', 'Objection responses', 'Core messages'],
    requiredInputs: ['Offer', 'Audience', 'Proof or results'],
    steps: [
      ['sage', 'Positioning review', 'Clarify the offer positioning, audience, proof points, and likely objections.', 'positioningReview'],
      ['forge', 'Message set', 'Turn the positioning review into core messages, objection responses, and reusable copy angles.', 'brandMessageSet'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'agency-client-report-pack',
    title: 'Agency Client Report Pack',
    shortDescription: 'Create a clear client-facing report from wins, metrics, blockers, and next steps.',
    longDescription: 'Package delivery progress into a professional report that highlights outcomes, context, and next actions.',
    category: 'Agencies',
    tags: ['agency', 'reporting', 'client-care', 'simple'],
    difficulty: 'beginner',
    expectedRuntimeLabel: '4-7 minutes',
    requiredPlan: 'free',
    estimatedExecutionCredits: 6,
    estimatedCostGbp: 0.06,
    expectedOutput: ['Client report draft', 'Wins summary', 'Blockers', 'Next-step plan'],
    requiredInputs: ['Project notes', 'Metrics', 'Next priorities'],
    steps: [
      ['ledger', 'Report inputs', 'Summarise metrics, wins, blockers, and priority changes from the project notes.', 'reportInputs'],
      ['forge', 'Client report', 'Turn the report inputs into a clear client-facing report with next steps and context.', 'clientReport'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'agency-retainer-renewal-plan',
    title: 'Agency Retainer Renewal Plan',
    shortDescription: 'Prepare renewal messaging, proof points, and next-scope options for agency retainers.',
    longDescription: 'Build a renewal plan that shows value delivered, future opportunities, and a confident next engagement path.',
    category: 'Agencies',
    tags: ['agency', 'retainer', 'renewal', 'advanced'],
    difficulty: 'intermediate',
    expectedRuntimeLabel: '6-10 minutes',
    requiredPlan: 'solo',
    estimatedExecutionCredits: 9,
    estimatedCostGbp: 0.09,
    expectedOutput: ['Renewal narrative', 'Proof points', 'Next-scope options', 'Meeting agenda'],
    requiredInputs: ['Retainer results', 'Client goals', 'Next opportunities'],
    steps: [
      ['vance', 'Renewal angle', 'Identify renewal opportunities, buying concerns, and proof points from the retainer context.', 'renewalAngle'],
      ['herald', 'Renewal assets', 'Create renewal messaging, meeting agenda, and next-scope options based on the renewal angle.', 'renewalAssets'],
    ],
  }),
  createOfficialSeedWorkflow({
    slug: 'agency-service-delivery-system',
    title: 'Agency Service Delivery System',
    shortDescription: 'Turn a service offer into a repeatable delivery workflow.',
    longDescription: 'Define the steps, inputs, outputs, quality checks, and handoffs needed to deliver an agency service consistently.',
    category: 'Agencies',
    tags: ['agency', 'delivery', 'operations', 'advanced'],
    difficulty: 'advanced',
    expectedRuntimeLabel: '8-13 minutes',
    requiredPlan: 'pro',
    estimatedExecutionCredits: 12,
    estimatedCostGbp: 0.12,
    expectedOutput: ['Delivery workflow', 'Required inputs', 'Quality checks', 'Handoff notes'],
    requiredInputs: ['Service offer', 'Delivery steps', 'Quality standards'],
    steps: [
      ['atlas', 'Delivery map', 'Map the service delivery steps, inputs, outputs, owners, and quality checkpoints.', 'deliveryMap'],
      ['nexus', 'Workflow design', 'Turn the delivery map into a repeatable workflow sequence with handoffs and automation opportunities.', 'serviceWorkflowDesign'],
      ['sage', 'Control layer', 'Add risk notes, quality checks, and operating recommendations for consistent service delivery.', 'serviceDeliveryControls'],
    ],
  }),
];

function createOfficialSeedWorkflow({
  slug,
  title,
  shortDescription,
  longDescription,
  category,
  tags,
  difficulty,
  expectedRuntimeLabel,
  requiredPlan,
  estimatedExecutionCredits,
  estimatedVideoCredits = 0,
  estimatedCostGbp,
  expectedOutput,
  requiredInputs,
  steps,
}) {
  const nodes = steps.map(([agentId, label, prompt, outputVar], index) => ({
    id: `${seedWorkflowId(label)}-${index + 1}`,
    agentId,
    label,
    prompt,
    outputVar,
  }));

  return {
    slug,
    title,
    shortDescription,
    longDescription,
    category,
    tags,
    difficulty,
    expectedRuntimeLabel,
    requiredPlan,
    estimatedExecutionCredits,
    estimatedVideoCredits,
    estimatedCostGbp,
    expectedOutput,
    requiredInputs,
    templateWorkflowDefinition: {
      name: title,
      description: longDescription,
      triggerType: 'manual',
      triggerConfig: {},
      nodes,
      edges: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id })),
    },
  };
}

function seedWorkflowId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'step';
}

export function isWorkflowCatalogueEnabled() {
  return process.env.WORKFLOW_CATALOGUE_ENABLED !== 'false';
}

export function areWorkflowCatalogueSubmissionsEnabled() {
  return process.env.WORKFLOW_CATALOGUE_USER_SUBMISSIONS_ENABLED !== 'false';
}

export function isWorkflowCataloguePremiumEnabled() {
  return process.env.WORKFLOW_CATALOGUE_PREMIUM_ENABLED === 'true';
}

export function ensureCatalogueEnabled() {
  if (!isWorkflowCatalogueEnabled()) {
    const error = new Error('Workflow Catalogue is not enabled.');
    error.status = 404;
    throw error;
  }
}

export function validateCatalogueWorkflowDefinition(definition) {
  const workflow = validateWorkflowDefinition(definition);
  const warnings = [];
  const haystack = JSON.stringify(workflow);

  if (UNSAFE_SECRET_PATTERN.test(haystack) || TOKENIZED_URL_PATTERN.test(haystack)) {
    throw catalogueValidationError('Workflow definitions cannot contain API keys, tokens, webhook secrets, or signed URLs.');
  }

  if (EXFILTRATION_PATTERN.test(haystack)) {
    throw catalogueValidationError('Workflow instructions cannot include exfiltration, policy bypass, or secret-revealing instructions.');
  }

  if (PRIVATE_DATA_PATTERN.test(haystack)) {
    warnings.push('Definition may reference private customer data. Admin review should confirm no real customer data is embedded.');
  }

  if (workflow.triggerType === 'webhook') {
    throw catalogueValidationError('Published catalogue workflows must install as manual workflows. Add webhooks after installing into a workspace.');
  }

  if (workflow.triggerType === 'schedule') {
    warnings.push('Scheduled trigger present. Installed catalogue workflows are converted to manual until the user configures scheduling.');
  }

  if (workflow.nodes.length > 8) {
    warnings.push('Large workflow graph may have higher execution cost.');
  }

  if (haystack.toLowerCase().includes('video')) {
    warnings.push('Workflow may involve video generation. Confirm video credit expectations before approval.');
  }

  if (/https?:\/\//i.test(haystack)) {
    warnings.push('External URL reference present. Confirm it is not a hidden webhook or private endpoint.');
  }

  return {
    definition: {
      ...workflow,
      triggerType: 'manual',
      triggerConfig: {},
    },
    warnings,
  };
}

export function estimateCatalogueWorkflowCost(definition) {
  const nodeCount = Array.isArray(definition?.nodes) ? definition.nodes.length : 0;
  const promptChars = (definition?.nodes ?? []).reduce((sum, node) => sum + String(node?.prompt ?? '').length, 0);
  const videoMentions = /video|veo|render|clip/i.test(JSON.stringify(definition ?? {}));
  const estimatedExecutionCredits = Math.max(1, Math.ceil(nodeCount * 3 + promptChars / 1200));
  const estimatedVideoCredits = videoMentions ? Math.max(1, Math.ceil(nodeCount / 2)) : 0;
  return {
    estimatedExecutionCredits,
    estimatedVideoCredits,
    estimatedCostGbp: Number((estimatedExecutionCredits * 0.01 + estimatedVideoCredits * 0.2).toFixed(2)),
  };
}

export async function listCatalogueItems(filters = {}, options = {}) {
  ensureCatalogueEnabled();
  const where = buildCatalogueWhere(filters, options);
  const orderBy = buildCatalogueOrder(filters.sort);
  return db.query.workflowCatalogueItems.findMany({
    where,
    orderBy,
    limit: Math.min(Number(filters.limit ?? 60), 100),
  });
}

export async function getCatalogueItem(slugOrId, options = {}) {
  ensureCatalogueEnabled();
  const item = await db.query.workflowCatalogueItems.findFirst({
    where: and(
      isUuid(slugOrId)
        ? or(eq(workflowCatalogueItems.id, slugOrId), eq(workflowCatalogueItems.slug, slugOrId))
        : eq(workflowCatalogueItems.slug, slugOrId),
      options.includeUnpublished ? sql`true` : eq(workflowCatalogueItems.visibility, 'published'),
    ),
  });
  return item ?? null;
}

export async function createDraftFromWorkflow({ userId, orgId, workflowId, payload = {} }) {
  ensureCatalogueEnabled();
  if (!areWorkflowCatalogueSubmissionsEnabled()) {
    throw catalogueValidationError('User workflow submissions are not enabled.', 403);
  }

  const workflow = await db.query.workflows.findFirst({
    where: and(eq(workflows.id, workflowId), eq(workflows.orgId, orgId)),
  });

  if (!workflow) {
    throw catalogueValidationError('Workflow not found.', 404);
  }

  const baseDefinition = {
    name: workflow.name,
    description: workflow.description ?? undefined,
    triggerType: workflow.triggerType,
    triggerConfig: workflow.triggerConfig ?? {},
    nodes: workflow.nodes ?? [],
    edges: workflow.edges ?? [],
  };
  const { definition, warnings } = validateCatalogueWorkflowDefinition(baseDefinition);
  const cost = estimateCatalogueWorkflowCost(definition);
  const title = payload.title?.trim() || workflow.name;
  const slug = await createUniqueCatalogueSlug(title);

  const [item] = await db
    .insert(workflowCatalogueItems)
    .values({
      slug,
      title,
      shortDescription: payload.shortDescription?.trim() || workflow.description || 'Reusable Prymal workflow.',
      longDescription: payload.longDescription?.trim() || workflow.description || null,
      category: payload.category?.trim() || 'Automation',
      tags: normalizeTags(payload.tags),
      visibility: 'draft',
      sourceWorkflowId: workflow.id,
      templateWorkflowDefinition: definition,
      creatorUserId: userId,
      creatorOrgId: orgId,
      creatorDisplayName: payload.creatorDisplayName?.trim() || null,
      publisherType: 'user_creator',
      pricingType: normalizePricingType(payload.pricingType),
      difficulty: payload.difficulty ?? 'beginner',
      expectedRuntimeLabel: payload.expectedRuntimeLabel ?? null,
      requiredPlan: payload.requiredPlan ?? null,
      expectedOutput: normalizeList(payload.expectedOutput),
      requiredInputs: normalizeList(payload.requiredInputs),
      validationWarnings: warnings,
      ...cost,
    })
    .returning();

  await recordProductEvent({
    orgId,
    userId,
    eventName: 'workflow_catalogue_draft_created',
    metadata: eventMetadata(item),
  });

  return item;
}

export async function duplicateCatalogueWorkflowIntoOrg({ catalogueItemId, targetOrgId, userId }) {
  ensureCatalogueEnabled();
  const item = await getCatalogueItem(catalogueItemId, { includeUnpublished: true });
  if (!item || item.visibility !== 'published') {
    throw catalogueValidationError('Workflow catalogue item not found.', 404);
  }

  const org = await db.query.organisations.findFirst({ where: eq(organisations.id, targetOrgId) });
  if (!org) throw catalogueValidationError('Organisation not found.', 404);

  assertCatalogueInstallPlanAllowed({ item, org });

  if (!planAllows(org.plan, item.requiredPlan)) {
    throw catalogueValidationError(`This workflow requires the ${item.requiredPlan} plan or higher.`, 403);
  }

  const { definition } = validateCatalogueWorkflowDefinition(item.templateWorkflowDefinition);
  await scanCatalogueWorkflowDefinition({
    definition,
    item,
    org,
    userId,
  });
  const triggerConfig = {
    ...(definition.triggerConfig ?? {}),
    catalogueItemId: item.id,
    catalogueSlug: item.slug,
  };
  const [workflow] = await db
    .insert(workflows)
    .values({
      orgId: targetOrgId,
      createdBy: userId,
      name: definition.name,
      description: definition.description ?? item.shortDescription,
      triggerType: 'manual',
      triggerConfig,
      nodes: definition.nodes,
      edges: definition.edges,
      isActive: false,
    })
    .returning();

  await recordCatalogueInstall(item.id, workflow.id, targetOrgId, userId);

  await recordProductEvent({
    orgId: targetOrgId,
    userId,
    eventName: 'workflow_catalogue_installed',
    metadata: { ...eventMetadata(item), installedWorkflowId: workflow.id },
  });

  return { workflow, item };
}

export function assertCatalogueInstallPlanAllowed({ item, org }) {
  if (item?.pricingType !== 'premium') {
    return true;
  }

  if (!isWorkflowCataloguePremiumEnabled()) {
    throw catalogueValidationError('Premium workflow installs are not available yet.', 403);
  }

  if (!planAllows(org?.plan, 'pro')) {
    throw catalogueValidationError('Upgrade to Pro, Teams, or Agency to install premium workflows.', 402);
  }

  return true;
}

async function scanCatalogueWorkflowDefinition({ definition, item, org, userId }) {
  const scan = await scanWorkflowPlan({
    workflow: definition,
    inputs: definition.triggerConfig ?? {},
    nodes: definition.nodes ?? [],
    edges: definition.edges ?? [],
    userId,
    orgId: org.id,
    metadata: {
      source: 'workflow_catalogue_install',
      catalogueItemId: item.id,
      catalogueSlug: item.slug,
    },
  });

  if ([WARDEN_VERDICTS.BLOCK, WARDEN_VERDICTS.REQUIRE_CONFIRMATION].includes(scan.verdict)) {
    throw catalogueValidationError('WARDEN blocked this catalogue workflow definition before install.', 400);
  }

  return scan;
}

export async function submitCatalogueItemForReview(itemId, userId, orgId) {
  ensureCatalogueEnabled();
  if (!areWorkflowCatalogueSubmissionsEnabled()) {
    throw catalogueValidationError('User workflow submissions are not enabled.', 403);
  }
  const [item] = await db
    .update(workflowCatalogueItems)
    .set({ visibility: 'submitted', reviewStatus: 'pending', statusNote: null, updatedAt: new Date() })
    .where(and(eq(workflowCatalogueItems.id, itemId), eq(workflowCatalogueItems.creatorUserId, userId), eq(workflowCatalogueItems.creatorOrgId, orgId)))
    .returning();
  if (!item) throw catalogueValidationError('Draft workflow listing not found.', 404);
  await recordProductEvent({ orgId, userId, eventName: 'workflow_catalogue_submitted', metadata: eventMetadata(item) });
  return item;
}

export async function approveCatalogueItem(itemId, staffUserId) {
  const now = new Date();
  const [item] = await db
    .update(workflowCatalogueItems)
    .set({
      visibility: 'published',
      reviewStatus: 'approved',
      reviewedByUserId: staffUserId,
      reviewedAt: now,
      rejectionReason: null,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(workflowCatalogueItems.id, itemId))
    .returning();
  if (!item) throw catalogueValidationError('Workflow catalogue item not found.', 404);
  await createCatalogueVersion(item.id, 1, item.templateWorkflowDefinition, staffUserId, 'Initial approved version');
  await recordProductEvent({ orgId: item.creatorOrgId, userId: item.creatorUserId, eventName: 'workflow_catalogue_approved', metadata: eventMetadata(item) });
  return item;
}

export async function rejectCatalogueItem(itemId, staffUserId, reason) {
  const [item] = await db
    .update(workflowCatalogueItems)
    .set({
      visibility: 'rejected',
      reviewStatus: 'rejected',
      reviewedByUserId: staffUserId,
      reviewedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(workflowCatalogueItems.id, itemId))
    .returning();
  if (!item) throw catalogueValidationError('Workflow catalogue item not found.', 404);
  await recordProductEvent({ orgId: item.creatorOrgId, userId: item.creatorUserId, eventName: 'workflow_catalogue_rejected', metadata: { ...eventMetadata(item), reason } });
  return item;
}

export async function archiveCatalogueItem(itemId, staffUserId) {
  const [item] = await db
    .update(workflowCatalogueItems)
    .set({ visibility: 'archived', archivedAt: new Date(), reviewedByUserId: staffUserId, updatedAt: new Date() })
    .where(eq(workflowCatalogueItems.id, itemId))
    .returning();
  if (!item) throw catalogueValidationError('Workflow catalogue item not found.', 404);
  return item;
}

export async function createOfficialCatalogueItem(staffUserId, payload) {
  ensureCatalogueEnabled();
  const { definition, warnings } = validateCatalogueWorkflowDefinition(payload.templateWorkflowDefinition);
  const estimatedCost = estimateCatalogueWorkflowCost(definition);
  const cost = {
    estimatedExecutionCredits: payload.estimatedExecutionCredits ?? estimatedCost.estimatedExecutionCredits,
    estimatedVideoCredits: payload.estimatedVideoCredits ?? estimatedCost.estimatedVideoCredits,
    estimatedCostGbp: payload.estimatedCostGbp ?? estimatedCost.estimatedCostGbp,
  };
  const slug = payload.slug?.trim() || await createUniqueCatalogueSlug(payload.title);
  const [item] = await db
    .insert(workflowCatalogueItems)
    .values({
      slug,
      title: payload.title,
      shortDescription: payload.shortDescription,
      longDescription: payload.longDescription ?? null,
      category: payload.category,
      tags: normalizeTags(payload.tags),
      visibility: payload.visibility ?? 'published',
      templateWorkflowDefinition: definition,
      creatorUserId: staffUserId,
      creatorDisplayName: payload.creatorDisplayName ?? 'Prymal',
      publisherType: 'prymal_official',
      pricingType: 'free',
      reviewStatus: 'approved',
      reviewedByUserId: staffUserId,
      reviewedAt: new Date(),
      publishedAt: payload.visibility === 'draft' ? null : new Date(),
      difficulty: payload.difficulty ?? 'beginner',
      expectedRuntimeLabel: payload.expectedRuntimeLabel ?? null,
      requiredPlan: payload.requiredPlan ?? null,
      expectedOutput: normalizeList(payload.expectedOutput),
      requiredInputs: normalizeList(payload.requiredInputs),
      validationWarnings: warnings,
      ...cost,
    })
    .onConflictDoUpdate({
      target: workflowCatalogueItems.slug,
      set: {
        title: payload.title,
        shortDescription: payload.shortDescription,
        longDescription: payload.longDescription ?? null,
        category: payload.category,
        tags: normalizeTags(payload.tags),
        templateWorkflowDefinition: definition,
        expectedOutput: normalizeList(payload.expectedOutput),
        requiredInputs: normalizeList(payload.requiredInputs),
        validationWarnings: warnings,
        estimatedExecutionCredits: cost.estimatedExecutionCredits,
        estimatedVideoCredits: cost.estimatedVideoCredits,
        estimatedCostGbp: cost.estimatedCostGbp,
        difficulty: payload.difficulty ?? 'beginner',
        expectedRuntimeLabel: payload.expectedRuntimeLabel ?? null,
        requiredPlan: payload.requiredPlan ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return item;
}

export async function updateCatalogueItem({ itemId, userId, orgId, payload }) {
  const existing = await db.query.workflowCatalogueItems.findFirst({
    where: and(eq(workflowCatalogueItems.id, itemId), eq(workflowCatalogueItems.creatorUserId, userId), eq(workflowCatalogueItems.creatorOrgId, orgId)),
  });
  if (!existing) throw catalogueValidationError('Workflow catalogue item not found.', 404);
  if (!['draft', 'private', 'rejected'].includes(existing.visibility)) {
    throw catalogueValidationError('Published or submitted items cannot be edited directly. Create a new version after review.', 409);
  }
  if (payload.pricingType === 'premium' && !isWorkflowCataloguePremiumEnabled()) {
    throw catalogueValidationError('Premium workflow submissions are not available yet.', 403);
  }
  const definition = payload.templateWorkflowDefinition
    ? validateCatalogueWorkflowDefinition(payload.templateWorkflowDefinition)
    : { definition: existing.templateWorkflowDefinition, warnings: existing.validationWarnings ?? [] };
  const cost = estimateCatalogueWorkflowCost(definition.definition);
  const [item] = await db
    .update(workflowCatalogueItems)
    .set({
      ...(payload.title ? { title: payload.title.trim() } : {}),
      ...(payload.shortDescription ? { shortDescription: payload.shortDescription.trim() } : {}),
      ...(payload.longDescription !== undefined ? { longDescription: payload.longDescription?.trim() || null } : {}),
      ...(payload.category ? { category: payload.category.trim() } : {}),
      ...(payload.tags ? { tags: normalizeTags(payload.tags) } : {}),
      ...(payload.difficulty ? { difficulty: payload.difficulty } : {}),
      ...(payload.expectedRuntimeLabel !== undefined ? { expectedRuntimeLabel: payload.expectedRuntimeLabel || null } : {}),
      ...(payload.requiredPlan !== undefined ? { requiredPlan: payload.requiredPlan || null } : {}),
      ...(payload.expectedOutput ? { expectedOutput: normalizeList(payload.expectedOutput) } : {}),
      ...(payload.requiredInputs ? { requiredInputs: normalizeList(payload.requiredInputs) } : {}),
      ...(payload.pricingType ? { pricingType: normalizePricingType(payload.pricingType) } : {}),
      templateWorkflowDefinition: definition.definition,
      validationWarnings: definition.warnings,
      ...cost,
      reviewStatus: 'not_submitted',
      visibility: 'draft',
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(workflowCatalogueItems.id, itemId))
    .returning();
  return item;
}

export async function recordCatalogueInstall(itemId, installedWorkflowId, orgId, userId) {
  await db.insert(workflowCatalogueInstalls).values({
    catalogueItemId: itemId,
    installedWorkflowId,
    orgId,
    userId,
  });
  await db
    .update(workflowCatalogueItems)
    .set({ installCount: sql`${workflowCatalogueItems.installCount} + 1`, updatedAt: new Date() })
    .where(eq(workflowCatalogueItems.id, itemId));
}

export async function recordCatalogueRun(itemId) {
  if (!itemId) return;
  await db
    .update(workflowCatalogueItems)
    .set({ runCount: sql`${workflowCatalogueItems.runCount} + 1`, updatedAt: new Date() })
    .where(eq(workflowCatalogueItems.id, itemId));
}

export async function createCatalogueReview({ itemId, userId, orgId, rating, text }) {
  const installed = await db.query.workflowCatalogueInstalls.findFirst({
    where: and(eq(workflowCatalogueInstalls.catalogueItemId, itemId), eq(workflowCatalogueInstalls.orgId, orgId)),
  });
  if (!installed) throw catalogueValidationError('Install this workflow before reviewing it.', 403);
  const [review] = await db
    .insert(workflowCatalogueReviews)
    .values({ catalogueItemId: itemId, userId, orgId, rating, reviewText: text ?? null })
    .onConflictDoUpdate({
      target: [workflowCatalogueReviews.catalogueItemId, workflowCatalogueReviews.userId],
      set: { rating, reviewText: text ?? null, updatedAt: new Date() },
    })
    .returning();
  await refreshCatalogueRating(itemId);
  await recordProductEvent({ orgId, userId, eventName: 'workflow_catalogue_review_added', metadata: { itemId, rating } });
  return review;
}

export async function createCataloguePurchase({ item, buyerOrgId, buyerUserId }) {
  if (!isWorkflowCataloguePremiumEnabled()) {
    throw catalogueValidationError('Premium workflow purchases are not available yet.', 403);
  }
  const amount = Number(item.priceGbpPence ?? 0);
  const platformFee = Math.round(amount * WORKFLOW_CATALOGUE_PLATFORM_FEE_BPS / 10000);
  const [purchase] = await db.insert(workflowCataloguePurchases).values({
    catalogueItemId: item.id,
    buyerUserId,
    buyerOrgId,
    sellerUserId: item.creatorUserId,
    sellerOrgId: item.creatorOrgId,
    amountGbpPence: amount,
    platformFeeGbpPence: platformFee,
    creatorPayoutGbpPence: amount - platformFee,
    status: 'pending',
  }).returning();
  return purchase;
}

export function serializeCatalogueItem(item, { includeDefinition = false } = {}) {
  if (!item) return null;
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    shortDescription: item.shortDescription,
    longDescription: item.longDescription,
    category: item.category,
    tags: item.tags ?? [],
    visibility: item.visibility,
    publisherType: item.publisherType,
    pricingType: item.pricingType,
    priceGbpPence: item.priceGbpPence,
    premiumEnabled: isWorkflowCataloguePremiumEnabled(),
    creatorDisplayName: item.creatorDisplayName,
    installCount: item.installCount,
    runCount: item.runCount,
    ratingAverage: item.ratingAverage,
    ratingCount: item.ratingCount,
    estimatedExecutionCredits: item.estimatedExecutionCredits,
    estimatedVideoCredits: item.estimatedVideoCredits,
    estimatedCostGbp: item.estimatedCostGbp,
    difficulty: item.difficulty,
    expectedRuntimeLabel: item.expectedRuntimeLabel,
    requiredPlan: item.requiredPlan,
    expectedOutput: item.expectedOutput ?? [],
    requiredInputs: item.requiredInputs ?? [],
    reviewStatus: item.reviewStatus,
    rejectionReason: item.rejectionReason,
    validationWarnings: item.validationWarnings ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    ...(includeDefinition ? { templateWorkflowDefinition: item.templateWorkflowDefinition } : {}),
  };
}

function buildCatalogueWhere(filters, options) {
  const clauses = [];
  if (options.includeMine && options.orgId) {
    clauses.push(or(eq(workflowCatalogueItems.visibility, 'published'), eq(workflowCatalogueItems.creatorOrgId, options.orgId)));
  } else if (options.reviewStatus) {
    clauses.push(eq(workflowCatalogueItems.reviewStatus, options.reviewStatus));
  } else {
    clauses.push(eq(workflowCatalogueItems.visibility, 'published'));
  }
  if (filters.category) clauses.push(eq(workflowCatalogueItems.category, filters.category));
  if (filters.tag) clauses.push(sql`${workflowCatalogueItems.tags} @> ${JSON.stringify([String(filters.tag).toLowerCase()])}::jsonb`);
  if (filters.pricingType) clauses.push(eq(workflowCatalogueItems.pricingType, filters.pricingType));
  if (filters.difficulty) clauses.push(eq(workflowCatalogueItems.difficulty, filters.difficulty));
  if (filters.requiredPlan) clauses.push(eq(workflowCatalogueItems.requiredPlan, filters.requiredPlan));
  if (filters.search) {
    const term = `%${filters.search}%`;
    clauses.push(or(ilike(workflowCatalogueItems.title, term), ilike(workflowCatalogueItems.shortDescription, term), ilike(workflowCatalogueItems.category, term)));
  }
  return and(...clauses);
}

function buildCatalogueOrder(sort) {
  if (sort === 'newest') return [desc(workflowCatalogueItems.publishedAt), desc(workflowCatalogueItems.createdAt)];
  if (sort === 'rating') return [desc(workflowCatalogueItems.ratingAverage), desc(workflowCatalogueItems.ratingCount)];
  if (sort === 'official') return [desc(workflowCatalogueItems.publisherType), desc(workflowCatalogueItems.installCount)];
  return [desc(workflowCatalogueItems.installCount), desc(workflowCatalogueItems.publishedAt)];
}

function planAllows(actualPlan = 'free', requiredPlan = null) {
  if (!requiredPlan) return true;
  return (PLAN_RANK[actualPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
}

function normalizePricingType(value) {
  if (value === 'premium' && !isWorkflowCataloguePremiumEnabled()) {
    throw catalogueValidationError('Premium workflow submissions are not available yet.', 403);
  }
  return value === 'premium' ? 'premium' : 'free';
}

function normalizeTags(tags = []) {
  return [...new Set((Array.isArray(tags) ? tags : String(tags).split(','))
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean))]
    .slice(0, 12);
}

function normalizeList(value = []) {
  return (Array.isArray(value) ? value : String(value).split('\n'))
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function createUniqueCatalogueSlug(title) {
  const base = slugify(title || 'workflow');
  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await db.query.workflowCatalogueItems.findFirst({ where: eq(workflowCatalogueItems.slug, slug) });
    if (!existing) return slug;
  }
  return `${base}-${Date.now()}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'workflow';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

async function refreshCatalogueRating(itemId) {
  const rows = await db
    .select({
      ratingAverage: sql`avg(${workflowCatalogueReviews.rating})::real`,
      ratingCount: sql`count(*)::int`,
    })
    .from(workflowCatalogueReviews)
    .where(eq(workflowCatalogueReviews.catalogueItemId, itemId));
  const summary = rows[0] ?? {};
  await db.update(workflowCatalogueItems).set({
    ratingAverage: summary.ratingAverage ?? null,
    ratingCount: summary.ratingCount ?? 0,
    updatedAt: new Date(),
  }).where(eq(workflowCatalogueItems.id, itemId));
}

async function createCatalogueVersion(itemId, versionNumber, definition, userId, changelog = null) {
  await db.insert(workflowCatalogueVersions).values({
    catalogueItemId: itemId,
    versionNumber,
    workflowDefinition: definition,
    changelog,
    createdByUserId: userId,
  }).onConflictDoNothing();
}

function eventMetadata(item) {
  return {
    itemId: item.id,
    slug: item.slug,
    category: item.category,
    pricingType: item.pricingType,
    difficulty: item.difficulty,
    requiredPlan: item.requiredPlan,
  };
}

function catalogueValidationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
