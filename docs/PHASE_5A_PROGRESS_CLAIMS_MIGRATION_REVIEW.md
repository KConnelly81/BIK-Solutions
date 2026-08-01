# Migration 013 Review — `public.progress_claims` / `public.progress_claim_line_items`

**UPDATE (restructure round):** the single `013` this review was written against has been split
into three layered migrations — `015_create_progress_claims.sql` (core),
`016_create_progress_claim_numbering.sql`, `017_create_progress_claim_issue_workflow.sql` (still
**BLOCKED**) — see `docs/PHASE_5A_DESIGN_PROPOSAL.md` §12 for the layering and §13 for the
`SECURITY DEFINER` audit. Several facts below are now **superseded**: the status enum gained
`'archived'`; a new interim constraint (`remaining_value_cents >= 0`) now prevents overclaiming at
the core layer, not just at issue time; `previously_claimed_cents` derivation moved out of the
numbering layer into its own non-`DEFINER` trigger in the core layer. The rest of this document
(GST/retention analysis, the five external questions, the temporary-gate reasoning) is unchanged
in substance — see `docs/PHASE_5A_DESIGN_PROPOSAL.md` for the authoritative current file names
and requirements.
**Migration files:** `015_create_progress_claims.sql` / `016_create_progress_claim_numbering.sql`
/ `017_create_progress_claim_issue_workflow.sql` — **`017` BLOCKED** (draft, **not applied**)
**Status:** Reviewed in isolation from Quotes per request. Verdict at the end.
**Companion:** `docs/PHASE_5A_DESIGN_PROPOSAL.md` (full design history), `docs/PHASE_5A_QUOTES_MIGRATION_REVIEW.md`.

---

## Tables and relationships

- **`public.progress_claims`** — one row per claim. `organisation_id`/`project_id` both
  `NOT NULL`, `ON DELETE RESTRICT`.
- **`public.progress_claim_line_items`** — the structured schedule of values, replacing the old
  tool's freeform textarea. `progress_claim_id NOT NULL`, `ON DELETE CASCADE` (same reasoning as
  Quotes — a draft's own working rows).

Same tenancy pattern as Quotes: no `organisation_id` on the line-item table, enforced through the
join.

## Every status value

`check (status in ('draft', 'issued', 'approved', 'disputed', 'paid'))`. Only **`draft`** is
currently reachable in practice — see "Temporary issuing gate" below. `issued` exists in the
schema but is presently unreachable for any real claim; `approved`/`disputed`/`paid` have no code
path at all yet, reserved for future controlled RPCs.

## Contract value source

`contract_value_cents` is **not** pulled from any single canonical figure (e.g. a
`projects.contract_value_cents` column — no such column exists on `projects`). It is the sum of
`progress_claim_line_items.contract_value_cents` across this claim's own schedule of values,
recomputed by `recalculate_progress_claim_totals()` on every line-item change. Each claim
restates its own view of the contract's value through its own line items — there is no
cross-claim check that a new claim's total contract value matches the prior claim's. See "What
happens if the contract value changes later" below.

## Previously claimed — calculation

Two distinct things, deliberately not conflated:

- **Header `previously_claimed_cents`**: database-derived, once, at `INSERT` (`assign_progress_
  claim_number()`, regardless of entry path) — `sum(this_claim_cents)` from prior claims on the
  same project with `status in ('issued', 'approved', 'paid')`. Frozen against line-item
  recalculation thereafter, but remains directly client-editable while the claim is `draft` — a
  documented exception for correcting a claim made outside the system before this tool existed on
  a contract.
- **Line-level `progress_claim_line_items.previously_claimed_cents`**: **user-entered, not
  derived.** Correctly deriving a per-schedule-item "previously claimed" figure requires matching
  a line in this claim to "the same" line in an earlier claim, which needs a stable,
  identity-bearing schedule template shared across a project's claims — doesn't exist yet. Stated
  plainly in the migration comments rather than silently presenting a manually-typed figure as
  more accurate than it is.

## Current claim, claimed to date, remaining value

