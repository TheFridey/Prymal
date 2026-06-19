# Prymal — AI Visibility, SEO, Crawlability & Indexability Report

_Last updated: June 2026_

This report documents the hardening pass that moved Prymal's public marketing site from
client-side-only rendering to build-time static prerendering, plus the supporting SEO, schema,
sitemap, `llms.txt`, and content changes.

## Problem statement

Prymal is a Vite + React SPA. Before this pass, every public URL served the **same** near-empty
`index.html` shell — a generic title/description and an empty `<div id="root">`. All page-specific
metadata, JSON-LD, headings, and body copy were injected **after** hydration by React effects.

Consequences:
- Google Search Console reported ~58 URLs as **"Discovered – currently not indexed."**
- AI answer engines (ChatGPT, Perplexity, Gemini, Claude), which largely do not execute JS, saw
  no citable content.
- Every URL looked byte-identical in source, suppressing crawl priority.

## What changed

### 1. Static prerendering (build-time, headless)
- New [scripts/prerender.mjs](scripts/prerender.mjs): after `vite build`, a local static server +
  headless Chromium (Playwright) render every public route and snapshot the fully-hydrated HTML
  (title, meta, canonical, OpenGraph/Twitter, JSON-LD, headings, body) to `dist/<route>/index.html`.
- Wired as `postbuild` in [package.json](package.json); runs automatically on production builds.
- Detects the Clerk setup-gate (placeholder key) and **skips cleanly** so CI stays green; production
  builds carry the real key and prerender fully.
- [Dockerfile](Dockerfile) builder stage moved to `node:20-bookworm-slim` + `playwright install
  chromium`; runner image unchanged (`nginx:alpine`).
- The SPA still boots over the baked markup (`createRoot`), so runtime behavior is unchanged and
  there is no hydration-mismatch risk.
- nginx `try_files $uri $uri/ /index.html` serves the per-route files automatically — no nginx change.

### 2. Metadata & 3. JSON-LD in source HTML
Because the snapshot captures the live React + effect output, every prerendered page now carries
unique title, meta description, canonical, OpenGraph, Twitter tags, **and** JSON-LD directly in
source HTML. Schema types in use: `SoftwareApplication`, `Organization`, `WebSite`, `WebPage`,
`FAQPage`, `BreadcrumbList`, `Article`, `CollectionPage`.

### 4. Indexability audit (findings & fixes)
| Check | Finding | Action |
|---|---|---|
| OG image | `og-default.svg` — Google/social/AI do not render SVG OG images, but width/height claimed 1200×630 | Generate real `og-default.png` (1200×630) via `sharp`; references updated in `index.html` + `seo.js` |
| noindex | Only `NotFoundPage` sets `noindex,follow` (correct) | No change; verified no public route inherits it |
| Canonical | `PageMeta` builds absolute self-referential canonicals | Verified in prerendered output |
| Redirects | `_redirects` is single-hop www→apex + SPA rewrites | No chains; nginx serves prerendered files directly |
| Orphans | SEO-growth, use-case, and agent routes reachable via nav/footer/related links | Agent pages added to sitemap; related-link clusters added |
| robots.txt | AI bots allowed | Added `ClaudeBot`, `Claude-Web`, `Applebot-Extended` allow blocks |

### 5. Sitemap improvements
- Single source of truth: [scripts/lib/public-routes.mjs](scripts/lib/public-routes.mjs) feeds both
  the sitemap and the prerender set.
- **Agent pages (`/agents/*`) now included** (15 routes), taking the sitemap from 67 → 82 URLs.
- `lastmod` derived from real `updatedAt`/`publishedAt` where present, build date otherwise.

### 6. llms.txt expansion
Expanded to include: product definition, **core building blocks** (agents/LORE/NEXUS/WARDEN/SENTINEL),
the full **specialist agent roster**, trust model, comparison references, use-case references, top
blog references, the full route map, and preferred-citation pages — structured for AI-crawler
comprehension.

