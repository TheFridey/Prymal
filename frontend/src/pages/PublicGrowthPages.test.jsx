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
import { FEATURE_PAGES } from '../lib/site-content';
import { BLOG_POSTS, getBlogPostWordFloor } from '../lib/blog-posts';

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
  expect(text).toContain('Keep reading');
  expect(text).toContain('FAQ');
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

test('blog hub renders featured editorial metadata without exposing provider internals', () => {
  const { container } = renderWithProviders(<Blog />);
  const text = container.textContent ?? '';

  expect(text).toContain('Featured guide');
  expect(text).toContain('min read');
  expect(text).toContain('words');
  expect(container.querySelectorAll('img[alt^="Editorial illustration for"]').length).toBeGreaterThan(0);
  expect(text).not.toMatch(/OpenAI|Anthropic|Gemini|Veo|Sora|provider cost|token cost|routeReason/i);
});

test('blog hub filter and search narrow the article set', async () => {
  const { container } = renderWithProviders(<Blog />);

  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'memory' } });
  expect(container.textContent ?? '').toContain('Why Business AI Needs Memory, Not Just Prompts');
  expect(container.textContent ?? '').not.toContain('AI Agents for Small Businesses: What They Can Actually Do');

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Trust' } });
  expect(container.textContent ?? '').toContain('Building Trust in AI Automation');
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

test('public trust page keeps readiness language without certification claims', () => {
  const { container } = renderWithProviders(<Trust />);
  const text = container.textContent ?? '';
  expect(text).toContain('readiness');
  expect(text).toContain('not a certification claim');
  expect(text).toContain('Trust architecture');
  expect(text).not.toMatch(/Prymal is (Cyber Essentials|Cyber Essentials Plus|ISO\/IEC 27001|ISO 27001) certified/i);
});

test('sitemap includes the new public growth routes', () => {
  const xml = fs.readFileSync('./public/sitemap.xml', 'utf8');
  expect(xml).toContain('https://prymal.io/features/ai-agents');
  expect(xml).toContain('https://prymal.io/blog/what-is-an-ai-operating-system-for-business');
  expect(xml).toContain('https://prymal.io/compare/prymal-vs-chatgpt-for-business');
});
