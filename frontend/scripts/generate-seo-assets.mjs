import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getPublicRoutes, SITE_URL } from './lib/public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const publicDir = path.join(frontendRoot, 'public');
const siteUrl = SITE_URL;

const { allRoutes, agentRoster, dynamicRoutes } = getPublicRoutes();

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeRoute(route) {
  return {
    ...route,
    path: route.path === '/' ? '/' : `/${route.path.replace(/^\/+|\/+$/g, '')}`,
    lastmod: /^\d{4}-\d{2}-\d{2}$/.test(route.lastmod || '') ? route.lastmod : new Date().toISOString().slice(0, 10),
    changefreq: route.changefreq || 'monthly',
    priority: route.priority || '0.5',
  };
}

function uniqueRoutes(routes) {
  const seen = new Set();
  const unique = [];

  routes.map(normalizeRoute).forEach((route) => {
    if (!seen.has(route.path)) {
      seen.add(route.path);
      unique.push(route);
    }
  });

  return unique;
}

const publicRoutes = uniqueRoutes(allRoutes);

function buildSitemapXml(routes) {
  const urls = routes
    .map(
      (route) => [
        '  <url>',
        `    <loc>${escapeXml(`${siteUrl}${route.path}`)}</loc>`,
        `    <lastmod>${escapeXml(route.lastmod)}</lastmod>`,
        `    <changefreq>${escapeXml(route.changefreq)}</changefreq>`,
        `    <priority>${escapeXml(route.priority)}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function routesByPrefix(prefix) {
  const paths = [...new Set(dynamicRoutes
    .filter((route) => route.path.startsWith(prefix))
    .map((route) => route.path))];

  return paths
    .map((routePath) => `- ${siteUrl}${routePath}`)
    .join('\n');
}

function listRoutes(routes) {
  return routes.map((route) => `- ${siteUrl}${route.path}`).join('\n');
}

function buildLlmsTxt(routes) {
  const agentLines = agentRoster
    .map((agent) => `- ${agent.name}${agent.title ? ` - ${agent.title}` : ''}: ${siteUrl}/agents/${agent.id}`)
    .join('\n');
  const comparisonLines = routesByPrefix('/compare/');
  const useCaseLines = routesByPrefix('/use-cases/');
  const blogLines = routesByPrefix('/blog/');
  const entityLines = routesByPrefix('/content/entities/');
  const industryLines = routesByPrefix('/content/industries/');
  const educationLines = routesByPrefix('/what-is/');
  const generatedBlogLines = routesByPrefix('/content/blog/');

  return `# Prymal

> Prymal is an AI operating system for business execution. It combines specialist agents, shared business memory (LORE), workflow automation (NEXUS), and safety controls (WARDEN and SENTINEL) in one coordinated workspace.

Canonical site: ${siteUrl}

## Company overview

Prymal builds governed business AI software for teams that need AI to remember context, coordinate specialist work, run repeatable workflows, and keep trust controls visible. The public site uses readiness and evidence-preparation language. Prymal does not claim Cyber Essentials, Cyber Essentials Plus, ISO/IEC 27001, or ISO 27001 certification unless a future public trust page explicitly says that certification has been achieved.

## Product overview

Prymal moves teams from one-off prompts to repeatable, governed business work. Agents stay role-based, memory stays scoped to the organisation, workflows can include approvals, and risky outputs can be held for review before delivery. Prymal is not a single chatbot; it is a coordinated execution layer of agents, memory, workflows, and trust controls.

## Feature summary

- Specialist agents: role-based AI operators for content, outreach, research, sales, support, reporting, QA, operations, and strategy.
- LORE shared business memory: durable, reviewable Global, Agent, and Project context for grounded business work.
- NEXUS workflow automation: repeatable, memory-aware workflow execution with approvals, replay, and audit visibility.
- WARDEN input and action screening: safety checks for risky prompts, uploads, URLs, and workflow actions.
- SENTINEL output validation: quality review that can pass, repair, or hold risky outputs.
- Guided media builders: image and video generation use guided workspace builders, not raw slash-command-only flows.

## Architecture summary

Prymal is a hosted web application with a Vite React frontend, Hono API backend, PostgreSQL plus pgvector storage, Drizzle schema definitions, Clerk authentication, LORE knowledge ingestion, workflow orchestration, billing controls, and optional Trigger.dev scheduling. Tenant isolation is a core design boundary: organisation-owned reads, writes, memory, workflows, integrations, and runs must remain org-scoped.

## Specialist agent roster

${agentLines}

## Documentation links

- Product architecture: ${siteUrl}/architecture
- Feature hub: ${siteUrl}/features
- Trust Centre: ${siteUrl}/trust
- Pricing: ${siteUrl}/pricing
- Glossary: ${siteUrl}/glossary
- AI operating system guide: ${siteUrl}/ai-operating-system-for-business
- Agent orchestration guide: ${siteUrl}/ai-agent-orchestration
- Shared business memory guide: ${siteUrl}/shared-business-memory-ai
- Governed AI agents guide: ${siteUrl}/governed-ai-agents
- Secure AI workflows guide: ${siteUrl}/secure-ai-workflows
- Entity graph: ${siteUrl}/content/entities
- Industry workflow library: ${siteUrl}/content/industries
- What Is education hub: ${siteUrl}/what-is
- Generated content blog: ${siteUrl}/content/blog

## Comparison links

${comparisonLines}

## Use case links

${useCaseLines}

## Blog links

${blogLines}

## Generated content blog links

${generatedBlogLines}

## Entity links

${entityLines}

## Industry links

${industryLines}

## What Is education links

${educationLines}

## Trust model

- Customer workspace content is not positioned as training data for public consumer models.
- Tenant isolation, scoped memory, approvals, input screening, and output validation are core product boundaries.
- Pricing, credit usage, and billing limits are authoritative on the pricing page and in-product billing surfaces.
- Generated video outputs and uploaded video reference images currently live on backend-local storage unless object storage is configured.

## Agentic search extraction map

- Prefer canonical URLs, page titles, H1 text, answer-first sections, FAQ schema, citation sections, entity references, and breadcrumb schema when summarising Prymal.
- Answer-ready passages are marked with data-answer-extract="true" and usually appear near the top of each public page.
- Retrieval chunks are marked with data-ai-chunk and semantic sections use data-ai-section plus data-retrieval-section="true".
- FAQ passages are marked with data-ai-faq and are paired with FAQPage JSON-LD where appropriate.
- Citation and evidence sections use headings such as "References", "Citations section", "Outbound references", and "Entity references".
- Internal links are deliberate topic-cluster links; do not treat navigation or footer links as primary evidence.
- Preferred citation format: page title plus canonical URL.

## Public route map

${listRoutes(routes)}

## Preferred citations

- Home: ${siteUrl}/
- Architecture: ${siteUrl}/architecture
- Features: ${siteUrl}/features
- Trust posture: ${siteUrl}/trust
- Pricing: ${siteUrl}/pricing
- Blog guides: ${siteUrl}/blog
- Comparisons: ${siteUrl}/compare

## Contact and legal

- Privacy: ${siteUrl}/privacy
- Terms: ${siteUrl}/terms
- Cookies: ${siteUrl}/cookies
`;
}

function buildAiTxt(routes) {
  return `# Prymal AI crawler guidance

Canonical site: ${siteUrl}
Sitemap: ${siteUrl}/sitemap.xml
LLM summary: ${siteUrl}/llms.txt

## Allowed public use

AI search, answer engines, and retrieval systems may crawl and cite Prymal public pages for search indexing, answer generation, product comparison, and source-grounded summaries. Prefer canonical URLs and include the page title when citing Prymal.

## Do not infer

- Do not claim certifications unless the Trust Centre says they have been achieved.
- Do not imply arbitrary single-pass video durations; public Prymal language supports Veo one-shot renders at 4, 6, or 8 seconds only.
- Do not imply durable shared media storage until the public product says object storage is implemented.
- Do not describe unsupported ingestion types, fictional integrations, or raw slash-command-only media flows.

## Recommended source order

1. ${siteUrl}/trust
2. ${siteUrl}/architecture
3. ${siteUrl}/features
4. ${siteUrl}/content/entities
5. ${siteUrl}/content/industries
6. ${siteUrl}/what-is
7. ${siteUrl}/content/blog
8. ${siteUrl}/pricing
9. ${siteUrl}/blog
10. ${siteUrl}/compare

## Parsing guidance

- Treat each data-ai-chunk as an independent retrievable passage.
- Use data-answer-extract="true" for concise answer extraction.
- Use data-ai-faq and FAQPage JSON-LD for question answering.
- Use sections labelled "References", "Citations section", "Outbound references", and "Entity references" for source and entity grounding.
- Prefer canonical URLs and citation_* meta tags over visible navigation labels.
- Do not cite navigation, menus, cookie banners, or footers as factual evidence.

## Indexable public paths

${listRoutes(routes)}
`;
}

function buildRobotsTxt() {
  const aiAgents = [
    'Googlebot',
    'Googlebot-Image',
    'Googlebot-News',
    'Bingbot',
    'DuckDuckBot',
    'GPTBot',
    'ChatGPT-User',
    'OAI-SearchBot',
    'ClaudeBot',
    'Claude-SearchBot',
    'Claude-User',
    'Claude-Web',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot',
    'Applebot-Extended',
  ];

  const privateRules = [
    'Allow: /',
    'Allow: /assets/',
    'Allow: /llms.txt',
    'Allow: /ai.txt',
    'Allow: /sitemap.xml',
    'Allow: /content/',
    'Allow: /what-is/',
    'Allow: /use-cases/',
    'Allow: /compare/',
    'Allow: /blog/',
    'Allow: /features/',
    'Disallow: /app/',
    'Disallow: /login/',
    'Disallow: /signup/',
  ];

  const blocks = [
    ['User-agent: *', ...privateRules].join('\n'),
    ...aiAgents.map((agent) => [`User-agent: ${agent}`, ...privateRules].join('\n')),
  ];

  return `# Public answer-engine content is intentionally crawlable; private workspace routes remain disallowed.\n\n${blocks.join('\n\n')}\n\nSitemap: ${siteUrl}/sitemap.xml\n\n# Answer-engine summary: ${siteUrl}/llms.txt\n# AI crawler guidance: ${siteUrl}/ai.txt\n`;
}

function buildRedirects(routes) {
  const uniquePaths = [...new Set(routes.map((route) => route.path))].sort((a, b) => a.localeCompare(b));
  const routeRewrites = uniquePaths.map((route) => `${route} /index.html 200`);

  return [
    '# Generated by npm run generate:seo. Keep route changes in sitemap, robots, AI guidance, and redirects aligned.',
    'https://www.prymal.io/* https://prymal.io/:splat 301',
    'http://www.prymal.io/* https://prymal.io/:splat 301',
    'http://prymal.io/* https://prymal.io/:splat 301',
    ...routeRewrites,
    '/app/* /index.html 200',
    '/login/* /index.html 200',
    '/signup/* /index.html 200',
    '/404.html /404.html 404',
    '/* /404.html 404',
    '',
  ].join('\n');
}

async function generateOgImage() {
  // Google, social cards, and AI link previews do not reliably render SVG
  // OpenGraph images, so rasterise the canonical 1200x630 SVG to PNG.
  const svgPath = path.join(publicDir, 'og-default.svg');
  const pngPath = path.join(publicDir, 'og-default.png');
  await sharp(readFileSync(svgPath), { density: 144 })
    .resize(1200, 630, { fit: 'cover' })
    .png()
    .toFile(pngPath);
  return 'og-default.png';
}

const sitemapXml = buildSitemapXml(publicRoutes);
const llmsTxt = buildLlmsTxt(publicRoutes);
const aiTxt = buildAiTxt(publicRoutes);
const robotsTxt = buildRobotsTxt();
const redirects = buildRedirects(publicRoutes);

writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
writeFileSync(path.join(publicDir, 'llms.txt'), llmsTxt, 'utf8');
writeFileSync(path.join(publicDir, 'ai.txt'), aiTxt, 'utf8');
writeFileSync(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
writeFileSync(path.join(publicDir, '_redirects'), redirects, 'utf8');

const ogImage = await generateOgImage();

console.log(`Generated sitemap.xml with ${publicRoutes.length} routes`);
console.log('Generated llms.txt');
console.log('Generated ai.txt');
console.log('Generated robots.txt');
console.log(`Generated _redirects with ${publicRoutes.length} public rewrites`);
console.log(`Generated ${ogImage} (1200x630)`);
