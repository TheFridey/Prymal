import fs from 'node:fs';
import { fireEvent } from '@testing-library/react';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import Landing from './Landing';
import Trust from './Trust';
import Features from './Features';
import FeaturePage from './FeaturePage';
import Blog from './Blog';
import BlogPost from './BlogPost';
import ComparisonPage from './ComparisonPage';
import { COMPARISON_PAGES, FEATURE_PAGES } from '../lib/site-content';
import { BLOG_POSTS, getBlogPostWordFloor } from '../lib/blog-posts';
import { AGENT_LIBRARY } from '../lib/constants';
import { PUBLIC_STATIC_ROUTES, SITE_URL } from '../lib/seo';
import SeoGrowthPage from './SeoGrowthPage';
import { SEO_CATEGORY_PAGES, SEO_GROWTH_PAGES, SEO_USE_CASE_PAGES } from '../lib/seo-growth-content';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

vi.mock('../features/marketing/MagicalCanvas', () => ({
  MagicalCanvas: () => null,
}));

vi.mock('../features/marketing/FoundingAccessPopup', () => ({
  FoundingAccessPopup: () => null,
}));

vi.mock('../features/marketing/founding-access', () => ({
  useFoundingAccessOffer: () => ({ status: 'idle', offer: null }),
}));

vi.mock('../components/CookieConsentBanner', () => ({
  default: () => null,
}));

test('homepage includes the answer-first AEO block', () => {
  const { container } = renderWithProviders(<Landing />);
  expect(container.textContent).toContain('What is Prymal?');
  expect(container.textContent).toContain('AI operating system for business execution');
  expect(container.textContent).toContain('What you can do in 5 minutes');
});

test('feature page sets a unique meta title from the content model', () => {
  const metaTitles = FEATURE_PAGES.map((page) => page.metaTitle);
  expect(new Set(metaTitles).size).toBe(FEATURE_PAGES.length);

  renderWithProviders(
    <Routes>
      <Route path="/features/:slug" element={<FeaturePage />} />
    </Routes>,
    { route: '/features/ai-agents' },
  );

  expect(document.title).toBe('Prymal AI Agents | Specialist agents for business execution');
});

test('features page renders premium module labels and system language', () => {
  const { container } = renderWithProviders(<Features />);
  const text = container.textContent ?? '';

  expect(text).toContain('Feature operating map');
  expect(text).toContain('Operating modules');
  expect(text).toContain('System architecture');
  expect(text).toContain('LORE memory');
});

test('blog pages render Article metadata', () => {
  const { getByAltText } = renderWithProviders(
    <Routes>
      <Route path="/blog/:slug" element={<BlogPost />} />
    </Routes>,
    { route: '/blog/what-is-an-ai-operating-system-for-business' },
  );

  const articleScript = document.getElementById('schema-blog-post-what-is-an-ai-operating-system-for-business');
  expect(articleScript).not.toBeNull();
  const schema = JSON.parse(articleScript.textContent);
  expect(schema['@type']).toBe('Article');
  expect(schema.headline).toContain('AI Operating System for Business');
  expect(schema.author['@type']).toBe('Person');
  expect(schema.wordCount).toBeGreaterThan(2500);
  expect(schema.datePublished).toBeTruthy();
  expect(schema.dateModified).toBeTruthy();
  expect(schema.url).toBe('https://prymal.io/blog/what-is-an-ai-operating-system-for-business');
  expect(schema.image?.length).toBeGreaterThan(0);
  expect(getByAltText(/Editorial illustration for What Is an AI Operating System for Business/i)).toBeTruthy();
});

test('blog post renders TOC, related links, FAQ, and outbound references', () => {
  const { container } = renderWithProviders(
    <Routes>
      <Route path="/blog/:slug" element={<BlogPost />} />
    </Routes>,
    { route: '/blog/what-is-an-ai-operating-system-for-business' },
  );

  const text = container.textContent ?? '';
  expect(text).toContain('Article map');
  expect(text).toContain('Prymal lens');
  expect(text).toContain('Outbound references');
  expect(text).toContain('Related reading');
  expect(text).toContain('Next action');
  expect(text).toContain('Founder note');
  expect(text).toContain('AI workflow template pack');
  expect(text).toContain('FAQ');
});

