export const SITE_URL = 'https://prymal.io';
export const SITE_NAME = 'Prymal';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
export const DEFAULT_OG_IMAGE_ALT = 'Prymal - AI operating system for business execution';
export const TWITTER_SITE = '@prymalio';

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

/**
 * @typedef {{ question: string, answer: string }} FaqItem
 * @typedef {{ name: string, path: string }} BreadcrumbItem
 * @typedef {{ name: string, url?: string, jobTitle?: string, affiliation?: string }} AuthorInput
 * @typedef {{ path: string, changefreq: string, priority: string, lastmod?: string, kind?: string, slug?: string }} PublicRoute
 * @typedef {Record<string, unknown> & { '@context'?: string, '@type'?: string|string[], '@id'?: string }} JsonLdSchema
 */

function normalizeSiteUrl(siteUrl = SITE_URL) {
  return String(siteUrl || SITE_URL).replace(/\/$/, '');
}

export function normalizePath(path = '/') {
  if (!path || path === '/') return '/';
  return `/${String(path).replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

export function resolveAbsoluteUrl(value, siteUrl = SITE_URL) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${normalizeSiteUrl(siteUrl)}${path}`;
}

export function urlForPath(path = '/', siteUrl = SITE_URL) {
  return `${normalizeSiteUrl(siteUrl)}${normalizePath(path)}`;
}

export function resolveOgImage(value, siteUrl = SITE_URL) {
  return resolveAbsoluteUrl(value ?? DEFAULT_OG_IMAGE, siteUrl);
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactObject(item))
      .filter((item) => item !== undefined && item !== null && item !== '');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, item]) => {
      const next = compactObject(item);
      if (next !== undefined && next !== null && next !== '') {
        result[key] = next;
      }
      return result;
    }, {});
  }

  return value;
}

function typeList(schema) {
  const type = schema?.['@type'];
  return Array.isArray(type) ? type : type ? [type] : [];
}

function stableSchemaKey(schema) {
  const type = typeList(schema).join('+') || 'Thing';
  return (
    schema?.['@id']
    || schema?.url
    || schema?.mainEntityOfPage?.['@id']
    || `${type}:${schema?.name || schema?.headline || ''}`
  );
}

function requireField(schema, field, schemaType) {
  if (!schema?.[field]) {
    throw new Error(`Invalid ${schemaType} schema: missing ${field}`);
  }
}

export function validateSchemaOutput(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('JSON-LD schema must be an object');
  }

  if (schema['@graph']) {
    const seen = new Set();
    schema['@graph'].forEach((entry) => {
      validateSchemaOutput(entry);
      const key = stableSchemaKey(entry);
      if (seen.has(key)) {
        throw new Error(`Duplicate JSON-LD schema in graph: ${key}`);
      }
      seen.add(key);
    });
    return schema;
  }

  requireField(schema, '@context', 'JSON-LD');
  requireField(schema, '@type', 'JSON-LD');

  const types = typeList(schema);
  if (types.includes('Organization')) requireField(schema, 'name', 'Organization');
  if (types.includes('SoftwareApplication')) requireField(schema, 'name', 'SoftwareApplication');
  if (types.includes('WebSite')) requireField(schema, 'url', 'WebSite');
  if (types.includes('WebPage') || types.includes('CollectionPage') || types.includes('Blog')) {
    requireField(schema, 'name', types[0]);
    requireField(schema, 'url', types[0]);
  }
  if (types.includes('FAQPage')) {
    if (!Array.isArray(schema.mainEntity) || schema.mainEntity.length === 0) {
      throw new Error('Invalid FAQPage schema: missing mainEntity');
    }
  }
  if (types.includes('BreadcrumbList')) {
    if (!Array.isArray(schema.itemListElement) || schema.itemListElement.length === 0) {
      throw new Error('Invalid BreadcrumbList schema: missing itemListElement');
    }
  }
  if (types.includes('Article') || types.includes('BlogPosting')) {
    requireField(schema, 'headline', 'Article');
    requireField(schema, 'datePublished', 'Article');
    requireField(schema, 'author', 'Article');
    requireField(schema, 'publisher', 'Article');
  }
  if (types.includes('Person')) requireField(schema, 'name', 'Person');

  return schema;
}

export function buildSchemaGraph(schemas = []) {
  const seen = new Set();
  const graph = [];

  schemas.filter(Boolean).forEach((schema) => {
    const compacted = compactObject(schema);
    const key = stableSchemaKey(compacted);
    if (!seen.has(key)) {
      graph.push(compacted);
      seen.add(key);
    }
  });

  return validateSchemaOutput({
    '@context': 'https://schema.org',
    '@graph': graph,
  });
}

export function normalizeSchemaForJsonLd(schema) {
  return validateSchemaOutput(compactObject(schema));
}

export function buildSoftwareApplicationSchema({
  name = SITE_NAME,
  description,
  url = SITE_URL,
  offers = [],
} = {}) {
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url,
    description,
    publisher: { '@id': ORGANIZATION_ID },
    offers,
  });
}

export function buildOrganizationSchema({
  name = SITE_NAME,
  url = SITE_URL,
  logo = DEFAULT_OG_IMAGE,
  description = 'Prymal is an AI operating system for business execution.',
  sameAs = [],
} = {}) {
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name,
    url,
    logo: {
      '@type': 'ImageObject',
      url: resolveAbsoluteUrl(logo, url),
    },
    description,
    sameAs,
  });
}

