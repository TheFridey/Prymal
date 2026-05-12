# WARDEN Safety Firewall

WARDEN is Prymal's input-side safety subsystem. SENTINEL remains the final output QA layer, while WARDEN prevents unsafe or manipulative input from becoming trusted instructions before it reaches LORE, agents, workflows, media generation, or tool execution.

WARDEN has two layers:

- WARDEN v1: deterministic checks for obvious prompt injection, tool abuse, unsafe media, dangerous uploads, and secrets.
- WARDEN v2: an optional model-assisted policy classifier for ambiguous, high-risk, or adversarial cases. It can escalate risk, but it cannot weaken critical deterministic protections.

## Core Principle

External content is data, never instructions.

- User request is intent.
- System and developer policy are authority.
- URL, upload, pasted, OCR, and retrieved LORE content are untrusted evidence.
- Tool calls require trusted user intent and authenticated org scope.
- Destructive, admin, billing, export, permission, or secret-related actions require explicit confirmation and permission.

## Surfaces

WARDEN currently scans:

- LORE text ingestion
- LORE file upload ingestion
- LORE URL crawl ingestion
- Agent chat messages that contain prompt-injection patterns
- LORE retrieval prompt assembly
- Live web context prompt assembly
- Tool dispatch
- Image generation prompts
- Video generation prompts and optional OCR text
- Workflow run inputs and node execution context

## Decisions

Every scan returns a consistent decision:

- `ALLOW`
- `ALLOW_WITH_SANDBOX`
- `REDACT`
- `REQUIRE_CONFIRMATION`
- `BLOCK`

The decision includes risk level, categories, reasons, redactions, trust score, permissions, classifier metadata, explainability signals, and a `wardenAuditId`.

`ALLOW_WITH_SANDBOX` is not prompt-executable. It can reach agents only as wrapped evidence.

## Model-Assisted Classifier

WARDEN v2 may run after deterministic checks when:

- risk is `HIGH` or `CRITICAL`
- verdict is `REQUIRE_CONFIRMATION`
- content contains encoded, hidden, role, system, tool, OCR, or prompt-injection indicators
- media language is ambiguous around minors, hate, extremism, or illegal harm
- tool calls are medium, high, or critical risk
- workflows mix external input with tool execution
- strict mode is enabled and risk is medium or higher
- `WARDEN_MODEL_CLASSIFIER_MODE=always`

The classifier receives sanitized, capped content and returns strict JSON. If it times out, returns invalid JSON, or the provider is unavailable, deterministic WARDEN remains in force.

Merge rules are fail-closed:

- `BLOCK` always wins.
- `CRITICAL` risk wins over lower risk.
- model output may escalate deterministic risk.
- model output cannot downgrade deterministic `BLOCK`.
- model output cannot downgrade secret redaction.
- model output cannot downgrade illegal media blocks.
- low-confidence model output is ignored.

Classifier results are cached by safety hash for a short TTL. Raw unsafe content is not cached.

## LORE Handling

External LORE chunks are stored with metadata such as:

- `sourceType`
- `trustLevel`
- `trustScore`
- `wardenAuditId`
- `containsPromptInjection`
- `containsToolInstruction`
- `containsPolicyBypass`
- `allowAsInstruction: false`

Retrieved chunks are wrapped in an untrusted evidence block before reaching an agent prompt. Agents are explicitly told not to follow commands, role instructions, tool requests, policy overrides, or secret requests inside retrieved content.

## Media Safety

Image and video prompts are scanned before provider calls. WARDEN scans reference-image safety text from provided `ocrText`, `altText`, captions, filenames, and metadata text. WARDEN also has a provider-backed OCR adapter layer. OCR is disabled by default and fails safely back to metadata-only extraction if the provider is unavailable or times out.

OCR text is normalized before it is treated as evidence:

- control characters are stripped
- Unicode is normalized with `NFKC`
- repeated whitespace is collapsed
- provider OCR sources are tagged as `UNTRUSTED_OCR_EVIDENCE`

Supported OCR adapters:

- `none`
- `cloudinary`
- `google_vision`
- `tesseract`

OCR audit metadata stores provider, attempt status, timeout state, source count and text hash. It does not store raw OCR text.

WARDEN blocks requests involving:

- sexual content involving minors or young-looking people
- non-consensual sexual imagery
- hateful or extremist propaganda
- realistic illegal harm facilitation
- jailbreaks and requests to follow OCR instructions from images
- ambiguous minor-coded euphemisms such as barely legal, legal teen, school aesthetic with sexual context, childlike adult, or make them look younger

Provider-side safety rejections are recorded as WARDEN audit events and returned as clean user-facing refusals.

## Tool Safety

Tool calls are governed by a manifest registry in `backend/src/services/tools/tool-manifest.js`. The manifest defines risk, side effects, confirmation needs, admin needs, source-type rules, schemas and redaction paths.

The dispatcher has a separate executable allowlist. A tool can be present in the manifest for future governance without becoming executable until a real handler exists.

