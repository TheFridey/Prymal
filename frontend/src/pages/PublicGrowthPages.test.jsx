import fs from 'node:fs';
import { Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import Landing from './Landing';
import Trust from './Trust';
import FeaturePage from './FeaturePage';
import BlogPost from './BlogPost';
import ComparisonPage from './ComparisonPage';
import { FEATURE_PAGES } from '../lib/site-content';

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

test('blog pages render Article metadata', () => {
  renderWithProviders(
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
});

test('public trust page keeps readiness language without certification claims', () => {
  const { container } = renderWithProviders(<Trust />);
  const text = container.textContent ?? '';
  expect(text).toContain('readiness');
  expect(text).toContain('not a certification claim');
  expect(text).not.toMatch(/Prymal is (Cyber Essentials|Cyber Essentials Plus|ISO\/IEC 27001|ISO 27001) certified/i);
});

test('sitemap includes the new public growth routes', () => {
  const xml = fs.readFileSync('./public/sitemap.xml', 'utf8');
  expect(xml).toContain('https://prymal.io/features/ai-agents');
  expect(xml).toContain('https://prymal.io/blog/what-is-an-ai-operating-system-for-business');
  expect(xml).toContain('https://prymal.io/compare/prymal-vs-chatgpt-for-business');
});
