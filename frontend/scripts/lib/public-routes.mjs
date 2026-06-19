// Single source of truth for the public route map.
//
// Both the SEO asset generator (sitemap.xml / llms.txt / _redirects) and the
// static prerender step import from here so the three stay in lockstep.
//
// The content data modules (site-content.js, blog-posts*.js, constants.js)
// import image assets and therefore cannot be imported directly in a plain
// Node script. We extract the values we need from their source text instead.
// seo-growth-content.js has no asset imports and is imported normally.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGeneratedBlogRoutes } from '../../src/content/blog/index.js';
import { getGeneratedComparisonRoutes } from '../../src/content/comparisons/index.js';
import { getEducationRoutes } from '../../src/content/education/index.js';
import { getEntityRoutes } from '../../src/content/entities/index.js';
import { getIndustryRoutes } from '../../src/content/industries/index.js';
import { getUseCaseRoutes } from '../../src/content/use-cases/index.js';
import { getSeoGrowthRoutes } from '../../src/lib/seo-growth-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..', '..');

export const SITE_URL = 'https://prymal.io';
export const TODAY = new Date().toISOString().slice(0, 10);

function readSource(relativePath) {
  return readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function sliceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return source;
  const end = endMarker ? source.indexOf(endMarker, start) : -1;
  return end > start ? source.slice(start, end) : source.slice(start);
}

function matchAllValues(block, propertyName) {
  const pattern = new RegExp(`${propertyName}:\\s*'([^']+)'`, 'g');
  return [...block.matchAll(pattern)].map((match) => match[1]);
}

// Extract slug + nearest updatedAt for each item in a content block. We zip
// slugs and updatedAt by index; when an item omits updatedAt the parallel
// arrays misalign, so we fall back to TODAY for every item in that block to
// avoid attributing the wrong date to the wrong page.
function extractItemsWithDates(block, dateField = 'updatedAt') {
  const slugs = matchAllValues(block, 'slug');
  const dates = matchAllValues(block, dateField);
  const aligned = dates.length === slugs.length;
  return slugs.map((slug, index) => ({
    slug,
    lastmod: aligned ? dates[index] : TODAY,
  }));
}

function extractBlogPosts(blogSource, commercialSource, seoGrowthSource) {
  const blocks = [];
  const coreBlock = sliceBlock(blogSource, 'const CORE_BLOG_POSTS = [', 'export const BLOG_POSTS');
  if (coreBlock) blocks.push(coreBlock);
  if (commercialSource) blocks.push(commercialSource);
  if (seoGrowthSource) blocks.push(seoGrowthSource);

  const posts = [];
  for (const block of blocks) {
    const slugs = matchAllValues(block, 'slug');
    const updated = matchAllValues(block, 'updatedAt');
    const published = matchAllValues(block, 'publishedAt');
    const aligned = updated.length === slugs.length;
    const publishedAligned = published.length === slugs.length;
    slugs.forEach((slug, index) => {
      posts.push({
        slug,
        lastmod:
          (aligned && updated[index])
          || (publishedAligned && published[index])
          || TODAY,
      });
    });
  }
  return posts;
}

let cached = null;

