import { BLOG_POSTS } from './blog-posts';
import { getComparisonPageBySlug, getFeaturePageBySlug } from './site-content';
import { findWorkflowTemplate } from './workflow-templates';

export const BLOG_AUTHOR = {
  name: 'Prymal editorial team',
  jobTitle: 'Product and go-to-market',
  affiliation: 'Prymal',
  url: 'https://prymal.io/blog',
};

export const BLOG_FOUNDER_NOTE = {
  eyebrow: 'Founder note',
  title: 'Why we publish these guides',
  body: 'Prymal is built by operators who got tired of watching strong AI demos collapse under real business repetition. These articles explain the category honestly — readiness language, no certification overclaims, and product boundaries you can verify on the feature and trust pages.',
};

/** Per-post conversion wiring — copy only; does not change billing or product logic. */
export const BLOG_CONVERSION_BY_SLUG = {
  'what-is-an-ai-operating-system-for-business': {
    workflowTemplateSlug: 'launch-campaign-war-room',
    nextAction: {
      title: 'Turn the category into a working workspace',
      description: 'Start with one coordinated execution path — agents, LORE memory, and a governed workflow — instead of another isolated chat thread.',
      primary: 'beta',
    },
  },
  'ai-agents-for-small-businesses-what-they-can-actually-do': {
    workflowTemplateSlug: 'lead-intake-to-proposal',
    nextAction: {
      title: 'Pick one recurring task to automate first',
      description: 'Small teams win fastest when one agent lane removes repeated scaffolding — follow-up, support, or reporting — with shared context.',
      primary: 'feature',
    },
  },
  'why-business-ai-needs-memory-not-just-prompts': {
    workflowTemplateSlug: 'content-signal-to-campaign',
    nextAction: {
      title: 'Give your agents durable business context',
      description: 'Load LORE with offer, customer, and campaign context so the next agent session starts from memory, not from zero.',
      primary: 'feature',
    },
  },
  'how-to-use-ai-safely-in-a-business': {
    workflowTemplateSlug: 'support-triage-and-response',
    nextAction: {
      title: 'Adopt AI with visible trust boundaries',
      description: 'Review Prymal readiness posture, then run a low-risk workflow with approvals and validation before customer-facing automation.',
      primary: 'beta',
    },
  },
  'ai-workflow-automation-a-practical-guide-for-growing-teams': {
    workflowTemplateSlug: 'launch-campaign-war-room',
    nextAction: {
      title: 'Promote your best manual process into a workflow',
      description: 'Use a template as the starting graph, then tune approvals and agent handoffs for your team rhythm.',
      primary: 'workflow',
    },
  },
  'the-difference-between-ai-chatbots-and-ai-agents': {
    workflowTemplateSlug: 'lead-intake-to-proposal',
    nextAction: {
      title: 'Compare category fit before you buy',
      description: 'Use the comparison hub to decide whether you need conversation, execution, automation, or a configurable agent platform.',
      primary: 'feature',
    },
  },
  'how-agencies-can-use-ai-agents-to-scale-client-delivery': {
    workflowTemplateSlug: 'weekly-client-report',
    nextAction: {
      title: 'Run one client delivery chain end-to-end',
      description: 'Agencies scale when reporting, comms, and production share one LORE context instead of rebuilding every client lane from scratch.',
      primary: 'workflow',
    },
  },
  'building-trust-in-ai-automation': {
    workflowTemplateSlug: 'monthly-exec-operating-review',
    nextAction: {
      title: 'Pair trust review with a governed workflow',
      description: 'Read the trust architecture, then run a review-aware workflow so automation stays legible to operators and buyers.',
      primary: 'beta',
    },
  },
};

export function getBlogConversionConfig(post) {
  const slugConfig = BLOG_CONVERSION_BY_SLUG[post.slug] ?? {};
  const primaryFeatureSlug = post.relatedFeatures?.[0] ?? 'ai-agents';
  const primaryComparisonSlug = post.relatedComparisons?.[0] ?? 'prymal-vs-chatgpt-for-business';
  const workflowTemplateSlug = slugConfig.workflowTemplateSlug ?? 'content-signal-to-campaign';
  const workflowTemplate = findWorkflowTemplate(workflowTemplateSlug);

  return {
    primaryFeatureSlug,
    primaryComparisonSlug,
    primaryFeature: getFeaturePageBySlug(primaryFeatureSlug),
    primaryComparison: getComparisonPageBySlug(primaryComparisonSlug),
    workflowTemplateSlug,
    workflowTemplate,
    nextAction: slugConfig.nextAction ?? {
      title: 'Apply this guide inside Prymal',
      description: 'Move from reading to execution with specialist agents, shared memory, and review-aware workflows.',
      primary: 'beta',
    },
    founderNote: slugConfig.founderNote ?? BLOG_FOUNDER_NOTE,
  };
}

export function getBlogRelatedPosts(post, limit = 3) {
  return BLOG_POSTS.filter((entry) => entry.slug !== post.slug)
    .map((entry) => {
      const sharedTags = entry.tags.filter((tag) => post.tags.includes(tag)).length;
      const sameCategory = entry.category === post.category ? 2 : 0;
      return { entry, score: sharedTags + sameCategory };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry }) => ({
      to: `/blog/${entry.slug}`,
      title: entry.title,
      description: entry.answer,
      cta: 'Read guide ->',
    }));
}

export function getBlogInternalLinkModules(post) {
  const featureLinks = (post.relatedFeatures ?? [])
    .map((slug) => getFeaturePageBySlug(slug))
    .filter(Boolean)
    .map((page) => ({
      to: `/features/${page.slug}`,
      title: page.title,
      description: page.answer,
      kind: 'feature',
    }));

  const comparisonLinks = (post.relatedComparisons ?? [])
    .map((slug) => getComparisonPageBySlug(slug))
    .filter(Boolean)
    .map((page) => ({
      to: `/compare/${page.slug}`,
      title: page.title,
      description: page.answer,
      kind: 'compare',
    }));

  const blogLinks = getBlogRelatedPosts(post, 2).map((item) => ({
    ...item,
    kind: 'blog',
  }));

  const inboundLinks = (post.inboundLinks ?? []).map((item) => ({
    ...item,
    kind: item.to.startsWith('/blog') ? 'blog' : item.to.startsWith('/compare') ? 'compare' : 'feature',
  }));

  return {
    features: featureLinks,
    comparisons: comparisonLinks,
    blogs: blogLinks,
    inbound: inboundLinks,
    all: [...inboundLinks, ...featureLinks, ...comparisonLinks, ...blogLinks],
  };
}

export function countBlogInternalLinks(post) {
  const urls = new Set();
  getBlogInternalLinkModules(post).all.forEach((link) => {
    if (link.to) urls.add(link.to);
  });
  (post.inboundLinks ?? []).forEach((link) => {
    if (link.to) urls.add(link.to);
  });
  return urls.size;
}

export function blogPostHasConversionSurface(post) {
  return Boolean(post.slug && BLOG_CONVERSION_BY_SLUG[post.slug]);
}
