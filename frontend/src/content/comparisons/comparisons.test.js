import { describe, expect, test } from 'vitest';
import {
  GENERATED_COMPARISON_PAGES,
  buildGeneratedComparisonPageSchema,
  getGeneratedComparisonBySlug,
  getGeneratedComparisonPath,
  getGeneratedComparisonRoutes,
} from './index';

const REQUIRED_COMPARISONS = [
  'Prymal vs ChatGPT',
  'Prymal vs Claude',
  'Prymal vs Gemini',
  'Prymal vs Notion AI',
  'Prymal vs ClickUp AI',
  'Prymal vs Sintra',
  'Prymal vs Agentforce',
  'Prymal vs CrewAI',
  'Prymal vs AutoGen',
  'Prymal vs LangGraph',
  'Prymal vs Zapier AI',
];

describe('generated comparison page system', () => {
  test('contains the required generated comparison pages', () => {
    const titles = GENERATED_COMPARISON_PAGES.map((page) => page.title);

    expect(titles).toEqual(REQUIRED_COMPARISONS);
    expect(new Set(GENERATED_COMPARISON_PAGES.map((page) => page.slug)).size).toBe(GENERATED_COMPARISON_PAGES.length);
  });

  test('each generated comparison has required page sections', () => {
    GENERATED_COMPARISON_PAGES.forEach((page) => {
      expect(page.featureRows.length).toBeGreaterThanOrEqual(5);
      expect(page.pricingRows.length).toBeGreaterThanOrEqual(2);
      expect(page.prymalPros.length).toBeGreaterThanOrEqual(3);
      expect(page.prymalCons.length).toBeGreaterThanOrEqual(2);
      expect(page.alternativePros.length).toBeGreaterThanOrEqual(3);
      expect(page.alternativeCons.length).toBeGreaterThanOrEqual(2);
      expect(page.idealPrymalCustomer).toBeTruthy();
      expect(page.idealAlternativeCustomer).toBeTruthy();
      expect(page.faq.length).toBeGreaterThanOrEqual(4);
      expect(page.sourceUrl).toMatch(/^https:\/\//);
    });
  });

  test('exposes public generated comparison routes', () => {
    const routes = getGeneratedComparisonRoutes().map((route) => route.path);

    expect(routes).toContain('/compare/prymal-vs-chatgpt');
    expect(routes).toContain('/compare/prymal-vs-langgraph');
    GENERATED_COMPARISON_PAGES.forEach((page) => {
      expect(routes).toContain(getGeneratedComparisonPath(page.slug));
    });
  });

  test('emits valid comparison schema graphs', () => {
    const page = getGeneratedComparisonBySlug('prymal-vs-chatgpt');
    const graph = buildGeneratedComparisonPageSchema(page)['@graph'];

    expect(graph.some((entry) => entry['@type'] === 'WebPage')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'BreadcrumbList')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'FAQPage')).toBe(true);
    expect(graph.filter((entry) => entry['@type'] === 'SoftwareApplication')).toHaveLength(2);
    expect(graph.filter((entry) => entry['@type'] === 'ItemList')).toHaveLength(2);
  });
});