export function buildWebSiteSchema({
  name = SITE_NAME,
  url = SITE_URL,
  description = 'Prymal explains governed business AI execution, specialist agents, shared business memory, workflow orchestration, and trust controls.',
} = {}) {
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name,
    url,
    description,
    publisher: { '@id': ORGANIZATION_ID },
  });
}

export function buildWebPageSchema({
  name,
  description,
  path,
  dateModified,
  datePublished,
  siteUrl = SITE_URL,
} = {}) {
  const url = urlForPath(path, siteUrl);
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name,
    description,
    url,
    datePublished,
    dateModified,
    isPartOf: { '@id': WEBSITE_ID },
  });
}

export function buildFaqPageSchema(items = []) {
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  });
}

export function buildBreadcrumbSchema(items = [], siteUrl = SITE_URL) {
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: urlForPath(item.path, siteUrl),
    })),
  });
}

export function buildAuthorSchema({
  name,
  url,
  jobTitle,
  affiliation = SITE_NAME,
} = {}) {
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url ? `${url.replace(/#.*$/, '')}#author` : `${SITE_URL}/blog#author`,
    name,
    url,
    jobTitle,
    affiliation: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: affiliation,
      url: SITE_URL,
    },
  });
}

export function buildArticleSchema({
  headline,
  description,
  path,
  datePublished,
  dateModified,
  keywords = [],
  image,
  wordCount,
  authorName = SITE_NAME,
  authorType = 'Organization',
  authorJobTitle,
  authorUrl,
  siteUrl = SITE_URL,
}) {
  const pageUrl = urlForPath(path, siteUrl);
  const imageUrl = resolveOgImage(image, siteUrl);

  const author =
    authorType === 'Person'
      ? buildAuthorSchema({
          name: authorName,
          jobTitle: authorJobTitle,
          url: authorUrl,
        })
      : {
          '@type': 'Organization',
          '@id': ORGANIZATION_ID,
          name: authorName,
          url: authorUrl ?? siteUrl,
        };

  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    headline,
    description,
    datePublished,
    dateModified: dateModified ?? datePublished,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    url: pageUrl,
    image: imageUrl ? [imageUrl] : undefined,
    wordCount,
    author,
    publisher: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_OG_IMAGE,
      },
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': `${siteUrl}/blog#blog`,
      name: 'Prymal blog',
      url: `${siteUrl}/blog`,
    },
    keywords: keywords.length ? keywords.join(', ') : undefined,
  });
}

export function buildCollectionSchema({ name, description, path, siteUrl = SITE_URL }) {
  const url = urlForPath(path, siteUrl);
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    name,
    description,
    url,
    isPartOf: { '@id': WEBSITE_ID },
  });
}

export function buildBlogSchema({
  name = 'Prymal blog',
  description,
  path = '/blog',
  posts = [],
  siteUrl = SITE_URL,
} = {}) {
  const url = urlForPath(path, siteUrl);
  return compactObject({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${url}#blog`,
    name,
    description,
    url,
    publisher: { '@id': ORGANIZATION_ID },
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      '@id': `${urlForPath(`/blog/${post.slug}`, siteUrl)}#article`,
      headline: post.title,
      url: urlForPath(`/blog/${post.slug}`, siteUrl),
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      author: post.author ?? { '@id': `${siteUrl}/blog#author` },
    })),
  });
}

export const PUBLIC_STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/features', changefreq: 'weekly', priority: '0.9' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/compare', changefreq: 'weekly', priority: '0.9' },
  { path: '/what-is', changefreq: 'weekly', priority: '0.86' },
  { path: '/content/blog', changefreq: 'weekly', priority: '0.86' },
  { path: '/content/entities', changefreq: 'weekly', priority: '0.84' },
  { path: '/content/industries', changefreq: 'weekly', priority: '0.84' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.85' },
  { path: '/trust', changefreq: 'weekly', priority: '0.85' },
  { path: '/for-agencies', changefreq: 'weekly', priority: '0.75' },
  { path: '/for-small-business', changefreq: 'weekly', priority: '0.75' },
  { path: '/changelog', changefreq: 'weekly', priority: '0.7' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookies', changefreq: 'yearly', priority: '0.3' },
];

export function buildPublicRouteMap({
  featurePages = [],
  blogPosts = [],
  comparisonPages = [],
} = {}) {
  return [
    ...PUBLIC_STATIC_ROUTES.map((route) => ({ ...route, kind: 'static' })),
    ...featurePages.map((page) => ({
      path: `/features/${page.slug}`,
      changefreq: 'weekly',
      priority: '0.85',
      lastmod: page.updatedAt ?? page.publishedAt,
      kind: 'feature',
      slug: page.slug,
    })),
    ...blogPosts.map((post) => ({
      path: `/blog/${post.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
      lastmod: post.updatedAt ?? post.publishedAt,
      kind: 'blog',
      slug: post.slug,
    })),
    ...comparisonPages.map((page) => ({
      path: `/compare/${page.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
      lastmod: page.updatedAt ?? page.publishedAt,
      kind: 'compare',
      slug: page.slug,
    })),
  ];
}
