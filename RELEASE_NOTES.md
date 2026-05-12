# Prymal v1.0.0-beta.1

## Added
- Centralized model capability registry with explicit premium, fast, structured, grounded, vision, and low-cost routing lanes.
- Runtime provider health scoring with weighted fallback ordering and a dedicated Gemini Flash-Lite bulk lane.
- SENTINEL hold explainability metadata for operator review.
- 15-agent Prymal roster for specialist commercial, operational, safety, memory, and media work.
- LORE hybrid RAG with source-backed workspace knowledge and citation-aware retrieval.
- SENTINEL QA gate for output review, repair, and held-response workflows.
- WARDEN v1+v2 safety firewall for input, tool, workflow, media, OCR, and red-team boundaries.
- Workflow catalogue with official templates and community-tier submission/review foundations.
- Founding tier billing, Stripe multi-interval plans, Teams seats, execution credits, and AI video credits.
- Guided image/video builders with Gemini Veo Lite and Standard lanes.

## Security
- WARDEN audit trail, sandboxed evidence handling, prompt-injection defenses, and workflow confirmation gates.
- OCR-derived safety text normalization and explicit untrusted-evidence tagging before downstream execution.
- Staff-only admin/operator surfaces for traces, safety events, billing, and operational review.
- Tenant-scoped routes, memory writes, LORE retrieval, workflow runs, and product events.

## Infrastructure
- Cloudinary media storage support for generated images, generated videos, and video reference images.
- Local media storage blocked by default for staging/production readiness.
- CI validation snapshot from audit: 360 backend tests passing and 95 frontend tests passing.
- Release hardening for authenticated Playwright preflight, optional VPS deploy preflight, Dependabot, lint gates, and SemVer prerelease tagging.
