# WARDEN Safety Firewall

WARDEN is Prymal's input-side safety subsystem. SENTINEL remains the final output QA layer, while WARDEN prevents unsafe or manipulative input from becoming trusted instructions before it reaches LORE, agents, workflows, media generation, or tool execution.

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

The decision includes risk level, categories, reasons, redactions, trust score, permissions, and a `wardenAuditId`.

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

Image and video prompts are scanned before provider calls. WARDEN blocks requests involving:

- sexual content involving minors or young-looking people
- non-consensual sexual imagery
- hateful or extremist propaganda
- realistic illegal harm facilitation
- jailbreaks and requests to follow OCR instructions from images

Provider-side safety rejections are recorded as WARDEN audit events and returned as clean user-facing refusals.

## Tool Safety

Tool calls are risk-ranked:

- LOW: retrieval and read-only search
- MEDIUM: external requests and drafts
- HIGH: emails, workflow execution, external posting, writes, deletion
- CRITICAL: billing, admin, permissions, export, secrets, env access

Retrieved or external content cannot directly trigger non-read-only tools. Critical actions always require confirmation and admin permission.

## Audit Table

WARDEN stores audit records in `warden_audit_event`.

The table stores hashes, categories, reasons, source metadata, tool names, and provider labels. It does not store full unsafe content.

## Env Flags

- `WARDEN_ENABLED=true`
- `WARDEN_STRICT_MODE=false`
- `WARDEN_MAX_CONTENT_CHARS=500000`
- `WARDEN_MAX_URL_TEXT_CHARS=240000`
- `WARDEN_AUDIT_EXCERPT_CHARS=500`
- `WARDEN_MEDIA_SAFETY_STRICTNESS=standard`

## Adding New Surfaces

New features should call the relevant WARDEN helper before passing user-provided or external content into a privileged surface.

Use:

- `scanPastedContent`
- `prepareUrlContentForLore`
- `prepareUploadForLore`
- `scanMediaPrompt`
- `scanToolRequest`
- `formatUntrustedEvidenceBlock`
