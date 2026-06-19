import { describe, expect, test } from 'vitest';
import {
  EDUCATION_PAGES,
  buildEducationHubSchema,
  buildEducationPageSchema,
  getEducationPageBySlug,
  getEducationPath,
  getEducationRoutes,
  getEducationWordCount,
} from './index';

const REQUIRED_TERMS = [
  'An AI Operating System',
  'Agent Orchestration',
  'Agent Memory',
  'Workflow Automation',
  'Multi-Agent AI',
  'AI Governance',
  'Retrieval Augmented Generation',
  'Agent Collaboration',
  'AI Workflow Management',
];

describe('education knowledge hub', () => {
  test('contains the required What Is pages', () => {
    expect(EDUCATION_PAGES.map((page) => page.term)).toEqual(REQUIRED_TERMS);
    expect(new Set(EDUCATION_PAGES.map((page) => page.slug)).size).toBe(EDUCATION_PAGES.length);
  });

  test('every page has long-form content and education requirements', () => {
    EDUCATION_PAGES.forEach((page) => {
      expect(getEducationWordCount(page)).toBeGreaterThanOrEqual(2500);
      expect(page.examples.length).toBeGreaterThanOrEqual(2);
      expect(page.faq.length).toBeGreaterThanOrEqual(4);
      expect(page.references.length).toBeGreaterThanOrEqual(3);
      expect(page.illustration.nodes.length).toBeGreaterThanOrEqual(4);
      expect(page.relatedSlugs.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('exposes hub and detail routes', () => {
    const routes = getEducationRoutes().map((route) => route.path);

    expect(routes).toContain('/what-is');
    EDUCATION_PAGES.forEach((page) => {
      expect(routes).toContain(getEducationPath(page.slug));
    });
  });

  test('emits valid schema graphs for hub and detail pages', () => {
    const page = getEducationPageBySlug('ai-operating-system');
    const graph = buildEducationPageSchema(page)['@graph'];
    const hubGraph = buildEducationHubSchema()['@graph'];

    expect(graph.some((entry) => entry['@type'] === 'WebPage')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'Article')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'FAQPage')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'DefinedTerm')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'ItemList')).toBe(true);
    expect(hubGraph.some((entry) => entry['@type'] === 'CollectionPage')).toBe(true);
  });
});