### 7–10. Content: entity reinforcement, freshness, internal linking, crawl budget
- New shared components in [PublicContent.jsx](src/components/PublicContent.jsx): `EntityDefinition`
  (states "Prymal is an AI operating system for business execution…" in the first ~200 words),
  `PageFreshness` ("Last updated: <Month YYYY>"), and `RelatedResources` (contextual link grid).
- Applied to feature, comparison, pricing, trust, features-hub, and compare-hub pages. `dateModified`
  added to `WebPage` schema (incl. for-agencies / for-small-business).
- Internal linking: feature & comparison pages now render a ≥6-link contextual cluster via
  `SEO_RELATED_LINKS`; blog posts (`BlogInternalLinks` + `BlogRelatedReading`) and use-case pages
  (`relatedPages` grid) already satisfied ≥3 contextual links.
- Crawl budget: heavy bundles (`vendor-three`, `vendor-workflow`/reactflow) remain lazy and excluded
  from `modulePreload` ([vite.config.js](vite.config.js)); marketing content is now in source HTML
  immediately.

## Scorecard (before → after)

| Dimension | Before | After | Notes |
|---|---:|---:|---|
| Indexability | 35 | 95 | Unique, content-rich source HTML per route; agents in sitemap |
| AI visibility | 30 | 92 | Content + JSON-LD readable without JS; expanded llms.txt; AI-bot allows |
| Crawlability | 50 | 95 | Prerendered files served directly; no redirect chains; clean robots |
| Schema coverage | 60 | 95 | 8 schema types now in source HTML, incl. dateModified |
| Technical SEO | 55 | 92 | Real PNG OG image, canonicals, freshness signals, internal clusters |

_Scores are a qualitative 0–100 self-assessment against the success criteria, not a third-party
metric. "Before" reflects client-side-only rendering._

## Verification evidence

**Prerender run:** `82 rendered, 0 errored`, clean exit (`REALEXIT=0`), no leftover Chromium.

**Source-HTML proof (no JavaScript executed — read directly from `dist/<route>/index.html`):**

| Route | Title | Canonical | JSON-LD types in source | "Prymal is…" |
|---|---|---|---|---|
| `/` | unique | self-ref | SoftwareApplication, WebSite, WebPage, FAQPage | ✓ |
| `/features/ai-agents` | unique | self-ref | + BreadcrumbList | ✓ |
| `/compare/prymal-vs-lindy` | unique | self-ref | + BreadcrumbList | ✓ |
| `/blog/building-trust-in-ai-automation` | unique | self-ref | + Article, ImageObject, Organization, Person, BreadcrumbList | ✓ |
| `/use-cases/ai-for-marketing-agencies` | unique | self-ref | + BreadcrumbList, Organization | ✓ |
| `/agents/sentinel` | unique | self-ref | SoftwareApplication, WebSite, WebPage, FAQPage | ✓ |
| `/pricing` | unique | self-ref | SoftwareApplication, WebSite, WebPage, FAQPage | ✓ |

All 7 required schema types appear in source HTML across the site: **SoftwareApplication,
Organization, WebSite, WebPage, FAQPage, BreadcrumbList, Article**. Freshness ("Last updated:
June 2026" with `<time datetime>`), contextual related-link clusters, OG/Twitter tags, and the
real `og-default.png` are all present in source. No `og-default.svg` references remain in any
generated HTML.

**Tests/lint:** SEO-touching unit tests pass (PublicContent, Trust, PublicGrowthPages, App = 23/23);
full suite 187/188. The one failing test and the one lint error are both in
`src/features/workspace/chat/renderers.jsx` — an unrelated workspace-chat file not modified by this
pass and already failing beforehand.

**Sitemap:** 82 URLs (was 67) including `/agents/*`; well-formed XML.

## Residual recommendations
- Set `VITE_CLERK_PUBLISHABLE_KEY_TEST` in CI so CI also prerenders (otherwise CI ships the shell).
- After deploy, request indexing for key URLs in Google Search Console and resubmit the sitemap.
- Consider per-page bespoke OG images for top comparison/feature pages.
- Add `Article` `author`/`Person` enrichment and review `SoftwareApplication` `offers` once public
  pricing numbers are finalized.
