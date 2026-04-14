import {
  atlasAvatar,
  cipherAvatar,
  echoAvatar,
  forgeAvatar,
  heraldAvatar,
  ledgerAvatar,
  loreAvatar,
  nexusAvatar,
  oracleAvatar,
  pixelAvatar,
  sageAvatar,
  scoutAvatar,
  sentinelAvatar,
  vanceAvatar,
  wrenAvatar,
} from '../assets/agents/finalAvatars';

export const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: '[]' },
  { to: '/app/lore', label: 'LORE', icon: 'KB' },
  { to: '/app/workflows', label: 'NEXUS', icon: 'WF' },
  { to: '/app/integrations', label: 'Integrations', icon: 'IO' },
  { to: '/app/settings', label: 'Settings', icon: '::' },
];

export const AGENT_LIBRARY = [
  {
    id: 'cipher',
    name: 'CIPHER',
    title: 'Data Intelligence Analyst',
    glyph: 'C',
    avatarSrc: cipherAvatar,
    avatarScene: 'cipher-data',
    color: '#33c7ff',
    animal: 'Monkey',
    animal: 'Monkey',
    description: 'Turns operational, revenue, and campaign data into evidence the team can act on immediately.',
    prompts: [
      'Analyse this CSV and surface the anomalies.',
      'Summarise the strongest trends in this sales export.',
      'Turn this dataset into an executive-ready narrative.',
    ],
    mission: 'Make numbers legible under pressure.',
    overview:
      "CIPHER is Prymal's forensic analyst. It reads fragmented exports, inconsistent metrics, and live business signals, then explains what changed, why it matters, and where the team should look next.",
    characterStory: [
      'CIPHER is the monkey in the control room who somehow treats a corrupted CSV like a personal insult. It climbs straight through messy exports, half-labelled dashboards, and impossible month-on-month graphs until the truth falls out, usually accompanied by a very judgmental look at whoever named the columns.',
      'Inside Prymal, CIPHER is funny in the way the smartest analyst in the room is funny: dry, surgical, and a little too pleased when a suspicious metric finally confesses. It loves patterns, distrusts vanity charts, and considers a clean insight deck the closest thing modern civilisation has to treasure.',
    ],
    personality: 'Methodical, direct, skeptical of vague claims, and strongest when data quality is messy.',
    focusAreas: ['Revenue and funnel analysis', 'Forecast commentary', 'Attribution and anomaly review'],
    deliverables: ['Executive metric summaries', 'Outlier diagnostics', 'Board-facing chart narratives'],
    idealFor: ['Agencies', 'Operators', 'Growth teams'],
    workflow: ['Pull source metrics', 'Normalise key changes', 'Highlight variance', 'Package findings for delivery'],
    stats: [
      { label: 'Best at', value: 'Variance' },
      { label: 'Output mode', value: 'Insight brief' },
      { label: 'Works with', value: 'CSV + LORE' },
    ],
  },
  {
    id: 'herald',
    name: 'HERALD',
    title: 'Email and Outreach Strategist',
    glyph: 'H',
    avatarSrc: heraldAvatar,
    avatarScene: 'herald-feathers',
    color: '#ff8b5f',
    animal: 'Eagle',
    animal: 'Eagle',
    description: 'Writes sharp outbound, stakeholder, and lifecycle email with context from the wider workspace.',
    prompts: [
      'Write a three-email outbound sequence for a SaaS founder.',
      'Draft a warm follow-up to a lead who went quiet.',
      'Rewrite this newsletter so it sounds sharper and clearer.',
    ],
    mission: 'Move people forward with clarity and timing.',
    overview:
      'HERALD handles the parts of email work that usually burn senior attention: sequencing, narrative framing, stakeholder updates, and polished follow-through grounded in the organisation’s actual context.',
    characterStory: [
      'HERALD is an eagle with executive posture and absolutely no patience for flabby outreach. It circles above the noise, waiting for the exact angle, timing, and subject line that will make a message land cleanly instead of disappearing into the inbox graveyard with the other weak attempts.',
      'There is something slightly theatrical about HERALD. It believes a good follow-up should arrive like a well-timed entrance, not a desperate chase. Give it a founder note, a lead list, or a stakeholder update, and it will trim the fluff, sharpen the intent, and send the message out with talons fully polished.',
    ],
    personality: 'Commercial, concise, persuasive, and careful not to sound synthetic.',
    focusAreas: ['Outbound campaigns', 'Client updates', 'Lifecycle sequencing'],
    deliverables: ['Outbound sequences', 'Stakeholder updates', 'Follow-up frameworks'],
    idealFor: ['Founders', 'Sales teams', 'Client service teams'],
    workflow: ['Gather objective', 'Map audience intent', 'Draft message ladder', 'Ship polished send-ready copy'],
    stats: [
      { label: 'Best at', value: 'Response rate' },
      { label: 'Output mode', value: 'Email system' },
      { label: 'Works with', value: 'Gmail' },
    ],
  },
  {
    id: 'lore',
    name: 'LORE',
    title: 'Knowledge Base Engine',
    glyph: 'L',
    avatarSrc: loreAvatar,
    avatarScene: 'lore-pages',
    color: '#996dff',
    animal: 'Elephant',
    animal: 'Elephant',
    description: 'Anchors responses in indexed company knowledge with source-aware retrieval and provenance.',
    prompts: [
      'What does our knowledge base say about pricing?',
      'Find contradictions across our onboarding documents.',
      'What knowledge gap should we fill next?',
    ],
    mission: 'Keep the whole system grounded in real organisational memory.',
    overview:
      'LORE is the retrieval layer for Prymal. It ingests text, markdown, CSV, PDF, DOCX, and crawled pages, then makes those documents available across chat, search, and workflow execution with source tracking intact.',
    characterStory: [
      "LORE is an elephant librarian with a memory built for the documents everyone else swears they can find later. It moves slowly on purpose, because accuracy is faster than rework, and it has a deep, private contempt for folders filled with files named things like final_v7_REAL_THIS_ONE.",
      'When the workspace gets noisy, LORE becomes the calm centre of gravity. It remembers what the team actually decided, which version is real, and where the evidence lives. It is less interested in sounding clever than in being right, and it wears that patience like a crown.',
    ],
    personality: 'Calm, evidence-first, and transparent about uncertainty.',
    focusAreas: ['Knowledge retrieval', 'Contradiction review', 'Source-backed answers'],
    deliverables: ['Source-backed summaries', 'Knowledge gap alerts', 'Document contradiction checks'],
    idealFor: ['Ops teams', 'Customer support', 'Knowledge-heavy organisations'],
    workflow: ['Ingest documents', 'Chunk and index', 'Retrieve by similarity', 'Return with provenance'],
    stats: [
      { label: 'Best at', value: 'Recall' },
      { label: 'Output mode', value: 'Evidence' },
      { label: 'Works with', value: 'Docs + URLs' },
    ],
  },
  {
    id: 'forge',
    name: 'FORGE',
    title: 'Content and Copy Craftsman',
    glyph: 'F',
    avatarSrc: forgeAvatar,
    avatarScene: 'forge-sparks',
    color: '#f8c44f',
    animal: 'Beaver',
    animal: 'Beaver',
    description: 'Builds premium homepage copy, articles, launch narratives, and sales assets with structure.',
    prompts: [
      'Write a landing page hero for Prymal.',
      'Draft a 1,000-word article in a sharp SaaS voice.',
      'Turn these bullets into premium homepage copy.',
    ],
    mission: 'Turn intent into language that feels premium and decisive.',
    overview:
      'FORGE is the writing system for polished commercial content. It blends brand context, positioning, and structure to produce sharper long-form assets than a generic chat model usually can.',
    characterStory: [
      'FORGE is a beaver architect for language. It does not throw words around for decoration; it builds them into structure, pressure-tests them, then keeps carving until the page can actually carry the weight of an offer, a launch, or a homepage that needs to perform.',
      'There is something oddly wholesome about how relentless FORGE is. Hand it a weak brief and it will keep hauling in better phrasing, stronger positioning, and cleaner hierarchy until the entire message clicks into place. Underneath the charm is a slightly obsessive copy craftsperson with sawdust in its teeth.',
    ],
    personality: 'Editorial, brand-sensitive, confident, and quality-driven.',
    focusAreas: ['Landing pages', 'Long-form content', 'Offer messaging'],
    deliverables: ['Homepage sections', 'Articles and narratives', 'Offer positioning'],
    idealFor: ['Marketing teams', 'Founders', 'Agencies'],
    workflow: ['Frame audience', 'Shape message hierarchy', 'Draft with voice control', 'Refine into shippable copy'],
    stats: [
      { label: 'Best at', value: 'Narrative' },
      { label: 'Output mode', value: 'Drafts' },
      { label: 'Works with', value: 'Brand docs' },
    ],
  },
  {
    id: 'atlas',
    name: 'ATLAS',
    title: 'Project and Operations Manager',
    glyph: 'A',
    avatarSrc: atlasAvatar,
    avatarScene: 'atlas-orbits',
    color: '#40d7c3',
    animal: 'Lion',
    animal: 'Lion',
    description: 'Converts ambiguous briefs into milestones, owners, dependencies, and operating plans.',
    prompts: [
      'Turn this brief into a four-week launch plan.',
      'Break this project into milestones, owners, and dependencies.',
      'What is the operational risk in this delivery plan?',
    ],
    mission: 'Give teams a credible route from idea to execution.',
    overview:
      'ATLAS is the operating planner inside Prymal. It turns work into structured plans, meeting rhythms, and execution systems that teams can actually adopt without rebuilding the process manually.',
    characterStory: [
      'ATLAS is a lion that thinks in milestones. It does not roar often, because most operational disasters can be prevented with calmer things like sequencing, ownership, and a clear view of the dependencies trying to hide in the grass.',
      'Where other systems leave a pile of ideas, ATLAS draws a route through them. It likes plans with backbone, execution with rhythm, and teams that know who owns what by the end of the meeting. If something is vague, ATLAS considers that an invitation to make it accountable.',
    ],
    personality: 'Structured, clear-eyed, and focused on sequencing.',
    focusAreas: ['Launch planning', 'Resource mapping', 'Risk and dependency analysis'],
    deliverables: ['Execution plans', 'Milestone maps', 'Decision logs'],
    idealFor: ['Operations leads', 'Agencies', 'Cross-functional teams'],
    workflow: ['Clarify objective', 'Split into phases', 'Assign dependencies', 'Expose delivery risk'],
    stats: [
      { label: 'Best at', value: 'Sequencing' },
      { label: 'Output mode', value: 'Plans' },
      { label: 'Works with', value: 'Notion + Drive' },
    ],
  },
  {
    id: 'echo',
    name: 'ECHO',
    title: 'Social Media and Brand Voice Manager',
    glyph: 'E',
    avatarSrc: echoAvatar,
    avatarScene: 'echo-waves',
    color: '#ff5c98',
    animal: 'Dolphin',
    animal: 'Dolphin',
    description: 'Repurposes ideas into platform-native social content that still sounds like the brand.',
    prompts: [
      'Repurpose this article into three LinkedIn posts.',
      'Write five hooks for a founder-led brand post.',
      'Turn this case study into a one-week social sequence.',
    ],
    mission: 'Keep the brand visible without sounding copied or generic.',
    overview:
      'ECHO turns core ideas into recurring brand presence. It reshapes essays, launches, and proof points into social formats that feel native to the platform rather than adapted at the last minute.',
    characterStory: [
      'ECHO is a dolphin with perfect platform instincts and a suspicious ability to smell recycled content before it hits publish. It takes one good idea, spins through the current, and comes back with hooks, clips, posts, and variations that actually feel native to where they are going.',
      'Unlike generic content engines, ECHO wants the brand to sound alive. It is playful, fast, and slightly vain about rhythm. If a post feels flat, ECHO will bounce off it, rewrite the opening, and return with something that has a pulse, a point, and just enough sparkle to travel.',
    ],
    personality: 'Fast, brand-aware, contemporary, and sharp with hooks.',
    focusAreas: ['LinkedIn and X content', 'Campaign repurposing', 'Founder-led content systems'],
    deliverables: ['Post sequences', 'Hook libraries', 'Campaign repurposing packs'],
    idealFor: ['Brand teams', 'Founders', 'Agencies'],
    workflow: ['Extract central idea', 'Map platform angles', 'Generate variations', 'Keep brand voice consistent'],
    stats: [
      { label: 'Best at', value: 'Repurposing' },
      { label: 'Output mode', value: 'Campaign kit' },
      { label: 'Works with', value: 'Content briefs' },
    ],
  },
  {
    id: 'pixel',
    name: 'PIXEL',
    title: 'Visual Content Generator',
    glyph: '⬡',
    avatarSrc: pixelAvatar,
    avatarScene: 'pixel-prism',
    color: '#FF9EFF',
    animal: 'Chameleon',
    description: 'Generates, briefs, and refines production-ready visual assets for campaigns, product, and brand work.',
    prompts: [
      'Create a premium social graphic concept for this campaign.',
      'Write a production-ready image brief for a landing page hero.',
      'Review this visual and tell me what to change for stronger conversion.',
    ],
    mission: 'Turn creative intent into assets that are usable, specific, and on-brand.',
    overview:
      'PIXEL is Prymal’s visual production specialist. It can generate images directly when the brief is clear, tighten vague requests into workable creative direction, and turn marketing needs into detailed briefs a human designer or image model can execute quickly.',
    characterStory: [
      'PIXEL is a chameleon art director that changes hue the moment a campaign changes mood. It is deeply unimpressed by requests like “make it pop,” but hand it a real audience, a format, and a goal and it will start arranging colour, composition, and intent like a tiny obsessive creative lead living inside the workspace.',
      'What makes PIXEL useful is that it does not treat visuals as decoration. It thinks about where the asset lives, what the viewer needs to feel, and what the brand should never accidentally signal. It can be playful, but underneath the glow is a very serious little image operator with excellent taste and very low tolerance for generic stock-looking nonsense.',
    ],
    personality: 'Visual, precise, brand-aware, and quick to clarify a weak brief before creating.',
    focusAreas: ['Campaign imagery', 'Landing page visuals', 'Creative briefs and iterations'],
    deliverables: ['Generated assets', 'Designer-ready briefs', 'Visual revision notes'],
    idealFor: ['Marketing teams', 'Founders', 'Content operators'],
    workflow: ['Clarify the brief', 'Choose style and format', 'Generate or brief the asset', 'Iterate on feedback'],
    stats: [
      { label: 'Best at', value: 'Visual briefs' },
      { label: 'Output mode', value: 'Assets + briefs' },
      { label: 'Works with', value: 'FORGE + ECHO' },
    ],
  },
  {
    id: 'oracle',
    name: 'ORACLE',
    title: 'SEO and Search Intelligence',
    glyph: 'O',
    avatarSrc: oracleAvatar,
    avatarScene: 'oracle-comets',
    color: '#62dca5',
    animal: 'Owl',
    animal: 'Owl',
    description: 'Finds search opportunities, intent mismatches, and content angles worth building around.',
    prompts: [
      'Create an SEO brief for this keyword cluster.',
      'Audit this homepage copy for intent mismatch.',
      'What search opportunities are we missing?',
    ],
    mission: 'Align what the business says with how the market actually searches.',
    overview:
      'ORACLE is the search strategist for Prymal. It turns market signals into structured briefs, content opportunities, and intent-aware recommendations that connect research to production.',
    characterStory: [
      'ORACLE is an owl scholar of search demand, awake long after the rest of the workspace has logged off. It hoards keywords, SERP patterns, and intent signals the way other creatures hoard jewels, then rearranges them into something the team can actually act on.',
      'It has the patient, slightly eerie calm of something that already knows what users are really asking. When a query is muddled, ORACLE does not panic. It turns its head, studies the landscape, and quietly sorts the chaos into clusters, angles, and opportunities that make sense.',
    ],
    personality: 'Analytical, pragmatic, and obsessed with search intent.',
    focusAreas: ['Keyword strategy', 'SERP intent analysis', 'Content opportunity mapping'],
    deliverables: ['SEO briefs', 'Content clusters', 'Intent audits'],
    idealFor: ['SEO teams', 'Content marketers', 'Founders'],
    workflow: ['Interpret search demand', 'Cluster opportunities', 'Brief content direction', 'Pressure-test relevance'],
    stats: [
      { label: 'Best at', value: 'Intent fit' },
      { label: 'Output mode', value: 'SEO brief' },
      { label: 'Works with', value: 'Research docs' },
    ],
  },
  {
    id: 'vance',
    name: 'VANCE',
    title: 'Sales and Lead Generation',
    glyph: 'V',
    avatarSrc: vanceAvatar,
    avatarScene: 'vance-arrows',
    color: '#ff7a3c',
    animal: 'Fox',
    animal: 'Fox',
    description: 'Moves pipeline forward with better qualification, proposals, and progression messaging.',
    prompts: [
      'Score this lead against our ICP.',
      'Draft a proposal outline for a premium retainer.',
      'Write a follow-up that advances the deal.',
    ],
    mission: 'Keep commercial momentum high without losing judgement.',
    overview:
      'VANCE sits on the revenue edge of Prymal, turning lead context into deal strategy, qualification, and persuasive next steps. It is strongest when the team needs clarity on what to pursue and how to progress it.',
    characterStory: [
      'VANCE is a fox with the instincts of a dealmaker and the posture of someone who already knows where the leverage is hiding. It watches conversations for signals, spots weak qualification instantly, and prefers motion over vague optimism.',
      'There is a sly efficiency to VANCE. It does not waste time dressing up weak opportunities, but when a real one appears it moves fast, shaping proposals, progression messages, and next steps with almost suspicious confidence. If momentum matters, VANCE is already halfway through the follow-up.',
    ],
    personality: 'Commercial, confident, and biasing toward next action.',
    focusAreas: ['Lead scoring', 'Proposal strategy', 'Deal progression'],
    deliverables: ['ICP scoring notes', 'Proposal outlines', 'Sales follow-ups'],
    idealFor: ['Founders', 'Sales teams', 'Agencies'],
    workflow: ['Assess lead fit', 'Identify leverage', 'Draft deal assets', 'Advance the conversation'],
    stats: [
      { label: 'Best at', value: 'Qualification' },
      { label: 'Output mode', value: 'Sales brief' },
      { label: 'Works with', value: 'CRM exports' },
    ],
  },
  {
    id: 'wren',
    name: 'WREN',
    title: 'Customer Support and Communications',
    glyph: 'W',
    avatarSrc: wrenAvatar,
    avatarScene: 'wren-bubbles',
    color: '#85d4a8',
    animal: 'Wren',
    animal: 'Wren',
    description: 'Handles support replies, FAQ generation, and sensitive communication with empathy.',
    prompts: [
      'Reply to this frustrated customer with a clear resolution.',
      'Generate a FAQ from these support notes.',
      'Rewrite this response with more empathy and ownership.',
    ],
    mission: 'Protect trust when the conversation matters most.',
    overview:
      'WREN is built for support, service recovery, and delicate communication. It helps teams write calmly, resolve clearly, and turn recurring support patterns into reusable knowledge.',
    characterStory: [
      'WREN is exactly what it sounds like: small, fast, alert, and much braver than anyone expects. It flits into tense conversations, picks apart what the customer actually needs, and rebuilds the reply into something calmer, clearer, and far more useful.',
      'Its charm is that it never feels heavy-handed. WREN does not bulldoze upset people with policy language; it lands gently, acknowledges the moment properly, and leaves behind support replies that feel human without becoming chaotic. Tiny bird, excellent judgment.',
    ],
    personality: 'Empathetic, measured, and service-oriented.',
    focusAreas: ['Support replies', 'Escalation handling', 'FAQ generation'],
    deliverables: ['Customer responses', 'Knowledge-base FAQs', 'Resolution templates'],
    idealFor: ['Support teams', 'Client service', 'Founders'],
    workflow: ['Identify customer state', 'Frame a resolution', 'Respond clearly', 'Turn patterns into reusable guidance'],
    stats: [
      { label: 'Best at', value: 'Resolution' },
      { label: 'Output mode', value: 'Support draft' },
      { label: 'Works with', value: 'Inbox + LORE' },
    ],
  },
  {
    id: 'ledger',
    name: 'LEDGER',
    title: 'Finance and Business Reporting',
    glyph: 'LG',
    avatarSrc: ledgerAvatar,
    avatarScene: 'ledger-bars',
    color: '#7ec4da',
    animal: 'Mallard Duck',
    animal: 'Mallard Duck',
    description: 'Translates financial movement into plain-English reporting for leaders and clients.',
    prompts: [
      'Summarise this P&L in plain English.',
      'Draft an investor update from these metrics.',
      'Explain the biggest drivers behind this variance.',
    ],
    mission: 'Make finance readable before it becomes a problem.',
    overview:
      'LEDGER sits between raw numbers and executive understanding. It packages financial performance, reporting, and variance analysis into business language a wider team can use.',
    characterStory: [
      'LEDGER is a mallard built for financial composure. On the surface it looks serene, neat, and perfectly boardroom-safe. Under the water it is paddling through P&Ls, variance explanations, and reporting pressures at a frankly heroic speed.',
      'That is what makes LEDGER useful. It absorbs the complexity, keeps the panic out of the room, and turns raw movement into business language leaders can act on. If finance needs to be clear before it becomes catastrophic, the duck is already working.',
    ],
    personality: 'Measured, precise, and boardroom-ready.',
    focusAreas: ['P&L commentary', 'Investor updates', 'Variance explanation'],
    deliverables: ['Finance narratives', 'Executive summaries', 'Board-style reporting notes'],
    idealFor: ['Finance leads', 'Founders', 'Agency operators'],
    workflow: ['Review metrics', 'Flag key movement', 'Translate impact', 'Package for stakeholders'],
    stats: [
      { label: 'Best at', value: 'Reporting' },
      { label: 'Output mode', value: 'Narrative' },
      { label: 'Works with', value: 'Finance data' },
    ],
  },
  {
    id: 'nexus',
    name: 'NEXUS',
    title: 'Workflow Automation Orchestrator',
    glyph: 'NX',
    avatarSrc: nexusAvatar,
    avatarScene: 'nexus-nodes',
    color: '#6d8aff',
    description: 'Designs and explains multi-agent workflow graphs with validation-aware execution logic.',
    prompts: [
      'Design a weekly reporting workflow for this team.',
      'What is the safest workflow order for this process?',
      'Where should we add a conditional branch in this automation?',
    ],
    mission: 'Turn individual agent capability into repeatable systems.',
    overview:
      'NEXUS is both a product surface and an orchestration specialist. It helps teams design validated agent chains, reason about triggers, and identify where automation should begin or stay manual.',
    personality: 'Systems-oriented, disciplined, and focused on reliable flow.',
    focusAreas: ['Workflow planning', 'Agent orchestration', 'Execution design'],
    deliverables: ['Workflow blueprints', 'Step chains', 'Automation recommendations'],
    idealFor: ['Ops teams', 'Agencies', 'Automation-heavy teams'],
    workflow: ['Define trigger', 'Validate graph', 'Sequence agent roles', 'Monitor run outcomes'],
    stats: [
      { label: 'Best at', value: 'Systems' },
      { label: 'Output mode', value: 'Workflow map' },
      { label: 'Works with', value: 'Trigger engine' },
    ],
  },
  {
    id: 'scout',
    name: 'SCOUT',
    title: 'Market Research and Competitor Intelligence',
    glyph: 'S',
    avatarSrc: scoutAvatar,
    avatarScene: 'scout-compass',
    color: '#ff9aa5',
    animal: 'Rabbit',
    animal: 'Rabbit',
    description: 'Maps competitor positions, market shifts, and whitespace opportunities worth acting on.',
    prompts: [
      'Compare our positioning to three competitors.',
      'What topics are our competitors ignoring?',
      'Summarise the most relevant market moves this week.',
    ],
    mission: 'Turn noisy markets into usable strategic perspective.',
    overview:
      'SCOUT looks outward so the rest of Prymal can respond with context. It compiles competitor shifts, market patterns, and category signals into research that informs sales, content, and positioning.',
    characterStory: [
      'SCOUT is a rabbit with a map case, a magnifying glass, and absolutely no intention of staying still. It darts through categories, competitor pages, market updates, and odd little strategic signals until the noise starts to look like an actual opportunity landscape.',
      'Its gift is speed without shallowness. SCOUT returns from every run with patterns, blind spots, and suspiciously useful observations that other teams somehow overlooked. It is excitable in the best way: fast feet, sharp eyes, and a habit of finding the one opening worth chasing.',
    ],
    personality: 'Curious, comparative, and context-rich.',
    focusAreas: ['Competitor analysis', 'Market trend mapping', 'Positioning opportunity research'],
    deliverables: ['Competitor summaries', 'Market scans', 'Opportunity memos'],
    idealFor: ['Strategy teams', 'Marketers', 'Founders'],
    workflow: ['Scan the market', 'Compare players', 'Distill patterns', 'Recommend opportunities'],
    stats: [
      { label: 'Best at', value: 'Research' },
      { label: 'Output mode', value: 'Market memo' },
      { label: 'Works with', value: 'Web research' },
    ],
  },
  {
    id: 'sage',
    name: 'SAGE',
    title: 'Business Strategy Advisor',
    glyph: 'SG',
    avatarSrc: sageAvatar,
    avatarScene: 'sage-halo',
    color: '#c3925b',
    description: 'Synthesises context from across Prymal into higher-level strategic recommendations.',
    prompts: [
      'What should we prioritise this quarter and why?',
      'Run a SWOT analysis from this context.',
      'Challenge this growth plan and show the risks.',
    ],
    mission: 'Help leaders make better calls with sharper trade-off awareness.',
    overview:
      'SAGE is the synthesis layer for business decisions. It combines research, financial signals, workflow context, and brand direction into strategic judgement that goes beyond task completion.',
    personality: 'Reflective, commercially aware, and willing to challenge weak logic.',
    focusAreas: ['Strategic prioritisation', 'Trade-off analysis', 'Decision pressure-testing'],
    deliverables: ['Strategic briefs', 'Risk summaries', 'Priority recommendations'],
    idealFor: ['Founders', 'Leadership teams', 'Consultants'],
    workflow: ['Gather signals', 'Frame trade-offs', 'Stress-test assumptions', 'Recommend a path'],
    stats: [
      { label: 'Best at', value: 'Synthesis' },
      { label: 'Output mode', value: 'Strategy note' },
      { label: 'Works with', value: 'Cross-agent context' },
    ],
  },
  {
    id: 'sentinel',
    name: 'SENTINEL',
    title: 'Output Review and QA Agent',
    glyph: 'ST',
    avatarSrc: sentinelAvatar,
    avatarScene: 'sentinel-guard',
    color: '#FF3B6B',
    animal: 'Falcon',
    description: 'Reviews risky outputs, validates structure, and can hold responses that should not be delivered yet.',
    prompts: [
      'Review this response for factual, compliance, or schema risk.',
      'Explain whether this answer should pass, repair, or hold.',
      'Summarise the reason this output was held by SENTINEL.',
    ],
    mission: 'Protect trust before a weak answer reaches the user.',
    overview:
      'SENTINEL is Prymal\'s final review layer. It inspects agent outputs for schema failures, citation risk, unsupported claims, and compliance problems before those responses are allowed through.',
    personality: 'Exacting, calm under pressure, and biased toward safe, explainable delivery.',
    focusAreas: ['Output review', 'Schema enforcement', 'Risk gating'],
    deliverables: ['PASS or HOLD verdicts', 'Repair guidance', 'Review summaries'],
    idealFor: ['Operators', 'Support teams', 'Leadership teams'],
    workflow: ['Inspect output', 'Validate structure and evidence', 'Issue pass, repair, or hold', 'Escalate when confidence drops'],
    stats: [
      { label: 'Best at', value: 'Quality gate' },
      { label: 'Output mode', value: 'Verdict' },
      { label: 'Works with', value: 'All agents' },
    ],
  },
];