test('blog posts expose conversion CTA tracking attributes', () => {
  const { container } = renderWithProviders(
    <Routes>
      <Route path="/blog/:slug" element={<BlogPost />} />
    </Routes>,
    { route: '/blog/what-is-an-ai-operating-system-for-business' },
  );

  expect(container.querySelector('[data-cta="beta-access"]')).toBeTruthy();
  expect(container.querySelector('[data-cta="pricing"]')).toBeTruthy();
  expect(container.querySelector('[data-cta="feature"]')).toBeTruthy();
  expect(container.querySelector('[data-cta="workflow-template"]')).toBeTruthy();
  expect(container.querySelector('[data-cta="lead-magnet"]')).toBeTruthy();
});

test('blog posts meet the long-form floor and include internal and external reading paths', () => {
  const wordFloor = getBlogPostWordFloor();

  BLOG_POSTS.forEach((post) => {
    expect(post.wordCount).toBeGreaterThanOrEqual(wordFloor);
    expect(post.inboundLinks.length).toBeGreaterThan(0);
    expect(post.outboundLinks.length).toBeGreaterThan(0);
    expect(post.outboundLinks.map((link) => link.href).join(' ')).not.toMatch(/chatgpt|openai|anthropic|gemini/i);
  });
});

test('new SEO growth articles have wired editorial images', () => {
  const seoArticleSlugs = [
    'what-is-ai-agent-orchestration',
    'how-to-build-ai-agents-for-business-workflows',
    'benefits-of-shared-business-memory-for-ai',
    'ai-agent-trust-and-access-control',
    'cost-of-ai-business-process-automation',
    'ai-business-execution-platform-advantages',
    'ai-workflow-automation-for-regulated-industries',
    'how-to-integrate-ai-agents-with-business-software',
    'why-ai-wrappers-fail-without-memory-and-governance',
    'ai-agents-vs-workflow-automation',
    'secure-ai-agents-for-business',
  ];

  seoArticleSlugs.forEach((slug) => {
    const post = BLOG_POSTS.find((entry) => entry.slug === slug);
    expect(post?.heroImage).toBeTruthy();
    expect(post?.ogImage).toBe(post?.heroImage);
    expect(post?.ogImageAlt).toContain(post?.title);
  });
});

test('blog hub renders editorial hero, topic pills, featured guide, and commercial section', () => {
  const { container } = renderWithProviders(<Blog />);
  const text = container.textContent ?? '';

  expect(text).toContain('Guides for teams turning AI into repeatable business work');
  expect(text).toContain('Featured guide');
  expect(text).toContain('Best AI for Agencies');
  expect(text).toContain('Popular guides for growing teams');
  expect(container.querySelectorAll('.public-blog-topics__pill').length).toBeGreaterThan(3);
  expect(container.querySelectorAll('img[alt^="Editorial illustration for"]').length).toBeGreaterThan(0);
  expect(text).not.toMatch(/OpenAI|Anthropic|Gemini|Veo|Sora|provider cost|token cost|routeReason/i);
});

test('blog hub topic pills and search narrow the article set', () => {
  const { container } = renderWithProviders(<Blog />);

  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'memory' } });
  expect(container.textContent ?? '').toContain('Why Business AI Needs Memory, Not Just Prompts');
  expect(container.textContent ?? '').not.toContain('AI Agents for Small Businesses: What They Can Actually Do');

  fireEvent.click(screen.getByRole('button', { name: 'Comparisons' }));
  expect(container.textContent ?? '').toMatch(/Sintra Alternative|ChatGPT Team Alternative/i);
});

test('comparison pages avoid hostile competitor language and provider leakage', () => {
  const { container } = renderWithProviders(
    <Routes>
      <Route path="/compare/:slug" element={<ComparisonPage />} />
    </Routes>,
    { route: '/compare/prymal-vs-chatgpt-for-business' },
  );

  const text = container.textContent ?? '';
  expect(text).not.toMatch(/unsafe|scam|bad competitor|just wrappers/i);
  expect(text).not.toMatch(/OpenAI|Anthropic|Gemini|Veo|Sora/i);
  expect(text).toContain('Comparison matrix');
});

