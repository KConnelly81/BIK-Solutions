# Sprint 6 Proposal — Secure Supabase AI Edge Function

**Status:** Proposal only. **Not started.** No implementation work has begun; this document exists
to be reviewed and either approved, amended, or rejected before any code is written.
**Owner:** BIK Solutions Pty Ltd
**Depends on:** Sprint 5 (closed — `docs/RELEASE_v0.5.0_SPRINT5.md`)
**Relationship to the confirmed product direction** (2026-08 — `docs/business-strategy.md`, "AI
Direction — AI Contract Manager"): this sprint is infrastructure only — a session-authenticated
backend for AI calls. It is the *prerequisite* for the long-term AI Contract Manager vision
(proactive flagging of overdue variations, missing paperwork, at-risk projects), not that feature
itself — proactive insight generation needs its own, later proposal, and needs a backend that
already knows which organisation is asking. Scope here stays limited to the migration described
below; do not read this document as committing to the proactive-AI feature set.

---

## Current state (verified against the actual code, not assumed)

The AI Professional Writer (`js/toolkit/ai-writer.js`) does **not** call Anthropic directly from
the browser today, and does **not** store an API key client-side — that model was already retired
before this session began. The current flow is:

```
browser (AIWriter._callProxy) → Cloudflare Worker (bik-ai-proxy.biksolutions.workers.dev) → Anthropic API
```

The Worker holds the real Anthropic API key; the browser only ever sends `{ model, max_tokens,
system, messages }` as a plain JSON `POST`, no `Authorization` header at all. `ai-writer-ui.js`'s
`showAIKeyModal()` and `ai-writer.js`'s `getKey()`/`setKey()`/`hasKey()`/`clearKey()` are confirmed
retired no-ops, kept only for callers that haven't been cleaned up yet — not a live risk.

**The actual gap, already flagged in the code's own comment** (`ai-writer.js`, line 130-133):

> `AI_WRITING_ENGINE_INTEGRATION_POINT` — Calls the BIK AI proxy. No API key required here — the
> Worker holds it. **In a future authenticated version, add a session token to the headers.**

The Worker endpoint is unauthenticated. Anyone who discovers the URL (trivial — it's a plain
constant in a public JS file served to every visitor) can call it directly and consume the
account's Anthropic budget, with:
- no attribution to a BIK organisation or user,
- no per-organisation rate limiting or usage tracking,
- no way to revoke AI access for one organisation (suspended account, abuse, free-tier limit)
  without redeploying the Worker for everyone,
- no connection to the RLS/organisation model every other backend interaction in this app already
  uses.

This is a real, live gap — not a hypothetical one — but it is a **cost-control and attribution**
gap, not a credential-exposure one (the Anthropic key itself has never been reachable from the
browser since the Cloudflare Worker was introduced).

## Goal

Replace the unauthenticated Cloudflare Worker with a **Supabase Edge Function**, requiring the
caller's existing Supabase session (the same JWT already sent on every other Supabase call from an
authenticated tool page), so AI usage is:
- attributable to `auth.uid()` / the caller's `organisation_id`,
- rate-limitable per organisation (not just globally),
- revocable per organisation without a full redeploy,
- on one platform instead of two, removing Cloudflare as a second system holding a production
  secret and a second place `wrangler deploy` has to be remembered.

**Explicitly not a goal of this sprint:** changing what the AI does, its system prompts, its
output format, or which tools use it. This is an infrastructure swap only, mirroring how Sprint 4
was infrastructure-only for the tool-integration pattern before Sprint 5 built on top of it.

## Proposed design