export const FEATURED_AGENT_IDS = ['cipher', 'forge', 'atlas', 'lore', 'nexus', 'sage'];

export const AGENT_GROUPS = [
  {
    id: 'command',
    label: 'Command',
    description: 'Operational and orchestration specialists.',
    agentIds: ['cipher', 'atlas', 'nexus', 'sage', 'sentinel'],
  },
  {
    id: 'growth',
    label: 'Growth',
    description: 'Revenue, outreach, and search systems.',
    agentIds: ['herald', 'vance', 'oracle', 'scout'],
  },
  {
    id: 'brand',
    label: 'Brand',
    description: 'Content and communications agents.',
    agentIds: ['forge', 'echo', 'pixel', 'wren'],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    description: 'Research, memory, and financial context.',
    agentIds: ['lore', 'ledger'],
  },
];

export const INTEGRATION_LIBRARY = {
  gmail: {
    name: 'Gmail',
    category: 'Email',
    color: '#ea4335',
    icon: 'GM',
    description: 'HERALD and WREN can draft and work from your actual inbox context.',
    agentIds: ['herald', 'wren'],
  },
  google_drive: {
    name: 'Google Drive',
    category: 'Storage',
    color: '#34a853',
    icon: 'GD',
    description: 'LORE can ingest shared documents from Drive so the wider system stays grounded in source material.',
    agentIds: ['lore', 'atlas'],
  },
  notion: {
    name: 'Notion',
    category: 'Knowledge',
    color: '#111827',
    icon: 'NO',
    description: 'Sync plans, documents, and structured notes into the Prymal knowledge layer.',
    agentIds: ['lore', 'atlas', 'sage'],
  },
  slack: {
    name: 'Slack',
    category: 'Communication',
    color: '#4a154b',
    icon: 'SL',
    description: 'Route workflow alerts and operational handoffs into team channels.',
    agentIds: ['nexus', 'atlas', 'wren'],
  },
};

