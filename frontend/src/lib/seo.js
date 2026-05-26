export const SITE_URL = 'https://prymal.io';
export const SITE_NAME = 'Prymal';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.svg`;
export const DEFAULT_OG_IMAGE_ALT = 'Prymal — AI operating system for business execution';
export const TWITTER_SITE = '@prymalio';

export function resolveAbsoluteUrl(value, siteUrl = SITE_URL) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${siteUrl.replace(/\/$/, '')}${path}`;
}

export function resolveOgImage(value, siteUrl = SITE_URL) {
  return resolveAbsoluteUrl(value ?? DEFAULT_OG_IMAGE, siteUrl);
}

export function buildSoftwareApplicationSchema({
  name = SITE_NAME,
  description,
  url = SITE_URL,
  offers = [],
} = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url,
    description,
    offers,
  };
}

export function buildOrganizationSchema({
  name = SITE_NAME,
  url = SITE_URL,
  logo = DEFAULT_OG_IMAGE,
  description = 'Prymal is an AI operating system for business execution.',
} = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo,
    description,
    sameAs: [],
  };
}

export function buildWebSiteSchema({
  name = SITE_NAME,
  url = SITE_URL,
  description = 'Prymal explains governed business AI execution, specialist agents, shared business memory, workflow orchestration, and trust controls.',
} = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function buildWebPageSchema({
  name,
  description,
  path,
  siteUrl = SITE_URL,
} = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: `${siteUrl}${path}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl,
    },
  };
}

export function buildFaqPageSchema(items = []) {
  return {
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
  };
}

export function buildBreadcrumbSchema(items = [], siteUrl = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
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
  const pageUrl = `${siteUrl}${path}`;
  const imageUrl = resolveOgImage(image, siteUrl);

  const author =
    authorType === 'Person'
      ? {
          '@type': 'Person',
          name: authorName,
          ...(authorJobTitle ? { jobTitle: authorJobTitle } : {}),
          ...(authorUrl ? { url: authorUrl } : {}),
          affiliation: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: siteUrl,
          },
        }
      : {
          '@type': 'Organization',
          name: authorName,
          url: authorUrl ?? siteUrl,
        };

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
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
      name: SITE_NAME,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_OG_IMAGE,
      },
    },
    keywords: keywords.length ? keywords.join(', ') : undefined,
  };
}

export function buildCollectionSchema({ name, description, path, siteUrl = SITE_URL }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${siteUrl}${path}`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl,
    },
  };
}

export const PUBLIC_STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/features', changefreq: 'weekly', priority: '0.9' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/compare', changefreq: 'weekly', priority: '0.9' },
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
