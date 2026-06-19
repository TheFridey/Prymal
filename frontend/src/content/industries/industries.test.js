import { describe, expect, test } from 'vitest';
import {
  INDUSTRIES,
  buildIndustryHubSchema,
  buildIndustryPageSchema,
  getIndustryBySlug,
  getIndustryPath,
  getIndustryRoutes,
  getRelatedIndustries,
} from './index';

const REQUIRED_INDUSTRIES = [
  'Agencies',
  'Recruiters',
  'Accountants',
  'Consultants',
  'Marketing Teams',
  'Sales Teams',
  'Construction Firms',
  'Trades',
  'Estate Agents',
  'Law Firms',
  'Financial Advisors',
  'Coaches',
  'Health Clinics',
  'Dentists',
  'Ecommerce Brands',
  'Manufacturing Companies',
  'Startups',
  'SaaS Companies',
  'SMBs',
  'Enterprise Teams',
];

describe('industry page framework', () => {
  test('contains all required generated industry pages', () => {
    expect(INDUSTRIES.map((industry) => industry.name)).toEqual(REQUIRED_INDUSTRIES);
    expect(new Set(INDUSTRIES.map((industry) => industry.slug)).size).toBe(INDUSTRIES.length);
  });

  test('each industry has the required page sections', () => {
    INDUSTRIES.forEach((industry) => {
      expect(industry.painPoints.length).toBeGreaterThanOrEqual(3);
      expect(industry.aiOpportunities.length).toBeGreaterThanOrEqual(3);
      expect(industry.prymalUseCases.length).toBeGreaterThanOrEqual(3);
      expect(industry.agentRecommendations.length).toBeGreaterThanOrEqual(4);
      expect(industry.workflowExamples.length).toBeGreaterThanOrEqual(2);
      expect(industry.faq.length).toBeGreaterThanOrEqual(3);
      expect(industry.roiEstimate.monthlyHours).toBeTruthy();
      expect(industry.summary).toMatch(/Prymal/i);
    });
  });

  test('generates related suggestions and public routes', () => {
    const agencies = getIndustryBySlug('agencies');
    const routes = getIndustryRoutes().map((route) => route.path);

    expect(getRelatedIndustries(agencies).map((industry) => industry.slug)).toContain('marketing-teams');
    expect(routes).toContain('/content/industries');
    INDUSTRIES.forEach((industry) => {
      expect(routes).toContain(getIndustryPath(industry.slug));
    });
  });

  test('emits valid JSON-LD schema graphs for hub and industry pages', () => {
    const agencies = getIndustryBySlug('agencies');
    const pageGraph = buildIndustryPageSchema(agencies)['@graph'];
    const hubGraph = buildIndustryHubSchema()['@graph'];

    expect(pageGraph.some((entry) => entry['@type'] === 'WebPage')).toBe(true);
    expect(pageGraph.some((entry) => entry['@type'] === 'BreadcrumbList')).toBe(true);
    expect(pageGraph.some((entry) => entry['@type'] === 'FAQPage')).toBe(true);
    expect(pageGraph.filter((entry) => entry['@type'] === 'ItemList')).toHaveLength(2);
    expect(hubGraph.some((entry) => entry['@type'] === 'CollectionPage')).toBe(true);
    expect(hubGraph.some((entry) => entry['@type'] === 'ItemList')).toBe(true);
  });
});