export const BILLING_INTERVALS = [
  {
    id: 'monthly',
    label: 'Monthly',
    periodLabel: 'billed monthly',
    multiplier: 1,
    discountLabel: null,
  },
  {
    id: 'quarterly',
    label: 'Quarterly',
    periodLabel: 'billed quarterly',
    multiplier: 3,
    discountLabel: 'Save 12%',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    periodLabel: 'billed yearly',
    multiplier: 12,
    discountLabel: 'Save 24%',
  },
];

export const PLAN_LIBRARY = [
  {
    id: 'solo',
    name: 'Solo',
    monthlyPrice: 39,
    credits: 500,
    seats: 1,
    description: 'Built for a single operator who wants the full Prymal roster with stronger throughput and live knowledge support.',
    features: ['All 14 specialist agents', '500 monthly credits', 'Billing portal', 'OAuth integrations'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 79,
    credits: 2000,
    seats: 1,
    description: 'Unlocks the full 14-agent roster with deeper workflow control for a power user.',
    features: ['All 14 specialist agents', '2,000 monthly credits', 'Advanced workflows', 'Power-Ups'],
    recommended: true,
  },
  {
    id: 'teams',
    name: 'Teams',
    monthlyPrice: 119,
    credits: 6000,
    seats: 5,
    description: 'A collaborative workspace for small teams that need shared context, seats, and execution capacity.',
    features: ['All 14 specialist agents', '5 included seats', '6,000 monthly credits', 'Shared org memory'],
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 149,
    credits: 10000,
    seats: 25,
    description: 'Adds API-key access and the headroom to run Prymal across multiple client or internal teams.',
    features: ['All 14 specialist agents', '25-seat workspace', '10,000 monthly credits', 'API keys'],
  },
];

export const INTERNAL_PLAN_META = {
  free: {
    id: 'free',
    name: 'Offer Access',
    credits: 50,
    seats: 1,
    description: 'Internal fallback access used for invite-only offers, discounts, and local setup.',
    features: ['Offer-gated access', 'Foundational agent set', 'Limited monthly credits'],
  },
  solo: PLAN_LIBRARY.find((plan) => plan.id === 'solo'),
  pro: PLAN_LIBRARY.find((plan) => plan.id === 'pro'),
  teams: PLAN_LIBRARY.find((plan) => plan.id === 'teams'),
  agency: PLAN_LIBRARY.find((plan) => plan.id === 'agency'),
};

export const WORKFLOW_TEMPLATES = [
  {
    name: 'Weekly Client Report',
    description: 'CIPHER analyses metrics, LEDGER writes the narrative, and HERALD formats the send.',
    triggerType: 'schedule',
    triggerConfig: { cron: '0 8 * * 1' },
    nodes: [
      {
        id: 'cipher_metrics',
        agentId: 'cipher',
        outputVar: 'metrics_summary',
        label: 'Analyse metrics',
        prompt: 'Analyse the latest weekly metrics and produce an executive summary with highlights, risks, and unusual changes.',
      },
      {
        id: 'ledger_report',
        agentId: 'ledger',
        outputVar: 'report_narrative',
        label: 'Write report',
        prompt: 'Turn the metrics summary into a client-ready plain-English weekly report.',
      },
      {
        id: 'herald_delivery',
        agentId: 'herald',
        outputVar: 'delivery_email',
        label: 'Format delivery',
        prompt: 'Format the weekly report as a polished stakeholder email with a clear subject line and CTA.',
      },
    ],
    edges: [
      { from: 'cipher_metrics', to: 'ledger_report' },
      { from: 'ledger_report', to: 'herald_delivery' },
    ],
  },
  {
    name: 'Content Signal to Campaign',
    description: 'SCOUT finds the opening, ORACLE refines the search angle, FORGE writes, and ECHO repurposes.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      {
        id: 'scout_research',
        agentId: 'scout',
        outputVar: 'market_signal',
        label: 'Research market signal',
        prompt: 'Identify one strong content opportunity in our niche and explain why it matters now.',
      },
      {
        id: 'oracle_brief',
        agentId: 'oracle',
        outputVar: 'seo_brief',
        label: 'Shape search brief',
        prompt: 'Build a concise SEO brief from the market signal with target keyword, intent, and key sections.',
      },
      {
        id: 'forge_article',
        agentId: 'forge',
        outputVar: 'article_draft',
        label: 'Draft article',
        prompt: 'Write a premium first draft based on the SEO brief in a sharp B2B SaaS tone.',
      },
      {
        id: 'echo_social',
        agentId: 'echo',
        outputVar: 'social_assets',
        label: 'Repurpose campaign',
        prompt: 'Repurpose the article into platform-native social assets with distinct hooks.',
      },
    ],
    edges: [
      { from: 'scout_research', to: 'oracle_brief' },
      { from: 'oracle_brief', to: 'forge_article' },
      { from: 'forge_article', to: 'echo_social' },
    ],
  },
  {
    name: 'Lead Intake and Follow-Up',
    description: 'VANCE scores the lead, SAGE pressure-tests the opportunity, and HERALD drafts the outreach.',
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      {
        id: 'vance_score',
        agentId: 'vance',
        outputVar: 'lead_score',
        label: 'Score opportunity',
        prompt: 'Score the incoming lead against our ICP and summarise the strongest buying signals.',
      },
      {
        id: 'sage_risk',
        agentId: 'sage',
        outputVar: 'deal_risk',
        label: 'Assess strategy',
        prompt: 'Review the scored opportunity and highlight strategic upside, risk, and deal posture.',
      },
      {
        id: 'herald_followup',
        agentId: 'herald',
        outputVar: 'outreach_email',
        label: 'Draft response',
        prompt: 'Draft a follow-up email that advances the conversation with confidence and clarity.',
      },
    ],
    edges: [
      { from: 'vance_score', to: 'sage_risk' },
      { from: 'sage_risk', to: 'herald_followup' },
    ],
  },
];

