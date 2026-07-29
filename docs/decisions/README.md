# Architecture Decision Records (ADRs)

**Purpose:** Record significant architectural and product decisions with their context and rationale.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## ADR Format

```markdown
# ADR-NNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed / Accepted / Superseded / Deprecated
**Deciders:** [names or roles]

## Context
What situation prompted this decision?

## Decision
What was decided?

## Rationale
Why was this chosen over alternatives?

## Consequences
What are the positive and negative outcomes of this decision?

## Alternatives Considered
What else was evaluated?
```

---

## Decision Log

| ADR | Title | Date | Status |
|---|---|---|---|
| ADR-001 | Static HTML over framework for Phase 1 | 2026-07 | Accepted |
| ADR-002 | GitHub Pages for hosting | 2026-07 | Accepted |
| ADR-003 | Formspree for form handling | 2026-07 | Accepted |
| ADR-004 | Gumroad for digital product sales | 2026-07 | Accepted |
| ADR-005 | Document Intelligence Engine architecture | 2026-07-15 | Accepted |
| ADR-006 | Client-side only storage for Phase 1 document tools | 2026-07-15 | Accepted |
| ADR-007 | Native browser print-to-PDF over server-side PDF generation | 2026-07-15 | Accepted |
| ADR-008 | Signup bootstrap as its own reviewed migration, not buried in another | 2026-07-28 | Accepted |
| ADR-009 | Last-owner protection enforced at the database layer, not frontend-only | 2026-07-28 | Accepted |
| ADR-010 | Platform-wide soft delete strategy | 2026-07-28 | Accepted |
| ADR-011 | Single organisation membership per user (Phase 1) | 2026-07-28 | Accepted |
| ADR-012 | Profile lifecycle bound to auth.users — no independent profile deletion | 2026-07-28 | Accepted |
| ADR-013 | Organisation/profile suspension enforced at the tenant-helper layer | 2026-07-29 | Accepted |

---

## ADR-001: Static HTML over framework for Phase 1

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed a website to launch quickly with minimal infrastructure.

**Decision:** Use plain HTML/CSS/JavaScript. No React, Vue, Next.js, or similar framework.

**Rationale:**
- Fastest time to first deployment
- Zero build step, zero dependencies
- GitHub Pages hosting for free
- Future developers can read it without knowing a specific framework
- Performance is exceptional (no JS bundle)

**Consequences (+):** Simple, fast, maintainable, cheap.
**Consequences (-):** Nav and footer must be manually copied across all pages. Acceptable at 7–13 pages.

**Alternatives:** Next.js (overkill for Phase 1), 11ty (adds build step complexity without enough benefit at this scale).

---

## ADR-002: GitHub Pages for hosting

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed reliable, low-cost hosting with SSL for biksolutions.com.au.

**Decision:** Host on GitHub Pages using a feature branch.

**Rationale:** Free tier sufficient for Phase 1 traffic. Automatic SSL. Push-to-deploy. No server to manage.

**Consequences (-):** Requires repository to be public. No server-side code. Will need to migrate at Phase 2 (Vercel or Netlify for serverless functions).

---

## ADR-003: Formspree for form handling

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed a contact form and email capture without a backend.

**Decision:** Use Formspree (endpoint xojonaww) for all form submissions.

**Rationale:** Free tier handles Phase 1 volume. Simple AJAX integration. No server required.

**Consequences (-):** Form data stored third-party. Limited automation. Will migrate to own database at Phase 2.

---

## ADR-004: Gumroad for digital product sales

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed to sell digital templates (PDF/DOCX) without building payment infrastructure.

**Decision:** Use Gumroad as the digital storefront; link from BIK website.

**Rationale:** Zero setup cost. Handles payments, tax, and delivery. Trusted by Australian buyers.

**Consequences (-):** Gumroad takes a transaction fee. Brand continuity disrupted (redirects off site). Migrate to own store at Phase 3 when volume justifies it.

---

## ADR-005: Document Intelligence Engine Architecture

**Date:** 2026-07-15
**Status:** Accepted