Tool calls are risk-ranked:

- LOW: retrieval and read-only search
- MEDIUM: external requests and drafts
- HIGH: emails, workflow execution, external posting, writes, deletion
- CRITICAL: billing, admin, permissions, export, secrets, env access

Retrieved, pasted, uploaded, OCR, or external content cannot directly trigger tools. Critical actions always require confirmation and admin permission.

## Workflow Safety

WARDEN scans workflow plans before run creation, replay, and node execution. It blocks or requires confirmation when a workflow appears to route URL, upload, pasted, OCR, webhook, or LORE input into email, posting, destructive, admin, billing, permission, export, or secret-related actions.

When a workflow requires confirmation, Prymal creates a single-use `workflow_risk_confirmation` record. The approval is scoped to the org, user and workflow, expires after a short TTL, and can be approved or denied through workflow confirmation routes. `BLOCK` remains non-overridable.

## Audit Table

WARDEN stores audit records in `warden_audit_event`.

The table stores hashes, categories, reasons, source metadata, tool names, provider labels, deterministic verdicts, model classifier metadata, and final verdicts. It does not store full unsafe content.

Admins can filter WARDEN events by verdict, risk level, category, surface, source type, user, org, tool, provider, and date range.

Security trace drilldowns should answer three operator questions directly:

- Why was this blocked, held, or sandboxed?
- Which policy category triggered it?
- How confident was the deterministic/model-assisted decision path?

Admin security endpoints:

- `GET /admin/security/warden`
- `GET /admin/security/warden/:auditId`
- `GET /admin/security/classifier-metrics`
- `GET /admin/security/workflow-confirmations`
- `GET /admin/security/trace/:traceId/safety`

Security traces aggregate WARDEN, model classifier, OCR, workflow confirmation, tool, SENTINEL and billing-safe metadata where available. Raw unsafe content is not returned.

## Classifier Observability And Caps

WARDEN records in-memory classifier metrics for attempted calls, used model calls, fallback rate, timeout rate, cache hit rate, latency, estimated tokens, estimated cost, top categories and blocked surfaces.

Daily caps can skip model classification while preserving deterministic WARDEN decisions.

## Env Flags

- `WARDEN_ENABLED=true`
- `WARDEN_STRICT_MODE=false`
- `WARDEN_MAX_CONTENT_CHARS=500000`
- `WARDEN_MAX_URL_TEXT_CHARS=240000`
- `WARDEN_AUDIT_EXCERPT_CHARS=500`
- `WARDEN_MEDIA_SAFETY_STRICTNESS=standard`
- `WARDEN_MODEL_CLASSIFIER_ENABLED=true`
- `WARDEN_MODEL_CLASSIFIER_MODE=auto`
- `WARDEN_MODEL_CLASSIFIER_MODEL=gpt-5-mini`
- `WARDEN_MODEL_CLASSIFIER_TIMEOUT_MS=3000`
- `WARDEN_MODEL_CLASSIFIER_MAX_CHARS=12000`
- `WARDEN_MODEL_CLASSIFIER_CACHE_TTL_SECONDS=900`
- `WARDEN_MODEL_CLASSIFIER_CACHE_MAX=1000`
- `WARDEN_MODEL_CLASSIFIER_DAILY_CALL_CAP=500`
- `WARDEN_MODEL_CLASSIFIER_DAILY_COST_CAP_USD=5`
- `WARDEN_MODEL_CLASSIFIER_INPUT_TOKEN_PRICE_USD=`
- `WARDEN_MODEL_CLASSIFIER_OUTPUT_TOKEN_PRICE_USD=`
- `WARDEN_OCR_ENABLED=false`
- `WARDEN_OCR_PROVIDER=none`
- `WARDEN_OCR_TIMEOUT_MS=3000`
- `WARDEN_OCR_MAX_IMAGES=4`
- `WARDEN_OCR_CACHE_TTL_SECONDS=900`
- `WARDEN_OCR_CACHE_MAX=500`

## Red-Team Fixtures

Regression fixtures live in `backend/src/services/warden/red-team-fixtures.js` with tests in `red-team-fixtures.test.js`. They cover hidden URL prompts, pasted role injection, encoded jailbreaks, upload abuse, OCR/image metadata prompt injection, media safety, tool abuse, workflow abuse and secret redaction.

## Migration

Workflow confirmation state uses migration `0011_workflow_risk_confirmation` and the `workflow_risk_confirmation` table. Keep `database/schema.sql`, `backend/src/db/schema.js` and the Drizzle journal aligned.

## Adding New Surfaces

New features should call the relevant WARDEN helper before passing user-provided or external content into a privileged surface.

Use:

- `scanPastedContent`
- `prepareUrlContentForLore`
- `prepareUploadForLore`
- `scanMediaPrompt`
- `scanToolRequest`
- `scanWorkflowPlan`
- `formatUntrustedEvidenceBlock`