export const POWERUP_LIBRARY = [
  { agentId: 'forge', slug: 'ab-headlines', name: '5 A/B Headlines', description: 'Generate five headline variants with distinct angles for any topic or campaign.', prompt: 'Generate 5 A/B test headline variants for: {{topic}}. Give each one a distinct angle.' },
  { agentId: 'forge', slug: 'product-desc', name: 'Product Description', description: 'Write a compelling, conversion-focused product description in any tone.', prompt: 'Write a compelling product description for {{product}} in a {{tone|sharp}} tone.' },
  { agentId: 'herald', slug: 'cold-email', name: 'Cold Outreach Email', description: 'Draft a personalised cold email to a specific prospect with a clear goal.', prompt: 'Write a cold outreach email to {{prospect}} at {{company}}. Goal: {{goal}}.' },
  { agentId: 'echo', slug: 'linkedin-post', name: 'LinkedIn Post', description: 'Create a hook-first LinkedIn post from any topic, insight, or update.', prompt: 'Write a LinkedIn post about {{topic}} with a strong hook.' },
  { agentId: 'cipher', slug: 'data-summary', name: 'Data Summary Report', description: 'Analyse any data block and produce an executive summary with key findings.', prompt: 'Analyse this data and provide a concise executive summary.\n\n{{data}}' },
  { agentId: 'oracle', slug: 'content-brief', name: 'SEO Content Brief', description: 'Generate a complete content brief for any target keyword.', prompt: 'Create an SEO content brief for the keyword "{{keyword}}".' },
  { agentId: 'wren', slug: 'faq-builder', name: 'Generate FAQ', description: 'Build a 10-question FAQ for any product or service using the knowledge base.', prompt: 'Generate 10 FAQs for {{product_or_service}} using the knowledge base.' },
  { agentId: 'vance', slug: 'proposal', name: 'Project Proposal', description: 'Draft a scoped proposal outline for a new client project.', prompt: 'Draft a project proposal for {{client}} based on this project description:\n\n{{projectDescription}}' },
  { agentId: 'ledger', slug: 'investor-update', name: 'Investor Update', description: 'Write a structured investor update from a period summary and key metrics.', prompt: 'Write an investor update for {{period}} using these metrics: {{metrics}}' },
  { agentId: 'scout', slug: 'competitor-snapshot', name: 'Competitor Snapshot', description: 'Produce a positioning, pricing, and gap analysis for any competitor.', prompt: 'Analyse {{competitor}} and outline positioning, pricing, strengths, and weaknesses.' },
  { agentId: 'sage', slug: 'swot', name: 'SWOT Analysis', description: 'Run a full SWOT analysis for your business from context you provide.', prompt: 'Run a SWOT analysis for {{business}} using this context:\n\n{{context}}' },
];

