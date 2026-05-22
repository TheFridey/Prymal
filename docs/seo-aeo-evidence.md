# SEO / AEO evidence

Generated: 2026-05-22

This document records the public marketing SEO and answer-engine optimisation (AEO) surface implemented in the Prymal frontend.

## Static assets

| Asset | Path | Source |
|---|---|---|
| Sitemap | `/sitemap.xml` | `frontend/scripts/generate-seo-assets.mjs` (runs on `npm run prebuild`) |
| Robots | `/robots.txt` | `frontend/public/robots.txt` |
| LLMs summary | `/llms.txt` | `frontend/scripts/generate-seo-assets.mjs` |
| Default OG image | `/og-default.svg` | `frontend/public/og-default.svg` |

Regenerate sitemap and llms.txt manually with:

```bash
cd frontend
npm run generate:seo
```

## Generated routes (31)

### Static hubs and policy pages (12)

- `https://prymal.io/`
- `https://prymal.io/features`
- `https://prymal.io/blog`
- `https://prymal.io/compare`
- `https://prymal.io/pricing`
- `https://prymal.io/trust`
- `https://prymal.io/for-agencies`
- `https://prymal.io/for-small-business`
- `https://prymal.io/changelog`
- `https://prymal.io/privacy`
- `https://prymal.io/terms`
- `https://prymal.io/cookies`

### Feature pages (6)

- `https://prymal.io/features/ai-agents`
- `https://prymal.io/features/lore-business-memory`
- `https://prymal.io/features/ai-workflow-automation`
- `https://prymal.io/features/ai-security`
- `https://prymal.io/features/ai-content-and-outreach`
- `https://prymal.io/features/ai-reporting-and-strategy`

### Blog articles (8)

- `https://prymal.io/blog/what-is-an-ai-operating-system-for-business`
- `https://prymal.io/blog/ai-agents-for-small-businesses-what-they-can-actually-do`
- `https://prymal.io/blog/why-business-ai-needs-memory-not-just-prompts`
- `https://prymal.io/blog/how-to-use-ai-safely-in-a-business`
- `https://prymal.io/blog/ai-workflow-automation-a-practical-guide-for-growing-teams`
- `https://prymal.io/blog/the-difference-between-ai-chatbots-and-ai-agents`
- `https://prymal.io/blog/how-agencies-can-use-ai-agents-to-scale-client-delivery`
- `https://prymal.io/blog/building-trust-in-ai-automation`

### Comparison pages (5)

- `https://prymal.io/compare/prymal-vs-chatgpt-for-business`
- `https://prymal.io/compare/prymal-vs-ai-chatbots`
- `https://prymal.io/compare/prymal-vs-ai-agent-platforms`
- `https://prymal.io/compare/prymal-vs-workflow-automation-tools`
- `https://prymal.io/compare/best-ai-agents-for-business`

## Metadata coverage

All public routes above use `PageMeta` (`frontend/src/components/PublicPageChrome.jsx`) for:

- Unique `<title>`
- `meta[name="description"]`
- `link[rel="canonical"]` (absolute `https://prymal.io` URLs)
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`
- Twitter: `twitter:card`, `twitter:site`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`

Shared defaults live in `frontend/src/lib/site-content.js` (`PUBLIC_OG_DEFAULTS`). Fallback OG image: `https://prymal.io/og-default.svg`.

## JSON-LD schema coverage

Helpers: `frontend/src/lib/seo.js`

| Schema type | Where applied |
|---|---|
| `SoftwareApplication` | `/` (home product schema with plan offers) |
| `WebPage` | `/`, `/pricing`, `/trust`, `/changelog`, `/for-agencies`, `/for-small-business`, `/privacy`, `/terms`, `/cookies`, each `/features/:slug`, each `/compare/:slug` |
| `CollectionPage` | `/features`, `/blog`, `/compare` |
| `FAQPage` | `/` (home FAQ), `/pricing`, `/trust`, `/for-agencies`, `/for-small-business`, feature pages with FAQ blocks, comparison pages with FAQ blocks |
| `Article` | each `/blog/:slug` (includes hero image when available) |
| `BreadcrumbList` | each `/features/:slug`, each `/blog/:slug`, each `/compare/:slug` |

## Trust and certification language

- Public copy and `/llms.txt` use **readiness** and **evidence preparation** language only.
- Prymal does **not** claim Cyber Essentials, Cyber Essentials Plus, or ISO/IEC 27001 certification unless formally achieved.
- `/trust` and trust-related FAQ schema reinforce this boundary.

## Crawl rules

`robots.txt` allows public marketing routes, disallows `/app/`, `/login/`, and `/signup/`, references the sitemap, and documents `/llms.txt` for answer-engine crawlers.

## Verification commands

```bash
cd frontend
npm run lint
npm run build
npm run perf:budget
npm test -- PublicGrowthPages.test.jsx
```

After deploy, sync the built assets to the nginx web root (production serves `/var/www/prymal`, not the repo `dist/` path directly):

```bash
cd frontend && npm run build
sudo rsync -av --delete dist/ /var/www/prymal/
sudo nginx -t && sudo systemctl reload nginx
```