- **New Edge Function** (`supabase/functions/ai-writer/index.ts` or similar — exact path TBD at
  implementation time) — receives the same `{ mode, text, context }` shape the frontend already
  sends (not the raw Anthropic request shape the Worker currently forwards; the function should own
  the system-prompt selection server-side, matching `ai-writer.js`'s current `SYSTEM_PROMPTS`
  table, so the actual prompt content is never client-suppliable — currently the *system prompt
  key* is chosen client-side but the prompt text itself already lives only in `ai-writer.js`, which
  ships to the browser; moving prompt selection server-side closes a second gap for free: today a
  motivated user could read the full prompt text directly from the shipped JS, which may or may not
  matter depending on how much of that wording is considered proprietary).
- **Auth**: requires a valid Supabase session (`Authorization: Bearer <access_token>`), verified
  the same way every RLS-protected table already is — via the Supabase client's own session, not a
  bespoke check. Rejects an unauthenticated request outright (no organisation to attribute or rate-
  limit against).
- **Rate limiting / usage tracking**: a new `internal.ai_usage` table (organisation-scoped, one row
  per request or an aggregated counter — exact shape needs its own design pass, likely mirroring
  the `internal.*_counters` pattern already proven three times this sprint) so a per-organisation
  daily/monthly cap can be enforced server-side, not just hoped for.
  **This is new schema and needs its own migration review**, following the same
  `docs/BACKEND_MIGRATION_CHECKLIST.md` process every table this sprint went through — not
  something to bolt on without review just because the pattern is now familiar.
  **Simplest reasonable increment**: no cap at all, tracking only — start recording usage without
  enforcing a limit, use the real data to decide what caps make sense before writing the limiting
  logic. Ship attribution/tracking before enforcement, not both at once.
- **Anthropic key**: stored as a Supabase Edge Function secret (`supabase secrets set`), never in
  the repo, never in the browser — same posture as the Cloudflare Worker today, just relocated.
- **Frontend change**: `ai-writer.js`'s `_callProxy()` points at the new Supabase Edge Function URL
  and adds the session token to the request headers (the session is already available everywhere
  `AIWriter` is used, via the same `js/supabase/session.js` every gated tool page already imports —
  this is not a new capability to build, just a new place to read from).

## Migration plan (proposed, not executed)

1. Design review of the `internal.ai_usage` schema (or equivalent) before writing any migration —
   same rigor as `012`-`017`, not skipped because the pattern feels familiar now.
2. Build and deploy the new Edge Function **alongside** the existing Cloudflare Worker — both live
   simultaneously, nothing cut over yet.
3. Point one tool's `AIWriter` calls at the new endpoint behind a feature flag or a single
   hard-coded pilot (mirroring how Sprint 3 piloted the Supabase project model on Variation Notice
   alone before Sprint 5 generalised it to two more tools) — verify live before touching every
   caller.
4. Cut every remaining `AIWriter` caller over once the pilot is confirmed working in production.
5. Retire the Cloudflare Worker only after every caller is confirmed migrated and a reasonable
   soak period has passed — not deleted same-day as the cutover.

## Testing plan (proposed)

- Unit tests for any new pure logic (rate-limit/usage-tracking calculations, request validation) —
  same standard as every `*-save-logic.js` this sprint.
- Local dry-run of the new migration (if `internal.ai_usage` is built) via the existing
  `supabase/local-test/` harness before live application.
- Manual browser verification: AI assist still produces correct output for at least one mode on at
  least one migrated tool, an unauthenticated direct call to the new endpoint is correctly
  rejected, and a second organisation's usage does not affect the first's (if a cap is
  implemented).

## Rollback plan (proposed)

Frontend: revert `ai-writer.js`'s endpoint change — the Cloudflare Worker stays live and
functioning throughout the migration window specifically so this stays a same-day, low-risk
revert. Backend: any new `internal.ai_usage` table can be dropped independently, since (by design)
no other feature would depend on it.

## Explicit boundary

**Do not begin this implementation automatically.** This document is the proposal only. Next step
is explicit go-ahead, at which point this sprint should follow the same review cadence as Sprint 5:
a design pass before any migration is written, local dry-run before live application, live
verification with disposable data before frontend cutover, and a manual acceptance pass before
merge.
