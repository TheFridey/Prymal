import { describe, expect, test } from 'vitest';
import {
  USE_CASES,
  buildUseCaseHubSchema,
  buildUseCasePageSchema,
  getUseCaseBySlug,
  getUseCasePath,
  getUseCaseRoutes,
  getUseCaseWordCount,
} from './index';

const REQUIRED_EXAMPLES = [
  'Lead Generation',
  'Sales Follow-Up',
  'CRM Management',
  'Client Onboarding',
  'Proposal Generation',
  'Content Marketing',
  'SEO Research',
  'Competitor Analysis',
  'Meeting Notes',
  'Email Management',
  'Customer Support',
  'Recruitment',
  'Staff Training',
  'Knowledge Management',
  'Invoice Tracking',
];

describe('generated use case framework', () => {
  test('generates 50 use case pages including requested examples', () => {
    const names = USE_CASES.map((useCase) => useCase.name);

    expect(USE_CASES).toHaveLength(50);
    expect(names).toEqual(expect.arrayContaining(REQUIRED_EXAMPLES));
    expect(new Set(USE_CASES.map((useCase) => useCase.slug)).size).toBe(USE_CASES.length);
  });

  test('every generated use case has long-form content and required sections', () => {
    USE_CASES.forEach((useCase) => {
      expect(getUseCaseWordCount(useCase)).toBeGreaterThanOrEqual(1500);
      expect(useCase.faq.length).toBeGreaterThanOrEqual(4);
      expect(useCase.comparisonRows.length).toBeGreaterThanOrEqual(4);
      expect(useCase.roiExamples.length).toBeGreaterThanOrEqual(3);
      expect(useCase.relatedSlugs.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('exposes public generated use case routes', () => {
    const routes = getUseCaseRoutes().map((route) => route.path);

    expect(routes).toContain('/use-cases/lead-generation');
    expect(routes).toContain('/use-cases/invoice-tracking');
    USE_CASES.forEach((useCase) => {
      expect(routes).toContain(getUseCasePath(useCase.slug));
    });
  });

  test('emits valid JSON-LD schema graphs for hub and detail pages', () => {
    const useCase = getUseCaseBySlug('lead-generation');
    const pageGraph = buildUseCasePageSchema(useCase)['@graph'];
    const hubGraph = buildUseCaseHubSchema()['@graph'];

    expect(pageGraph.some((entry) => entry['@type'] === 'WebPage')).toBe(true);
    expect(pageGraph.some((entry) => entry['@type'] === 'BreadcrumbList')).toBe(true);
    expect(pageGraph.some((entry) => entry['@type'] === 'FAQPage')).toBe(true);
    expect(pageGraph.filter((entry) => entry['@type'] === 'ItemList')).toHaveLength(2);
    expect(hubGraph.some((entry) => entry['@type'] === 'CollectionPage')).toBe(true);
    expect(hubGraph.some((entry) => entry['@type'] === 'ItemList')).toBe(true);
  });
});