test('SEO growth pages render answer blocks, metadata, and schema', () => {
  const metaTitles = SEO_GROWTH_PAGES.map((page) => page.metaTitle);
  const metaDescriptions = SEO_GROWTH_PAGES.map((page) => page.metaDescription);
  expect(new Set(metaTitles).size).toBe(SEO_GROWTH_PAGES.length);
  expect(new Set(metaDescriptions).size).toBe(SEO_GROWTH_PAGES.length);
  expect(SEO_CATEGORY_PAGES).toHaveLength(5);
  expect(SEO_USE_CASE_PAGES).toHaveLength(6);

  const { container } = renderWithProviders(
    <Routes>
      <Route path="/ai-agent-orchestration" element={<SeoGrowthPage />} />
    </Routes>,
    { route: '/ai-agent-orchestration' },
  );

  const text = container.textContent ?? '';
  expect(document.title).toBe('AI Agent Orchestration for Business Workflows | Prymal');
  expect(text).toContain('Short answer');
  expect(text).toContain('LORE');
  expect(text).toContain('WARDEN');
  expect(document.getElementById('schema-webpage-ai-agent-orchestration')).not.toBeNull();
  expect(document.getElementById('schema-faq-ai-agent-orchestration')).not.toBeNull();
});

test('public trust centre keeps readiness language without certification claims', () => {
  const { container } = renderWithProviders(<Trust />);
  const text = container.textContent ?? '';
  expect(text).toContain('Trust Centre');
  expect(text).toContain('not a certification claim');
  expect(text).toContain('WARDEN');
  expect(text).toContain('SENTINEL');
  expect(text).not.toMatch(/Prymal is (Cyber Essentials|Cyber Essentials Plus|ISO\/IEC 27001|ISO 27001) certified/i);
});

test('sitemap includes the new public growth routes', () => {
  const xml = fs.readFileSync('./public/sitemap.xml', 'utf8');

  PUBLIC_STATIC_ROUTES.forEach((route) => {
    expect(xml).toContain(`${SITE_URL}${route.path}`);
  });

  FEATURE_PAGES.forEach((page) => {
    expect(xml).toContain(`${SITE_URL}/features/${page.slug}`);
  });

  BLOG_POSTS.forEach((post) => {
    expect(xml).toContain(`${SITE_URL}/blog/${post.slug}`);
  });

  COMPARISON_PAGES.forEach((page) => {
    expect(xml).toContain(`${SITE_URL}/compare/${page.slug}`);
  });

  SEO_GROWTH_PAGES.forEach((page) => {
    expect(xml).toContain(`${SITE_URL}${page.path}`);
  });
});

test('robots.txt references the sitemap and keeps app routes private', () => {
  const robots = fs.readFileSync('./public/robots.txt', 'utf8');

  expect(robots).toContain('Sitemap: https://prymal.io/sitemap.xml');
  expect(robots).toContain('Disallow: /app/');
  expect(robots).toContain('llms.txt');
});

test('_redirects canonicalizes the public site and does not index unknown routes as the SPA shell', () => {
  const redirects = fs.readFileSync('./public/_redirects', 'utf8');
  const redirectLines = redirects.split(/\r?\n/);

  expect(redirects).toContain('https://www.prymal.io/* https://prymal.io/:splat 301');
  expect(redirects).toContain('/404.html /404.html 404');
  expect(redirects).toContain('/* /404.html 404');
  expect(redirectLines).not.toContain('/* /index.html 200');

  PUBLIC_STATIC_ROUTES.forEach((route) => {
    expect(redirects).toContain(`${route.path} /index.html 200`);
  });

  [
    ...FEATURE_PAGES.map((page) => `/features/${page.slug}`),
    ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    ...COMPARISON_PAGES.map((page) => `/compare/${page.slug}`),
    ...SEO_GROWTH_PAGES.map((page) => page.path),
    ...AGENT_LIBRARY.map((agent) => `/agents/${agent.id}`),
  ].forEach((path) => {
    expect(redirects).toContain(`${path} /index.html 200`);
  });
});

test('llms.txt explains Prymal for answer engines without certification claims', () => {
  const llms = fs.readFileSync('./public/llms.txt', 'utf8');

  expect(llms).toContain('Canonical site: https://prymal.io');
  expect(llms).toContain('readiness');
  expect(llms).toContain('does not claim Cyber Essentials');
  expect(llms).toContain('https://prymal.io/pricing');
  expect(llms).toContain('https://prymal.io/trust');
});

test('homepage sets canonical, OG, and Twitter metadata', () => {
  renderWithProviders(<Landing />);

  expect(document.title).toContain('AI operating system for business execution');
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://prymal.io/');
  expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain('https://');
  expect(document.querySelector('meta[name="twitter:site"]')?.getAttribute('content')).toBe('@prymalio');
});