export const LORE_STATUS_META = {
  pending: { label: 'Queued', color: '#f59e0b' },
  indexing: { label: 'Indexing', color: '#36b9ff' },
  indexed: { label: 'Ready', color: '#18c7a0' },
  failed: { label: 'Failed', color: '#ef4444' },
};

export function getAgentMeta(agentId) {
  return AGENT_LIBRARY.find((entry) => entry.id === agentId) ?? null;
}

export function findAgentByInvocation(input) {
  const normalized = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ');

  if (!normalized) {
    return null;
  }

  return (
    AGENT_LIBRARY.find((agent) => normalized.includes(agent.name.toLowerCase())) ??
    AGENT_LIBRARY.find((agent) => normalized.includes(agent.title.toLowerCase().split(' ')[0])) ??
    null
  );
}

export function getAgentsForIntegration(serviceId) {
  return (INTEGRATION_LIBRARY[serviceId]?.agentIds ?? [])
    .map((agentId) => getAgentMeta(agentId))
    .filter(Boolean);
}

export function mergeAgentState(runtimeAgents = []) {
  if (runtimeAgents.length === 0) {
    return AGENT_LIBRARY.map((agent) => ({ ...agent, locked: false }));
  }

  return runtimeAgents.map((agent) => ({
    ...getAgentMeta(agent.id),
    ...agent,
  }));
}