**Context:** Multiple document generators are planned. Building each as a standalone one-off creates duplicated validation, rendering, export, and autosave logic. The first tool (Variation Notice) needed to establish the reusable pattern.

**Decision:** Build a module-based Document Intelligence Engine with a clear separation of: FormEngine (rendering/state/validation), DocumentRenderer (output), ExportManager (print/copy), Calculator (pure functions), and Analytics (stubs). Each tool supplies only a SCHEMA and a generateDocument() function.

**Rationale:**
- Adding a new tool takes 2–4 hours, not days
- Engine improvements benefit all tools immediately
- AI can be swapped in at the DocumentRenderer level without touching any tool file
- Pure calculator functions are testable in isolation
- Analytics stubs allow future tracking without rebuilding

**Consequences (+):** Highly reusable. Clean AI integration seam. Easy to test.
**Consequences (-):** Requires team to understand the engine API before contributing a new tool. Mitigated by SPEC-001 and the "Adding a New Tool" section.

**Alternatives:** Standalone per-tool implementations (rejected — duplicated logic), React/Vue component library (rejected — adds build step, breaks existing GitHub Pages deploy).

---

## ADR-006: Client-Side Only Storage for Phase 1 Document Tools

**Date:** 2026-07-15
**Status:** Accepted

**Context:** The document generators collect project-specific data (client names, project details, costs). Transmitting this to a server before user authentication and a privacy policy are in place creates compliance risk under the Privacy Act 1988.

**Decision:** All form data in Phase 1 is processed and stored client-side only. Drafts are written to localStorage on the user's device. Nothing is transmitted to BIK servers or third parties.

**Rationale:**
- Eliminates Privacy Act obligations for Phase 1
- No backend infrastructure required
- Simpler security posture — no data at rest on servers
- Consistent with the static GitHub Pages hosting model

**Consequences (+):** No privacy policy required for Phase 1. No server costs. No data breach exposure.
**Consequences (-):** Drafts can be lost if the user clears browser data. No cross-device access. Must migrate to server storage when accounts are introduced (Phase 2). The UI clearly communicates this limitation.

**User communication:** A privacy notice in the form panel explicitly states that data stays on the device. A visible "Delete saved draft" option is provided.

---

## ADR-007: Native Browser Print-to-PDF over Server-Side PDF Generation

**Date:** 2026-07-15
**Status:** Accepted

**Context:** Generated documents need to be available as PDFs for builders to share and file.

**Decision:** Use the native browser print dialog (window.print() with @media print CSS) as the PDF export mechanism for Phase 1. No server-side PDF library (Puppeteer, wkhtmltopdf, PDFKit) is introduced.

**Rationale:**
- Zero dependencies — works in all modern browsers
- No server required — consistent with static hosting
- No cost
- Print CSS gives full control over page layout and A4 formatting
- Quality is production-acceptable for business documents

**Consequences (+):** Simple, reliable, cost-free, no maintenance.
**Consequences (-):** User must select "Save as PDF" in the print dialog — one extra click. Header/toolbar content requires explicit hiding via print CSS (implemented). Cannot generate PDFs programmatically or email them automatically. Will migrate to server-side generation (e.g. Puppeteer/Playwright or a PDF API) in Phase 2 when automated delivery is required.

---

## ADR-008: Signup Bootstrap as Its Own Reviewed Migration

**Date:** 2026-07-28
**Status:** Accepted

**Context:** The Phase 1 Supabase schema (`organisations`, `profiles`, `customers`, `projects`) requires a bootstrap path that creates the first `organisations` row and the first `profiles` row (role `owner`) for a new signup, atomically, via a `SECURITY DEFINER` function or Edge Function. This need was identified while building `002_create_profiles.sql`.

**Decision:** The signup bootstrap will be its own migration, written and reviewed after the core Phase 1 tables (`001`–`004`) and RLS policies (`005`) are in place and approved — not embedded inside `002_create_profiles.sql` or any other table-creation migration.