Per line: `this_claim_cents` is server-computed from `this_claim_percent` (`round(contract_value_cents
* this_claim_percent / 100)`) when supplied, otherwise the client's direct figure is accepted as
that line's own input (not itself an aggregate — no further derivation needed). `claimed_to_date_cents
= previously_claimed_cents + this_claim_cents`; `remaining_value_cents = contract_value_cents -
claimed_to_date_cents` — both always server-overwritten. Header: `this_claim_cents = Σ line
this_claim_cents`; `claimed_to_date_cents`/`remaining_value_cents` recomputed the same way, from
the header's own `previously_claimed_cents` plus the summed `this_claim_cents` —
`compute_progress_claim_derived_totals()`, a `BEFORE` trigger on the header itself, fires on
*every* header write (not only line-item-triggered ones), which is what keeps a direct edit to
`previously_claimed_cents` or `retention_rate` immediately consistent rather than stale until the
next line-item touch. Verified directly in the local dry run.

## Retention — input and output

**Input:** `retention_rate` (`numeric(5,4)`, fraction — `0.0500` = 5%), stored explicitly per
claim, client-editable while draft. **Output:** `retention_amount_cents = round(this_claim_cents *
retention_rate)`, always server-computed. Header-level only — no per-line retention (the original
tool only ever had one `retentionRate` field, and per-line retention has no product requirement
behind it). `retention_calculation_method` records which method was applied
(`'flat_percentage_of_claim'`, the only value implemented) — no retention-cap logic (e.g.
"withholding stops once cumulative retention reaches half the contract's total retention target")
is modelled. **This is a real limitation, not an oversight** — flagged below as needing
confirmation, same as the GST question.

## GST calculation method

`gst_rate` stored explicitly (`numeric(5,4)`, default `0.1000`). `gst_calculation_method` records
which order was applied — only `'gst_on_claim_before_retention'` is implemented:
`gst_cents = round(this_claim_cents * gst_rate)`, computed on the full claimed amount **before**
retention is deducted; `net_payable_cents = this_claim_cents + gst_cents - retention_amount_cents`.
**This is this migration's unconfirmed default, not an established fact** — see "External
accounting/legal questions" below.

## Prevention of overclaiming

**RESOLVED (restructure round) — now prevented, as an interim rule.** Per explicit direction
pending external confirmation, `remaining_value_cents >= 0` was added to
`progress_claims_totals_non_negative_check` in the core layer (`015`) — this applies to every
draft, not only at issue time, since issuing itself is separately and unconditionally blocked
regardless (`017`'s gate). Confirmed directly in the local dry run: attempting to set
`previously_claimed_cents` high enough to push `remaining_value_cents` negative is now **rejected
by the database** with a clear constraint-violation error, not silently accepted. Because
`remaining_value_cents = contract_value_cents - claimed_to_date_cents`, this single constraint
also enforces "a claim cannot exceed the recognised contract value" — mathematically the same
rule, not two separate ones.

This is explicitly an **interim** rule, not a final answer to the underlying question (whether
overclaiming via legitimate variations should ever be permitted) — that question remains open,
listed below, and the constraint may need loosening once it's answered. The original analysis
below (why an unconstrained design was first considered) is kept for context.

**Original analysis (superseded as a *default*, retained as context):** real construction
contracts do legitimately exceed original contract value once variations are added, which is why
this was not constrained in the pre-restructure draft. The interim tightening above prioritises
"the database cannot represent an obviously wrong state" over that flexibility until the contract-
policy question is actually answered — a deliberate, reversible choice, not a final position.

## Relationship to earlier claims

Covered by header `previously_claimed_cents`'s derivation (above) — the *only* place this
migration reasons about a claim's relationship to prior claims on the same project. There is no
check that this claim's `contract_value_cents` is consistent with the prior claim's, no check on
claim sequencing beyond the numbering counter, and no check that `claim_period_from`/`claim_period_to`
don't overlap a prior claim's period. All three are real gaps for a "prevent obviously wrong data
entry" pass, not currently built.

## Handling of corrected or cancelled claims

**Not supported at any stage.** No `DELETE` grant on `progress_claims` (ADR-010), and — same gap
identified in the Quotes review — **no `'archived'` value in the status enum either**, so there is
no soft-delete path for an abandoned *draft* claim, let alone an issued one. Once (if) a claim is
issued, it is unconditionally frozen with no correction, void, or revision path — by design (see
`docs/PHASE_5A_DESIGN_PROPOSAL.md`, "Post-issue immutability": future correction should produce a
new revision/replacement row, not a mutation of the original — not built in this migration).
**Currently, a mistaken draft claim simply has to be left unused; there is no way to mark it
cancelled or hide it from a list.**

## What happens if the contract value changes later

Nothing automatic. Since `contract_value_cents` is derived per-claim from that claim's own line
items (not from one canonical project-level figure), a genuine contract variation only affects
future claims if the person creating the next claim manually re-enters the updated figures into
its schedule of values. An already-issued claim's `contract_value_cents` is frozen forever
(correct — it reflects what was true when that claim was made). There is no mechanism that
detects or flags a claim whose contract value unexpectedly differs from the previous claim's —
this is the same underlying gap noted in `docs/PHASE_5A_DESIGN_PROPOSAL.md` as future work (a
shared, identity-bearing schedule-of-values template per project).

## Temporary issuing gate (implemented, not just recommended)

Per the instruction that **the database must not permit a real Progress Claim to transition to
issued using an unconfirmed calculation method**, this migration implements — not merely
documents — an unconditional block: the first check inside
`enforce_progress_claim_status_transition()`'s `draft → issued` branch unconditionally raises,
before the recipient/line-item/totals checks below it ever run:

> *"Progress Claims cannot be issued yet — the GST/retention calculation method requires
> accountant confirmation before this goes live. Drafts remain fully usable for testing."*

**Why this is the safest available gate, evaluated against the alternatives:**

- A config/settings table with a runtime toggle was considered and rejected as unnecessary
  infrastructure for what is fundamentally a one-time flag tied to a specific, known future event
  (accountant sign-off) — it would need to be built, secured, and audited on its own, for a
  problem a single `raise exception` already solves completely.
- A per-organisation confirmation flag was considered and rejected — the calculation method is a
  platform-wide default, not something that should vary by organisation.
- **This approach**: zero new schema, applies uniformly and unconditionally, cannot be
  accidentally bypassed by any client path (it sits inside the same trigger that is the *only*
  route to `issued` at all — see the Quotes review's "Issue-transition redesign" section, applied
  identically here), and is lifted by the smallest possible change: removing one `raise exception`
  statement in a tiny, obviously-scoped follow-up migration, once confirmation is recorded. Drafts
  are entirely unaffected — confirmed in the local dry run (a fully valid draft with a real client
  and real line items was created, calculated correctly, and *only* blocked at the issue attempt
  itself).

`issue_progress_claim()` is still fully built (not deferred) — `SECURITY DEFINER`, same shape and
same reasoning as `issue_quote()` (see the Quotes review) — so the frontend has a stable
integration point and a real, correctly-worded error to surface while the gate is in place.

## Post-issue immutability

Identical mechanism to Quotes (see that review) — currently moot for any real claim, since
nothing can reach `issued` at all while the gate is active, but the mechanism itself (forced
`draft` on insert, full freeze once non-draft, no exceptions) is independently correct and was
verified with the gate temporarily bypassed in a disposable local build (not shipped) to confirm
the underlying logic works, separately from confirming the gate itself blocks it.

## RLS policies / Grants

Identical shape to Quotes. `progress_claims`: `SELECT`/`INSERT` table-level, `UPDATE`
column-scoped — `client_name`, `client_email`, `contract_ref`, `claim_date`,
`claim_period_from`/`claim_period_to`, `previously_claimed_cents` (the documented exception),
`gst_rate`, `retention_rate`, `percent_complete`, `description_of_work`, `special_conditions`,
`builder_approval_name`, `client_approval_name`, `claim_number`, `updated_by` — excluding every
lifecycle column, every server-computed total, and `gst_calculation_method`/
`retention_calculation_method` (platform policy, not user input). `progress_claim_line_items`:
table-level `SELECT`/`INSERT`/`UPDATE`/`DELETE`, same reasoning as Quotes' line items.

## Triggers and RPCs (full list)

Mirrors Quotes exactly, table-renamed: `enforce_progress_claim_project_same_organisation`,
`enforce_progress_claim_status_transition` (+ the temporary gate), `compute_progress_claim_line_item_amounts`,
`enforce_progress_claim_line_item_draft_only`, `recalculate_progress_claim_totals` (`SECURITY
DEFINER`, same requirement as Quotes' equivalent — see that review), `assign_progress_claim_number`,
`progress_claims_set_updated_at` / `progress_claim_line_items_set_updated_at`,
`create_progress_claim(...)` (RPC, `INVOKER`), `issue_progress_claim(uuid)` (RPC, `DEFINER`, gated).

## Audit fields

Same shape as Quotes: `created_at`/`updated_at`/`created_by`/`updated_by`, `issued_at`/`issued_by`
(new this round), `status_changed_at`/`status_changed_by`.

## Indexes

`progress_claims_organisation_id_idx`, `progress_claims_project_id_idx`,
`progress_claims_organisation_status_idx`, `progress_claims_org_project_number_unique_idx`
(unique per project, not per organisation — see "Numbering" below),
`progress_claim_line_items_progress_claim_id_idx`.

## Numbering

Canonical `PC-001` (3-digit), **unique per project** — `internal.progress_claim_counters` keyed
by `project_id`, `ON DELETE CASCADE` from `projects`. Claims are inherently sequential within one
contract, matching Variation Notice's `VAR-NNN` precedent. Manual override/normalisation:
identical mechanism to Quotes, `PC` prefix.

## Concurrency behaviour

Identical analysis to Quotes: numbering is race-free by construction; line-item recalculation
serialises safely on the parent row's lock; not tested under genuine concurrent load in this
pass — same recommendation as Quotes, run `011`'s overlapping-transaction test against live
Supabase before real use.

## External accounting/legal questions — explicit list

1. **GST timing relative to retention** (the primary, already-gating question): is GST correctly
   calculated on the full claimed amount before retention is withheld, or only on the net amount
   actually paid after retention deduction — and does the applicable contract's retention terms
   affect the timing of GST attribution on the withheld portion?
2. **Retention caps**: should retention stop being withheld once cumulative retention reaches a
   contract-specified cap (a common real-world term)? Not modelled — flat percentage of every
   claim only.
3. **Overclaiming**: is a claim whose `claimed_to_date_cents` exceeds `contract_value_cents` a
   legitimate scenario (unbilled variations) that should be permitted, or an error condition that
   should be blocked or at least flagged? Currently permitted, unconstrained.
4. **Retention basis**: is retention correctly calculated on the GST-exclusive claim amount (this
   migration's assumption, `retention_amount_cents = round(this_claim_cents * retention_rate)`,
   before GST is added), or should it be calculated on a GST-inclusive figure?
5. **Jurisdiction/Security of Payment Act content**: this migration stores no jurisdiction/state
   field at all. The correct state-specific legislative notice (BIF Act Qld, SOP Acts NSW/Vic/SA,
   Construction Contracts Act WA) depends on the project's location, which isn't captured or
   enforced anywhere in this schema — a frontend/rendering concern for later, but the absence of
   a jurisdiction field here means it can't be validated at the database level either.

None of these are answered by this migration. All are explicitly gated from reaching a real,
issued document by the temporary gate above until at least question 1 (and ideally all of them)
is resolved.

## Ambiguity / unnecessary complexity — summary of findings

1. **No `'archived'` status, no cancel/void path at any stage** — same gap as Quotes, more acute
   here since claims have more workflow states in the enum that are currently entirely
   unreachable.
2. **Overclaiming unconstrained** — a deliberate choice, but one resting on an unconfirmed
   assumption (question 3 above).
3. **No cross-claim consistency check on `contract_value_cents`** — flagged, not fixed; tied to
   the larger "shared schedule of values template" future work already noted in the design doc.
4. Nothing else found to be over-engineered — the two-layer calculation-ownership design and the
   numbering machinery are both load-bearing, not speculative.

## Independent deployability from Quotes

**Confirmed**, with one caveat: `013`'s header comment states it "depends on `012` only for
shared conventions, not for any object it defines." Verified true — no FK, trigger, RPC, or RLS
policy in `013` references anything from `012`. It can be applied without `012` ever being
applied. The caveat: with the temporary gate active, applying `013` alone currently delivers
**draft-only** functionality (create, edit, calculate, never issue) — which is exactly the stated
intent while GST/retention remains unconfirmed, not an accidental limitation of deploying it in
isolation.

---

## Verdict: **BLOCKED** (for real/issued use, i.e. `017`) — **READY WITH CHANGES** (for draft-only deployment, i.e. `015`+`016`)

Split verdict, deliberately, now cleanly separable by file: `015` (core, with the new
overclaiming constraint) and `016` (numbering) are **READY WITH CHANGES** for draft-only
deployment — the schema, triggers, RLS, grants, and the least-privilege correction to
`previously_claimed_cents` derivation are implemented correctly and verified. `017` (issue
workflow) is **BLOCKED** by design and stays that way regardless of whether it's applied — its
gate unconditionally rejects every issue attempt until GST, retention, and overclaiming treatment
are confirmed by an accountant/contract-policy owner; this is enforced by the migration itself,
not left as a recommendation or frontend convention. Remaining structural item: `'archived'` is
now a valid status (resolved this round), but — same as Quotes — no transition RPC reaches it yet.
