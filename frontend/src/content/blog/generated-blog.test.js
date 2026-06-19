import { describe, expect, test } from 'vitest';
import {
  GENERATED_BLOG_ARTICLES,
  buildGeneratedBlogArticleSchema,
  buildGeneratedBlogHubSchema,
  getGeneratedBlogArticleBySlug,
  getGeneratedBlogFaq,
  getGeneratedBlogPath,
  getGeneratedBlogRoutes,
  getGeneratedBlogWordCount,
} from './index';

const REQUIRED_TITLES = [
  'What Is An AI Operating System',
  'AI Operating System vs AI Assistant',
  'Why Businesses Need AI Operating Systems',
  'AI Operating Systems Explained',
  'Best AI Operating Systems In 2026',
  'Future Of AI Operating Systems',
  'AI Operating System Architecture',
  'Benefits Of AI Operating Systems',
  'Common AI Operating System Mistakes',
  'How To Choose An AI Operating System',
  'What Is Agent Orchestration',
  'Agent Orchestration Explained',
  'Multi-Agent Systems Guide',
  'Agent Coordination Strategies',
  'Agent Collaboration Models',
  'Building Multi-Agent Workflows',
  'Agent Routing Techniques',
  'Agent Memory Systems',
  'Agent Delegation Patterns',
  'Agent Governance',
  'AI For Agencies',
  'AI For Recruiters',
  'AI For Accountants',
  'AI For Consultants',
  'AI For Sales Teams',
  'AI For Marketing Teams',
  'AI For SMEs',
  'AI For Startups',
  'AI For Ecommerce',
  'AI For Construction',
  'AI Sales Automation',
  'Lead Qualification With AI',
  'AI Prospect Research',
  'AI Outreach Workflows',
  'AI Proposal Generation',
  'AI CRM Automation',
  'AI Follow Up Systems',
  'AI Pipeline Management',
  'AI Revenue Operations',
  'AI Sales Agents',
  'AI Knowledge Management',
  'AI SOP Management',
  'AI Internal Documentation',
  'AI Team Collaboration',
  'AI Task Management',
  'AI Workflow Automation',
  'AI Process Optimisation',
  'AI Decision Support',
  'AI Meeting Intelligence',
  'AI Operations Stack',
  'AI Content Operations',
  'AI Content Planning',
  'AI Blog Workflows',
  'AI SEO Workflows',
  'AI GEO Workflows',
  'AI AEO Workflows',
  'AI Publishing Systems',
  'AI Research Pipelines',
  'AI Content Governance',
  'AI Editorial Automation',
  'AI Governance Frameworks',
  'AI Compliance Workflows',
  'AI Security For Agents',
  'AI Access Controls',
  'AI Audit Trails',
  'AI Agent Permissions',
  'AI Risk Management',
  'AI Business Security',
  'AI Data Governance',
  'AI Trust Systems',
  'Future Of Agentic Search',
  'Future Of AI Agents',
  'Future Of Business Automation',
  'Future Of Multi-Agent Systems',
  'Future Of AI Governance',
  'Future Of AI Operations',
  'Future Of Knowledge Systems',
  'Future Of Autonomous Workflows',
  'Future Of AI Teams',
  'Future Of Business Operating Systems',
];

describe('generated blog system', () => {
  test('generates 100 articles and includes all exact non-comparison target titles', () => {
    const titles = GENERATED_BLOG_ARTICLES.map((article) => article.title);

    expect(GENERATED_BLOG_ARTICLES).toHaveLength(100);
    expect(titles).toEqual(expect.arrayContaining(REQUIRED_TITLES));
    expect(titles.filter((title) => title.startsWith('Prymal vs '))).toHaveLength(20);
    expect(new Set(GENERATED_BLOG_ARTICLES.map((article) => article.slug)).size).toBe(100);
  });

  test('every generated article meets the editorial requirements', () => {
    GENERATED_BLOG_ARTICLES.forEach((article) => {
      expect(getGeneratedBlogWordCount(article)).toBeGreaterThanOrEqual(2000);
      expect(getGeneratedBlogFaq(article)).toHaveLength(4);
      expect(article.citations.length).toBeGreaterThanOrEqual(3);
      expect(article.entityReferences.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('exposes generated blog routes', () => {
    const routes = getGeneratedBlogRoutes().map((route) => route.path);

    expect(routes).toContain('/content/blog');
    GENERATED_BLOG_ARTICLES.forEach((article) => {
      expect(routes).toContain(getGeneratedBlogPath(article.slug));
    });
  });

  test('emits valid hub and article schema graphs', () => {
    const article = getGeneratedBlogArticleBySlug('what-is-an-ai-operating-system');
    const graph = buildGeneratedBlogArticleSchema(article)['@graph'];
    const hubGraph = buildGeneratedBlogHubSchema()['@graph'];

    expect(graph.some((entry) => entry['@type'] === 'Article')).toBe(true);
    expect(graph.some((entry) => entry['@type'] === 'FAQPage')).toBe(true);
    expect(graph.filter((entry) => entry['@type'] === 'ItemList')).toHaveLength(2);
    expect(hubGraph.some((entry) => entry['@type'] === 'CollectionPage')).toBe(true);
    expect(hubGraph.some((entry) => entry['@type'] === 'ItemList')).toBe(true);
  });
});
