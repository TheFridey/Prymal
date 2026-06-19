import { describe, expect, test } from 'vitest';
import {
  buildAuthorSchema,
  buildBlogSchema,
  buildOrganizationSchema,
  buildSchemaGraph,
  buildSoftwareApplicationSchema,
  normalizeSchemaForJsonLd,
} from './seo';

describe('SEO schema utilities', () => {
  test('builds validated organization and software schemas', () => {
    expect(normalizeSchemaForJsonLd(buildOrganizationSchema()).name).toBe('Prymal');
    expect(normalizeSchemaForJsonLd(buildSoftwareApplicationSchema()).applicationCategory).toBe(
      'BusinessApplication',
    );
  });

  test('builds author and blog schemas with canonical ids', () => {
    const author = buildAuthorSchema({
      name: 'Prymal editorial team',
      url: 'https://prymal.io/blog',
      jobTitle: 'Product and go-to-market',
    });
    const blog = buildBlogSchema({
      posts: [
        {
          slug: 'what-is-an-ai-operating-system-for-business',
          title: 'What Is an AI Operating System for Business?',
          publishedAt: '2026-05-19',
          updatedAt: '2026-06-11',
        },
      ],
    });

    expect(normalizeSchemaForJsonLd(author)['@type']).toBe('Person');
    expect(normalizeSchemaForJsonLd(blog)['@type']).toBe('Blog');
    expect(blog.blogPost[0]['@type']).toBe('BlogPosting');
    expect(blog.blogPost[0].url).toBe('https://prymal.io/blog/what-is-an-ai-operating-system-for-business');
  });

  test('dedupes schemas when building a graph', () => {
    const organization = buildOrganizationSchema();
    const graph = buildSchemaGraph([organization, organization]);

    expect(graph['@graph']).toHaveLength(1);
  });

  test('rejects malformed schema output', () => {
    expect(() => normalizeSchemaForJsonLd({ '@context': 'https://schema.org', '@type': 'FAQPage' })).toThrow(
      /mainEntity/,
    );
  });
});