export function getPublicRoutes() {
  if (cached) return cached;

  const siteContent = readSource('src/lib/site-content.js');
  const blogSource = readSource('src/lib/blog-posts.js');
  const commercialBlogSource = readSource('src/lib/blog-posts-commercial.js');
  const seoGrowthBlogSource = readSource('src/lib/seo-growth-articles.js');
  const constantsSource = readSource('src/lib/constants.js');

  const featureBlock = sliceBlock(siteContent, 'export const FEATURE_PAGES = [', 'export const COMPARISON_PAGES = [');
  const compareBlock = sliceBlock(siteContent, 'export const COMPARISON_PAGES = [', 'export function getFeaturePageBySlug');
  const agentBlock = sliceBlock(constantsSource, 'export const AGENT_LIBRARY = [', 'export const AGENT_UI_LAYERS = {');

  const features = extractItemsWithDates(featureBlock);
  const comparisons = extractItemsWithDates(compareBlock);
  const blogPosts = extractBlogPosts(blogSource, commercialBlogSource, seoGrowthBlogSource);
  const agentSlugs = matchAllValues(agentBlock, 'id');

  const staticRoutes = [
    { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: TODAY },
    { path: '/features', changefreq: 'weekly', priority: '0.9', lastmod: TODAY },
    { path: '/blog', changefreq: 'weekly', priority: '0.9', lastmod: TODAY },
    { path: '/compare', changefreq: 'weekly', priority: '0.9', lastmod: TODAY },
    { path: '/what-is', changefreq: 'weekly', priority: '0.86', lastmod: TODAY },
    { path: '/content/blog', changefreq: 'weekly', priority: '0.86', lastmod: TODAY },
    { path: '/content/entities', changefreq: 'weekly', priority: '0.84', lastmod: TODAY },
    { path: '/content/industries', changefreq: 'weekly', priority: '0.84', lastmod: TODAY },
    { path: '/pricing', changefreq: 'weekly', priority: '0.85', lastmod: TODAY },
    { path: '/trust', changefreq: 'weekly', priority: '0.85', lastmod: TODAY },
    { path: '/for-agencies', changefreq: 'weekly', priority: '0.75', lastmod: TODAY },
    { path: '/for-small-business', changefreq: 'weekly', priority: '0.75', lastmod: TODAY },
    { path: '/changelog', changefreq: 'weekly', priority: '0.7', lastmod: TODAY },
    { path: '/privacy', changefreq: 'yearly', priority: '0.3', lastmod: TODAY },
    { path: '/terms', changefreq: 'yearly', priority: '0.3', lastmod: TODAY },
    { path: '/cookies', changefreq: 'yearly', priority: '0.3', lastmod: TODAY },
  ];

  const dynamicRoutes = [
    ...getSeoGrowthRoutes(),
    ...getUseCaseRoutes(),
    ...getGeneratedComparisonRoutes(),
    ...getEducationRoutes().filter((route) => route.path !== '/what-is'),
    ...getGeneratedBlogRoutes().filter((route) => route.path !== '/content/blog'),
    ...getEntityRoutes().filter((route) => route.path !== '/content/entities'),
    ...getIndustryRoutes().filter((route) => route.path !== '/content/industries'),
    ...features.map((feature) => ({
      path: `/features/${feature.slug}`,
      changefreq: 'weekly',
      priority: '0.85',
      lastmod: feature.lastmod,
    })),
    ...blogPosts.map((post) => ({
      path: `/blog/${post.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
      lastmod: post.lastmod,
    })),
    ...comparisons.map((comparison) => ({
      path: `/compare/${comparison.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
      lastmod: comparison.lastmod,
    })),
  ];

  const agentNames = matchAllValues(agentBlock, 'name');
  const agentTitles = matchAllValues(agentBlock, 'title');
  const rosterAligned = agentNames.length === agentSlugs.length && agentTitles.length === agentSlugs.length;
  const agentRoster = agentSlugs.map((slug, index) => ({
    id: slug,
    name: rosterAligned ? agentNames[index] : slug.toUpperCase(),
    title: rosterAligned ? agentTitles[index] : '',
  }));

  const agentRoutes = agentSlugs.map((slug) => ({
    path: `/agents/${slug}`,
    changefreq: 'monthly',
    priority: '0.7',
    lastmod: TODAY,
  }));

  // Sitemap + prerender both cover every public, indexable route including agents.
  const allRoutes = [...staticRoutes, ...dynamicRoutes, ...agentRoutes];

  cached = {
    siteUrl: SITE_URL,
    today: TODAY,
    staticRoutes,
    dynamicRoutes,
    agentRoutes,
    agentSlugs,
    agentRoster,
    allRoutes,
    // Paths used for SPA fallback rewrites and as the prerender target set.
    publicPaths: allRoutes.map((route) => route.path),
  };
  return cached;
}
