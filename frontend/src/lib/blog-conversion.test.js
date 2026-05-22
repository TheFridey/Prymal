import { describe, expect, test } from 'vitest';
import { BLOG_POSTS } from './blog-posts';
import {
  BLOG_CONVERSION_BY_SLUG,
  countBlogInternalLinks,
  getBlogConversionConfig,
} from './blog-conversion';

describe('blog conversion coverage', () => {
  test('every published blog post has conversion config', () => {
    BLOG_POSTS.forEach((post) => {
      expect(BLOG_CONVERSION_BY_SLUG[post.slug]).toBeTruthy();
      expect(getBlogConversionConfig(post).workflowTemplate).toBeTruthy();
      expect(getBlogConversionConfig(post).nextAction.title).toBeTruthy();
    });
  });

  test('every blog post has at least three internal links', () => {
    BLOG_POSTS.forEach((post) => {
      expect(countBlogInternalLinks(post)).toBeGreaterThanOrEqual(3);
    });
  });
});
