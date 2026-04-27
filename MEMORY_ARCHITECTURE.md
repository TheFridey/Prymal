# Prymal memory architecture (April 2026)

This document describes how structured agent memory fits together after the Memory Centre upgrade. It complements existing LO/RAG (`lore_chunks`), billing, and agent contracts — it does not replace them.

## Layers

1. **Durable facts (`agent_memory`)** — Org/user/agent/session/workflow scoped rows with provenance, scores, visibility, and lifecycle status (`memory_item_status`).
2. **Episodic timeline (`memory_events`)** — Human-readable events (writes, contradictions, promotions) for “what happened today” UX.
3. **Contradiction groups (`memory_contradiction_groups`)** — Groups conflicting memories so neither side is silently overwritten.
4. **Retrieval traces (`memory_retrieval_traces`)** — Optional audit rows capturing policy snapshot + ranked envelopes per turn.

## TTL

- **temporary_session**: default TTL from chat extraction uses `MEMORY_SESSION_TTL_HOURS`; pruner still removes expired rows.
- **workflow_run**: when `expires_at` is omitted on write, the API sets it using `MEMORY_WORKFLOW_TTL_HOURS` (default 168h).

## Policies

`getMemoryPolicyForAgent(agentId)` merges defaults with `AGENT_CONTRACTS[agent].memoryPolicy` and small per-agent overrides in `memory-policies.js`. Retrieval ranking lives in `memory-retrieval.js` and runs before prompt injection.

## Safety

`reviewMemoryCandidate()` gates writes inside `upsertMemory`. Critical-risk patterns are rejected outright; high-risk rows become `pending_review` where appropriate.

## Assumptions

- Existing rows gain safe defaults via migration (`memory_item_status = active`, `content` backfilled from `value`).
- Full semantic contradiction detection can be expanded later; current overlap uses lexical Jaccard-style similarity in `memory-contradictions.js`.