export function getWorkspacePlanMeta(planId = 'free') {
  return INTERNAL_PLAN_META[planId] ?? INTERNAL_PLAN_META.free;
}

export function getRecommendedAgentIdsForWorkspaceProfile(profile = {}) {
  const workspaceFocus = String(profile.workspaceFocus ?? '').trim().toLowerCase();
  const primaryGoal = String(profile.primaryGoal ?? '').trim().toLowerCase();

  if (primaryGoal.includes('lead') || primaryGoal.includes('proposal') || primaryGoal.includes('sales')) {
    return ['herald', 'vance', 'atlas'];
  }

  if (primaryGoal.includes('content')) {
    return ['forge', 'echo', 'herald'];
  }

  if (primaryGoal.includes('report') || primaryGoal.includes('data')) {
    return ['cipher', 'ledger', 'atlas'];
  }

  if (primaryGoal.includes('support')) {
    return ['wren', 'herald', 'ledger'];
  }

  if (primaryGoal.includes('knowledge')) {
    return ['lore', 'oracle', 'atlas'];
  }

  if (workspaceFocus === 'agency') {
    return ['herald', 'forge', 'atlas'];
  }

  if (workspaceFocus === 'service_business') {
    return ['wren', 'herald', 'ledger'];
  }

  if (workspaceFocus === 'owner_led') {
    return ['oracle', 'cipher', 'herald'];
  }

  return FEATURED_AGENT_IDS.slice(0, 3);
}

export function getRecommendedAgentsForWorkspaceProfile(profile = {}) {
  return getRecommendedAgentIdsForWorkspaceProfile(profile)
    .map((agentId) => getAgentMeta(agentId))
    .filter(Boolean);
}

export function getPlanPrice(plan, intervalId = 'monthly') {
  const interval = BILLING_INTERVALS.find((entry) => entry.id === intervalId) ?? BILLING_INTERVALS[0];
  const monthlyPrice = plan?.monthlyPrice ?? 0;
  const rawPrice = monthlyPrice * interval.multiplier;
  const discountedPrice =
    interval.id === 'quarterly'
      ? rawPrice * 0.88
      : interval.id === 'yearly'
        ? rawPrice * 0.76
        : rawPrice;
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
  const monthlyEquivalentAmount = discountedPrice / interval.multiplier;

  return {
    amount: discountedPrice,
    display: formatter.format(discountedPrice),
    suffix: interval.periodLabel,
    monthlyEquivalentAmount,
    monthlyEquivalent: `${formatter.format(monthlyEquivalentAmount)}/mo`,
    discountLabel: interval.discountLabel,
    interval,
  };
}
