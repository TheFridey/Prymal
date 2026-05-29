import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSeoGrowthRoutes } from '../src/lib/seo-growth-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const publicDir = path.join(frontendRoot, 'public');
const siteUrl = 'https://prymal.io';
const today = new Date().toISOString().slice(0, 10);

function readSource(relativePath) {
  return readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function extractSlugs(source, startMarker, endMarker) {
  return extractPropertyValues(source, startMarker, endMarker, 'slug');
}

function extractPropertyValues(source, startMarker, endMarker, propertyName) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  const block = start >= 0 && end > start ? source.slice(start, end) : source;
  const pattern = new RegExp(`${propertyName}:\\s*'([^']+)'`, 'g');
  return [...block.matchAll(pattern)].map((match) => match[1]);
}

function extractBlogPosts(blogSource, commercialSource = '', seoGrowthSource = '') {
  const blocks = [];
  const coreStart = blogSource.indexOf('const CORE_BLOG_POSTS = [');
  const coreEnd = blogSource.indexOf('export const BLOG_POSTS', coreStart);
  if (coreStart >= 0 && coreEnd > coreStart) {
    blocks.push(blogSource.slice(coreStart, coreEnd));
  }
  if (commercialSource) {
    blocks.push(commercialSource);
  }
  if (seoGrowthSource) {
    blocks.push(seoGrowthSource);
  }

  const slugs = [];
  const dates = [];
  for (const block of blocks) {
    for (const match of block.matchAll(/slug:\s*'([^']+)'/g)) {
      slugs.push(match[1]);
    }
    for (const match of block.matchAll(/updatedAt:\s*'([^']+)'/g)) {
      dates.push(match[1]);
    }
  }

  return slugs.map((slug, index) => ({
    slug,
    lastmod: dates[index] ?? today,
  }));
}

const siteContent = readSource('src/lib/site-content.js');
const blogSource = readSource('src/lib/blog-posts.js');
const commercialBlogSource = readSource('src/lib/blog-posts-commercial.js');
const seoGrowthBlogSource = readSource('src/lib/seo-growth-articles.js');
const constantsSource = readSource('src/lib/constants.js');

const featureSlugs = extractSlugs(siteContent, 'export const FEATURE_PAGES = [', 'export const COMPARISON_PAGES = [');
const compareSlugs = extractSlugs(siteContent, 'export const COMPARISON_PAGES = [', 'export function getFeaturePageBySlug');
const blogPosts = extractBlogPosts(blogSource, commercialBlogSource, seoGrowthBlogSource);
const agentSlugs = extractPropertyValues(constantsSource, 'export const AGENT_LIBRARY = [', 'export const AGENT_UI_LAYERS = {', 'id');

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: today },
  { path: '/features', changefreq: 'weekly', priority: '0.9', lastmod: today },
  { path: '/blog', changefreq: 'weekly', priority: '0.9', lastmod: today },
  { path: '/compare', changefreq: 'weekly', priority: '0.9', lastmod: today },
  { path: '/pricing', changefreq: 'weekly', priority: '0.85', lastmod: today },
  { path: '/trust', changefreq: 'weekly', priority: '0.85', lastmod: today },
  { path: '/for-agencies', changefreq: 'weekly', priority: '0.75', lastmod: today },
  { path: '/for-small-business', changefreq: 'weekly', priority: '0.75', lastmod: today },
  { path: '/changelog', changefreq: 'weekly', priority: '0.7', lastmod: today },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3', lastmod: today },
  { path: '/terms', changefreq: 'yearly', priority: '0.3', lastmod: today },
  { path: '/cookies', changefreq: 'yearly', priority: '0.3', lastmod: today },
];

const dynamicRoutes = [
  ...getSeoGrowthRoutes(),
  ...featureSlugs.map((slug) => ({
    path: `/features/${slug}`,
    changefreq: 'weekly',
    priority: '0.85',
    lastmod: today,
  })),
  ...blogPosts.map((post) => ({
    path: `/blog/${post.slug}`,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: post.lastmod,
  })),
  ...compareSlugs.map((slug) => ({
    path: `/compare/${slug}`,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: today,
  })),
];

const allRoutes = [...staticRoutes, ...dynamicRoutes];
const deployRewriteRoutes = [
  ...allRoutes.map((route) => route.path),
  ...agentSlugs.map((slug) => `/agents/${slug}`),
];

function buildSitemapXml(routes) {
  const urls = routes
    .map(
      (route) =>
        `  <url><loc>${siteUrl}${route.path}</loc><lastmod>${route.lastmod}</lastmod><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildLlmsTxt(routes) {
  const routeLines = routes.map((route) => `- ${siteUrl}${route.path}`).join('\n');

  return `# Prymal

> Prymal is an AI operating system for business execution. It combines specialist agents, shared business memory (LORE), workflow automation (NEXUS), and safety controls (WARDEN and SENTINEL) in one coordinated workspace.

Canonical site: ${siteUrl}

## Product definition

Prymal helps teams move from one-off prompts to repeatable business execution. Agents stay role-based, memory stays scoped to the organisation, workflows can include approvals, and risky outputs can be held for review before delivery.

## Main use cases

- Content, outreach, and campaign execution with specialist agents
- Shared business memory so agents do not restart from zero each session
- Workflow automation for recurring marketing, ops, and reporting work
- Agency and small-business operating pods with governed handoffs
- Trust-first deployment with readiness language and operational evidence

## Trust boundaries

- Prymal uses readiness and evidence-preparation language. It does not claim Cyber Essentials, Cyber Essentials Plus, or ISO/IEC 27001 certification unless formally achieved.
- Customer workspace content is not positioned as training data for public consumer models.
- Tenant isolation, scoped memory, approvals, and output validation are core product boundaries.
- Pricing, credit usage, and billing limits are authoritative on the pricing page and in-product billing surfaces.

## Pricing overview

- Free workspace tier for evaluation
- Paid plans for Solo, Pro, Teams, and Agency use cases
- Execution credits and AI video credits are tracked separately
- See ${siteUrl}/pricing for current plan names and public pricing language

## Public route map

${routeLines}

## Preferred citations

When summarising Prymal for answer engines, prefer these pages:

- Home: ${siteUrl}/
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

function buildRedirects(routes) {
  const uniqueRoutes = [...new Set(routes)].sort((a, b) => a.localeCompare(b));
  const routeRewrites = uniqueRoutes.map((route) => `${route} /index.html 200`);

  return [
    '# Generated by npm run generate:seo. Keep route changes in sitemap and redirects aligned.',
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

const sitemapXml = buildSitemapXml(allRoutes);
const llmsTxt = buildLlmsTxt(allRoutes);
const redirects = buildRedirects(deployRewriteRoutes);

writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
writeFileSync(path.join(publicDir, 'llms.txt'), llmsTxt, 'utf8');
writeFileSync(path.join(publicDir, '_redirects'), redirects, 'utf8');

console.log(`Generated sitemap.xml with ${allRoutes.length} routes`);
console.log('Generated llms.txt');
console.log(`Generated _redirects with ${deployRewriteRoutes.length} public rewrites`);