**Rationale:**
- A `SECURITY DEFINER` function is a privilege-escalation surface — it deliberately bypasses RLS, so it deserves a migration (and a review pass) entirely of its own rather than being one clause inside a larger file.
- The bootstrap function's correctness depends on the final shape of the RLS policies it needs to satisfy (e.g. what role gets assigned, what the first profile is allowed to do immediately after creation) — designing it before 005 exists risks having to rewrite it anyway.
- Keeps each migration's diff reviewable against a single responsibility, consistent with how `001`–`004` were scoped.

**Consequences (+):** Every privilege-bypassing function in the schema is easy to locate and audit — none of them are hidden inside a table-definition migration.
**Consequences (-):** New signups cannot actually create an account until this migration lands. This is a known, tracked gap, not an oversight — flagged again in `002_create_profiles.sql`'s trailing comment block.

**Alternatives considered:** Embedding the bootstrap function in `002` (rejected — mixes table DDL with a privileged RPC, and locks in the function's logic before RLS policies exist to validate it against).

---

## ADR-009: Last-Owner Protection Enforced at the Database Layer

**Date:** 2026-07-28
**Status:** Accepted

**Context:** `profiles.role` (introduced in `002_create_profiles.sql`) allows exactly one of `owner`, `admin`, `member` per user. Nothing currently stops the last remaining `owner` of an organisation from being demoted to a lower role or deleted, which would leave an organisation with no one able to perform owner-level actions (e.g. updating `organisations`, managing other members' roles).

**Decision:** This will be prevented by a controlled, reviewed database-level mechanism — a role-management function and/or a constraint/trigger that rejects the demotion or deletion of an organisation's final active `owner` — rather than by frontend form validation alone, and rather than treating it as fully solved by the ordinary row-level-security policies added in `005_phase1_rls.sql`.

**Rationale:**
- Frontend validation only stops the official app UI; it does nothing against direct API calls, scripts, or future integrations that write to `profiles` directly.
- Standard RLS policies (an org member can update rows within their own `organisation_id`) authorise *who* can attempt a role change, but do not by themselves express the *stateful* rule "not if this is the last owner" — that needs either a `BEFORE UPDATE/DELETE` trigger or a dedicated `SECURITY DEFINER` role-change function that checks the invariant before applying it.
- This is a data-integrity invariant (an org must always have at least one owner), not just an authorisation rule, so it belongs at the database layer alongside the other constraints in this schema, not solely in application code.

**Consequences (+):** The invariant holds regardless of which client or integration performs the write.
**Consequences (-):** Adds one more piece of logic to design and test before role management ships.

**Implementation:** Built in `supabase/migrations/007_protect_last_owner.sql` as a pair of `DEFERRABLE INITIALLY DEFERRED` constraint triggers (on `organisations` and `profiles`), backed by a shared `internal.assert_organisation_has_active_owner()` function and a per-organisation `pg_advisory_xact_lock` to correctly serialise concurrent demotions, suspensions, transfers, and deletions that would otherwise race past a naive check. Being constraint triggers rather than RLS policies, they fire regardless of caller — the ordinary authenticated API, a `SECURITY DEFINER` function, `service_role` admin tooling, or direct SQL — closing exactly the gap this ADR describes. Scoped to organisations with `status = 'active'` only; see `007`'s review notes for the explicit assessment of why that scope is safe (reactivating a suspended organisation independently re-validates the invariant, and applying it unconditionally would block the legitimate suspended-organisation administration and privacy workflows ADR-010 and ADR-012 depend on). Tested in `docs/phase1-rls-test-plan.md` #46-58.

**Known limitation — transaction isolation:** this protection is correct and complete under `READ COMMITTED`, which is Postgres's default and the isolation level every PostgREST-mediated request (the entire Phase 1 client-facing API) actually runs at. It is **not** universally isolation-level independent: under an explicit `REPEATABLE READ` transaction, a transaction unblocked from the advisory lock may still be reading a stale, pre-lock snapshot, and could incorrectly permit an ownership change that leaves zero active owners. `SERIALIZABLE` remains safe (Postgres's own conflict detection aborts one transaction with a generic `40001`), just with a different, less friendly error than this migration's own message. No code path in Phase 1 opens a `REPEATABLE READ` transaction, so this is a documented constraint on future code, not a currently reachable gap. **Recommendation:** before ownership-management capability (role/status changes, organisation reactivation) is exposed more broadly — a bulk admin tool, a scripted migration, a future Edge Function — it should be routed through a single controlled RPC known to run at `READ COMMITTED` or `SERIALIZABLE` with retry handling, rather than allowing arbitrary server-side code to touch these columns directly. Identified in `docs/PHASE_1_DATABASE_REVIEW.md` (finding H2) during the Phase 1 database review; documented here, in `007`, and in the review rather than redesigned, per that review's correction pass.

**Alternatives considered:** Relying on frontend validation only (rejected — bypassable); relying on RLS policies alone (rejected — RLS authorises actors, it does not naturally express "unless this is the last one" without the same trigger/function logic RLS policies would end up duplicating).

---

## ADR-010: Platform-Wide Soft Delete Strategy

**Date:** 2026-07-28
**Status:** Accepted

**Context:** `005_phase1_rls.sql` currently grants `DELETE` to `admin`/`owner` on `customers` and `projects` — an ordinary, RLS-permitted hard delete, no different in cost from any other write. Before more tables are added (business documents, attendance, approvals), the platform needs one consistent answer to "what does deleting something mean," rather than each future migration inventing its own convention.

**Decision:**
- **Organisations** are never physically deleted through any client-facing path. `organisations.status` (001) already models this — `suspended` is the only lifecycle state short of permanent retention.
- **Projects** are never physically deleted through any client-facing path. `projects.status` (004) already includes `archived`, which is the correct terminal state — a project's document/attendance/defect history must remain queryable indefinitely.
- **Customers** are normally archived, not deleted. `customers.status` (003) already includes `archived`. A standing client-facing hard-delete grant is the exception, not the norm, and should not be routinely available.
- **Business documents** (Variation Notices, Quotes, Invoices, Site Diaries, Attendance records, and everything else in the Phase 2+ roadmap), once issued, are never hard deleted. Correction happens by superseding, voiding, or cancelling — a new state, not a removed row. This is also the only posture consistent with standard AU record-keeping expectations for financial/contractual documents (the underlying legal obligation is a business-strategy question for those specific document types, not something this ADR resolves, but "the row must still exist to be retained" is a schema precondition either way).
- **Hard deletes are reserved for:** GDPR/Privacy Act erasure requests, test/demo data cleanup, and administrator maintenance. These are performed through privileged paths that bypass RLS entirely (`service_role`, admin tooling, or a dedicated `SECURITY DEFINER` erasure function with its own audit trail) — never through a `DELETE` policy granted to `authenticated`.
- **Mechanism:** prefer the existing `status` lifecycle columns (`active`/`suspended`/`archived`, extended per-table as needed — e.g. a future `voided`/`superseded` state for documents) over introducing a separate `deleted_at` timestamp convention. Where a table's `status` enum doesn't yet capture "removed" as a state, that is what needs extending, not a parallel deletion mechanism. This keeps one lifecycle model per row instead of two independent ones that can drift out of sync.

**Rationale:**
- Matches how builders actually think about this data — a completed job or an old client isn't "gone," it's history you might need again (a repeat client three years later, a defect dispute after project completion).
- Removes an entire class of accidental/malicious data-loss incident: with no ordinary `DELETE` grant, there is no RLS policy to misconfigure or exploit into destroying a customer's project history.
- Consistent with `organisations`'s existing posture in 005 (no `DELETE` policy exists for any role, including owner) — this ADR extends that same reasoning platform-wide instead of leaving it organisation-specific.

**Consequences (+):** One deletion model to reason about, document, and test, platform-wide. Full audit/history retained by default. Lower risk of an accidental or malicious permanent data-loss incident via the ordinary API.
**Consequences (-):** `customers_delete_admin_or_owner` and `projects_delete_admin_or_owner` in `005_phase1_rls.sql`, as currently written, contradict this decision — both grant an ordinary hard-delete to `authenticated` admin/owner. This is a required follow-up correction, not yet applied: since 001-005 have not been applied to Supabase, the clean fix is to amend `005` in place (removing those two policies) rather than layering a `006` that immediately reverses part of an unapplied migration. Flagging this rather than editing an already-approved migration silently — confirm before I make the change. Storage growth is unbounded for archived rows (no retention/purge policy yet) — acceptable for Phase 1 scale, worth revisiting once real usage data exists.
**User communication:** None required for Phase 1 (no user-facing "permanently delete" action exists once this correction lands) — becomes relevant once a GDPR erasure request flow is built, at which point the privacy policy should describe what "delete my data" actually does.

**Alternatives considered:** A separate `deleted_at timestamptz` column per table (rejected for Phase 1 — duplicates what `status` already expresses, and risks the two falling out of sync, e.g. a row with `status = 'active'` and `deleted_at` set); allowing hard delete for admin/owner as a routine action (rejected — that's the status quo this ADR corrects, and puts irreversible data loss one click away from any admin-level user).

---

## ADR-011: Single Organisation Membership Per User (Phase 1)

**Date:** 2026-07-28
**Status:** Accepted

**Context:** `profiles.id = auth.users.id` (002) is a 1:1 relationship enforced by the primary key, and `public.bootstrap_organisation()` (006) refuses to create a second profile for a user who already has one. Analysis of that function's at-most-once guarantee showed this behaviour currently exists as a *byproduct* of the schema shape rather than as a stated architectural boundary — nothing on record says this is deliberate, which is exactly the condition under which someone later "fixes" it without realising what else depends on it.

**Decision:** For Phase 1, every authenticated user belongs to exactly one organisation. This is enforced by three things working together, not any single one of them in isolation:
- `profiles.id = auth.users.id` — a 1:1 extension, not a many-to-many join
- one `profiles` row per authenticated user, enforced by the primary key
- `bootstrap_organisation()` refusing to create a second profile for an already-provisioned user

Multi-organisation membership (a user belonging to more than one organisation — e.g. an accountant across several clients' BIK accounts, or a franchise owner) is intentionally deferred to a future redesign built around an `organisation_members(user_id, organisation_id, role)` join table. It is **not** something later migrations should attempt to bolt onto the current `profiles` table incrementally.

**If this architecture changes in the future, the following must be reviewed and redesigned together, not patched individually:**
- The bootstrap function (`public.bootstrap_organisation()`) — its "reject if a profile already exists" logic is the single-org assumption made concrete; multi-org support changes what "already provisioned" even means.
- The RLS helper functions (`internal.current_organisation_id()`, `internal.current_role()`) — each does a single-row lookup keyed only by `auth.uid()`. Multi-org membership means a user can have a different role in different organisations, so these functions would need a notion of "which organisation is this request acting as," which does not exist today.
- `internal.is_owner()` / `internal.is_admin()` — currently derived from the single `current_role()` lookup above; same dependency.
- Ownership protection (ADR-009, once built) — "is this the organisation's last remaining owner" only makes sense scoped per-organisation; the check must not assume a user has exactly one role to begin with.
- The audit model (`created_by`/`updated_by uuid references auth.users(id)`) — remains valid regardless of org count, but anything built on top of it that assumes "one org per audit identity" needs re-checking.
- Every tenant-isolation RLS policy on every table (`organisations`, `profiles`, `customers`, `projects`, and everything added since) — each currently assumes exactly one unambiguous `current_organisation_id()` per request.

**Rationale:** The entire Phase 1 tenant-isolation model is built on "one request, one unambiguous organisation for this user," resolved once via a single-row lookup. That simplicity is precisely what makes the RLS policies, the helper functions, and the bootstrap RPC as small and auditable as they are. Building multi-org support prematurely — or worse, extending it piecemeal later without revisiting all six items above — risks either silently breaking tenant isolation or producing an inconsistent patchwork where some tables understand multi-org membership and others don't.

**Consequences (+):** Every existing policy, helper function, and the bootstrap RPC can be reasoned about and tested (see `docs/phase1-rls-test-plan.md`) without an extra dimension of "which organisation is this for." The at-most-once bootstrap guarantee is trustworthy because it's a deliberate constraint, not an accident of the current schema shape.
**Consequences (-):** A real, plausible future product need (multi-business ownership, external bookkeepers/accountants managing several clients) cannot be supported without the redesign above. This ADR does not build that redesign — it exists so that redesign is deliberate and comprehensive when it happens, not an incremental surprise.

**Alternatives considered:** Building `organisation_members` now, ahead of any stated product need (rejected — premature complexity not on the current roadmap, adds RLS surface area and test burden with no commercial justification yet).

---

## ADR-012: Profile Lifecycle Bound to auth.users — No Independent Profile Deletion

**Date:** 2026-07-28
**Status:** Accepted

**Context:** Reviewing `bootstrap_organisation()`'s at-most-once guarantee (006) identified a procedural gap: the guarantee that a user can never successfully bootstrap twice depends entirely on a `profiles` row never being deleted independently of its `auth.users` row. `profiles.id references auth.users(id) on delete cascade` (002) means a profile is automatically removed *when* its auth identity is removed — but nothing stops a privileged process from deleting a `profiles` row on its own, via `service_role`, while leaving the `auth.users` row intact and still able to authenticate. ADR-010 explicitly permits hard deletes of `profiles` for GDPR/Privacy Act erasure requests, test-data cleanup, and administrator maintenance — exactly the kind of privileged, RLS-bypassing operation where this gap could be exercised, intentionally or by oversight.

**Decision:** `public.profiles` is not an independently managed entity. Except for the controlled bootstrap path (006), a profile's lifecycle must follow the lifecycle of its `auth.users` row. Any administrative or privacy tooling that deletes or anonymises a profile must also either:
- remove the associated `auth.users` account, or
- permanently prevent that account from authenticating again (e.g. ban/disable).

A profile must never be removed while leaving behind an active authentication identity still capable of logging in.

This is recorded as a **documented platform invariant enforced through process and code review**, not a schema-level constraint. No new trigger, check constraint, or column is added to mechanically enforce it.

**Rationale for not enforcing this in the schema:**
- Every path capable of violating this rule is already a privileged path (`service_role` or equivalent admin tooling that bypasses RLS). A trigger sitting on `public.profiles` cannot verify, in the same statement, that an equivalent action was taken against `auth.users` — that table lives in Supabase's managed `auth` schema, and this project has already chosen (in 006, using `auth.jwt()` instead of querying `auth.users` directly) to avoid reaching into that schema unnecessarily. A trigger attempting to enforce this would either be trivially bypassable by the same privileged role it's meant to constrain, or would require exactly the kind of `auth`-schema coupling this codebase has deliberately avoided elsewhere.
- The correct control for a privileged-operation risk is discipline in how that privileged operation is built and reviewed — a documented invariant that any future admin console or privacy-erasure tooling must be checked against — not a database mechanism fighting against its own trusted caller.

**Consequences (+):** The risk identified during the bootstrap review is now a named, discoverable rule in the ADR log rather than an implicit assumption that only surfaces again if someone happens to re-derive it. Any future GDPR-erasure feature, admin console, or data-cleanup script has a clear, explicit requirement to satisfy and can be reviewed against it directly.
**Consequences (-):** The invariant is not mechanically enforced. A careless or rushed admin script could still violate it, and the database will not stop that — this is an accepted risk, consistent with other privileged-path trust boundaries already present in this schema (e.g. `organisations` has no `DELETE` policy for any client role at all; deletion there is likewise a fully trusted, out-of-band operation).

**Alternatives considered:** A trigger on `profiles` requiring some precondition before allowing `DELETE` (rejected — the same privileged caller the trigger would need to trust to set that precondition is the caller the trigger is meant to constrain, so it adds complexity without adding real protection, and cannot itself verify state in the separate `auth` schema); disabling hard deletes of `profiles` entirely (rejected — contradicts ADR-010 and the underlying Privacy Act erasure obligation, which requires an actual deletion capability to exist somewhere in the system).

---

## ADR-013: Organisation/Profile Suspension Enforced at the Tenant-Helper Layer

**Date:** 2026-07-29
**Status:** Accepted

**Context:** The Phase 1 database review (`docs/PHASE_1_DATABASE_REVIEW.md`, finding H1) identified that `organisations.status`/`profiles.status = 'suspended'` had no enforced effect anywhere in the schema — `internal.current_organisation_id()`/`current_role()` (`005`) looked up a caller's row by `id = auth.uid()` alone, and every tenant-isolation policy scoped only by `organisation_id = current_organisation_id()`. A suspended member, or any member of a suspended organisation, retained full ordinary read/write access. Separately, the self-escalation trigger guarded `role`/`organisation_id` but not `status`, so a suspended user could reverse their own suspension.

**Decision:** For Phase 1: **a user may access operational data only when both their profile and their organisation are `status = 'active'`.** This is enforced in exactly one place — `internal.current_organisation_id()` and `internal.current_role()` now join `profiles` to `organisations` and require both to be `active`, returning `NULL` otherwise. Every existing tenant-isolation policy inherits this automatically, since all of them are already built on these two functions rather than checking `status` individually. `prevent_unauthorised_profile_role_change()` was separately extended to also guard `status`, closing the self-reversal path.

**Consequence accepted deliberately:** once an organisation is suspended, `current_organisation_id()` returns `NULL` for every one of its members, **including its owner** — so `organisations_update_owner_only` (which depends on the same function) can no longer be used to reactivate it through the ordinary client API. A suspended organisation cannot be reactivated by anyone through the normal tenant-scoped API, by design. This is judged safer than the alternative (a carve-out that would let a suspended owner reactivate their own organisation through the same path being restricted, which would make the suspension trivially self-reversible in exactly the way the profile-level version of this problem was).

**Recovery path (documented requirement, not built in this correction):** reactivating a suspended organisation requires either:
- a dedicated, carefully reviewed `SECURITY DEFINER` recovery RPC (following the same pattern and scrutiny as `bootstrap_organisation()`, ADR-008), or
- direct `service_role` administration.

Neither is built as part of this decision. Building the recovery RPC prematurely — before its authorisation model (who may invoke it, what evidence of legitimate recovery it requires) is properly designed — risks recreating exactly the kind of privilege-bypassing surface ADR-008 insisted be reviewed in isolation. This is recorded here as a required future capability, not an oversight.

**Rationale:**
- A `suspended` status with no access consequence is actively misleading — it looks like a safety control while providing none, which is worse than having no such field at all.
- Filtering at the two shared helper functions, rather than adding `AND status = 'active'` checks to each of the ten individual policies, means every current and future policy that scopes by `current_organisation_id()`/`current_role()` inherits the restriction automatically — there is exactly one place to get this right, not ten (or more, as new tables are added).
- Locking out even the owner of a suspended organisation is consistent with treating suspension as a genuine administrative action, not something reversible by the party it was applied to.

**Consequences (+):** Suspension now does what its name implies. No policy needs to be individually re-audited as new tables are added — the enforcement point is structural, not per-policy. Consistent with ADR-012's requirement that privileged, RLS-bypassing operations (which recovery necessarily is) be deliberately designed, not improvised.
**Consequences (-):** No self-service recovery path exists yet for a legitimately-suspended organisation that should be reinstated — this is an accepted, temporary gap until the recovery RPC is designed. `007`'s last-owner protection required no changes: `internal.assert_organisation_has_active_owner()` queries `organisations`/`profiles` directly by parameter, not through the now-filtered helper functions, so this decision has no effect on that invariant (confirmed during the correction pass, not merely assumed).

**Alternatives considered:** Leaving `status` as informational only, documented as such (rejected — a documented-but-inert safety field is worse than no field, since it invites false confidence); adding `status = 'active'` checks to each policy individually (rejected — duplicates the check across every current and future policy instead of centralising it once); allowing a suspended owner to reactivate their own organisation through the ordinary API (rejected — makes suspension trivially self-reversible by the party being suspended, defeating its purpose).
