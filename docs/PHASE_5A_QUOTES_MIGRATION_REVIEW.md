# Migration 012 Review — `public.quotes` / `public.quote_line_items`

**UPDATE (restructure round):** the single `012` this review was written against has been split
into three layered migrations — `012_create_quotes.sql` (core), `013_create_quote_numbering.sql`,
`014_create_quote_issue_workflow.sql` — see `docs/PHASE_5A_DESIGN_PROPOSAL.md` §12 for the full
layering and §13 for the `SECURITY DEFINER` audit. Two facts below are now **superseded**, not
just relocated: the status enum gained `void`/`archived` (closing the archive gap this review
originally flagged), and `issue_quote()` now additionally requires `quote_type`, a `valid_until`
date, and `client_email` — see `docs/PHASE_5A_DESIGN_PROPOSAL.md` for the authoritative current
requirements. The rest of this document (calculation ownership, RLS, grants shape, concurrency
analysis) is unchanged in substance by the restructure — content moved files, the design didn't.
**Migration files:** `012_create_quotes.sql` / `013_create_quote_numbering.sql` /
`014_create_quote_issue_workflow.sql` — **APPLIED and live-verified** against `hpcqncghvdrlvufxfdnd`
(2026-08-02) — see `docs/changelog.md`'s Sprint 5b entry for the live verification report.
**Status:** Reviewed in isolation from Progress Claims per request. Verdict at the end.

**Post-review fix (Sprint 5b, before deployment):** `quote_number` was removed from
`authenticated`'s `UPDATE` grant. `normalize_quote_number()` only runs on `INSERT`
(`assign_quote_number()`'s trigger timing), so a direct client `UPDATE` to `quote_number` could
have bypassed normalisation entirely and produced a non-canonical string that doesn't collide with
the canonical form in `quotes_org_number_unique_idx`. No legitimate reason to change the number
after creation — matches the "no reassignment-on-`UPDATE` path" decision already shipped for
`variation_notices.variation_number` (`010`/`011`). The grant statement below (Grants section)
reflects the original draft this review was written against; the deployed migration excludes
`quote_number`.
**Companion:** `docs/PHASE_5A_DESIGN_PROPOSAL.md` (full design history), `docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md`.

---

## Tables and relationships

Two tables, one parent-child relationship:

- **`public.quotes`** — one row per quote. `organisation_id` and `project_id` both `NOT NULL`,
  `ON DELETE RESTRICT` (an organisation or project cannot be deleted while a quote referencing it
  exists).
- **`public.quote_line_items`** — one row per priced line. `quote_id NOT NULL`,
  `ON DELETE CASCADE` (deliberate — see "Deletion/archive behaviour" below).

No `organisation_id` column on `quote_line_items` — tenancy is enforced entirely through the
join to `quotes` (both in RLS and in every trigger that needs to check ownership), not duplicated
onto every line. This is a good simplification: one tenancy boundary to reason about, not two
that could drift.

## Every status value

`quotes.status`, `check (status in ('draft', 'issued', 'accepted', 'declined', 'expired'))`.

Only **`draft`** and **`issued`** are reachable by anything in this migration.
`accepted`/`declined`/`expired` are enum values with no code path that ever sets them — reserved
for future controlled RPCs (not built here), consistent with the "no broad exceptions, future
transitions are separate reviewed work" decision. This is intentional, not an oversight, but
worth stating plainly: **a quote can currently only ever be `draft` or `issued` in practice.**

## Quote numbering — scope and format

Canonical `QT-0001` (4-digit, zero-padded below 10000, unpadded at/above it), **unique per
organisation** (`quotes_org_number_unique_idx` on `(organisation_id, quote_number)`) —
deliberately not per-project, since a quote commonly precedes a project being fully committed and
a builder thinks in terms of their own overall quote sequence. Mechanism: `internal.
quote_counters` (one row per organisation, RLS-enabled with zero policies/grants — reachable only
via the `SECURITY DEFINER` `assign_quote_number()` trigger), an atomic
`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` increment (race-free without an advisory
lock — Postgres itself serialises two concurrent upserts on the same primary key), and a
proactive collision-avoidance loop. Identical mechanism to `011`'s proven
`variation_number_counters` design, adapted to organisation scope.

## Manual overrides

A client may supply `quote_number` directly instead of leaving it blank. `internal.
normalize_quote_number()` recognises a standard-equivalent entry — bare digits, or `QT`/`qt` with
an optional hyphen/space then digits (`"50"`, `"qt-50"`, `"QT 50"`) — and reduces it to canonical
`QT-0050`; a genuinely custom reference (e.g. `"CLIENT-Q-9"`) is stored exactly as typed. A
normalised value colliding with an existing number in the same organisation raises a clear,
plain-language error naming the canonical value — not a raw constraint violation. Verified in the
local dry run.

## Editable client inputs (while `draft`)

Per the column-scoped `UPDATE` grant (see "Grants" below): `client_name`, `client_email`,
`client_phone`, `client_address`, `quote_number`, `quote_date`, `valid_until`, `quote_type`,
`scope_of_works`, `inclusions`, `exclusions`, `assumptions`, `optional_items`, `deposit_percent`,
`payment_terms`, `additional_terms`, `builder_approval_name`, `gst_rate`, `updated_by`. Line
items (`quote_line_items.description`, `.quantity`, `.unit`, `.unit_price_cents`,
`.gst_applicable`) are freely insertable/updatable/deletable via ordinary table-level grants while
the parent is `draft`.

## Server-derived fields (client cannot write these, on any path)

| Field | Derived by | Mechanism |
|---|---|---|
| `quote_line_items.line_total_cents` | `compute_quote_line_item_amounts()` (`BEFORE INSERT OR UPDATE` on line items) | `round(quantity * unit_price_cents)` — unconditionally overwrites whatever the client sent |
| `quote_line_items.gst_cents` | same trigger | `round(line_total_cents * quotes.gst_rate)` when `gst_applicable`, else `0` |
| `quotes.subtotal_cents` | `recalculate_quote_totals()` (`AFTER` on line items) | `sum(line_total_cents)` |
| `quotes.gst_cents` | same trigger | `sum(quote_line_items.gst_cents)` |
| `quotes.total_cents` | same trigger | `subtotal_cents + gst_cents` |
| `quotes.status`/`issued_at`/`issued_by`/`issued_snapshot`/`status_changed_at`/`status_changed_by` | `enforce_quote_status_transition()` + column-scoped grant | See "Post-issue immutability" |

`recalculate_quote_totals()` is `SECURITY DEFINER` — required, because authenticated's `UPDATE`
grant on `quotes` doesn't cover `subtotal_cents`/`gst_cents`/`total_cents`, and this function
issues its own separate `UPDATE` statement (not a same-statement `NEW` reassignment, which isn't
separately privilege-checked). Safe without an extra organisation check: the line item it fired
from was already a write the caller's own RLS had already permitted.

## Line-total and subtotal/GST/total calculation

Per line: `line_total_cents = round(quantity * unit_price_cents)`; `gst_cents = round(line_total_cents
* gst_rate)` if `gst_applicable` else `0`. Header: `subtotal_cents = Σ line_total_cents`;
`gst_cents = Σ line gst_cents`; `total_cents = subtotal_cents + gst_cents`. `gst_rate` is stored
per-quote (`numeric(5,4)`, default `0.1000`), not hard-coded, so a historical quote remains
correct if the platform default rate ever changes.

## Issue requirements

**RESOLVED (restructure round)** — the ambiguity originally flagged here (quote_type/valid_until
not required at issue) has been closed by explicit direction. Enforced inside
`enforce_quote_status_transition()`'s `draft → issued` branch (`014_create_quote_issue_workflow.sql`),
checked in this order:

1. `quote_type` is not `null`.
2. `valid_until` is not `null`, and `valid_until >= quote_date`.
3. `client_name` non-blank.
4. `client_email` non-blank (new — "recipient details complete" is interpreted as name **and**
   email; `client_phone`/`client_address` remain optional — a judgement call on an open
   instruction, flagged in the migration's own header comment).
5. At least one `quote_line_items` row exists.
6. `total_cents = subtotal_cents + gst_cents` (defensive re-check).

All six branches individually exercised in the local dry run, confirming the check order matches
this list exactly (each fix-one-thing-retry step surfaced the next distinct error, not a generic
one).

## Issue-transition redesign (this review round)

**Changed in this pass, per explicit direction.** Previously, `draft → issued` was reachable via
either `issue_quote()` or a plain client `UPDATE` (both validated identically by the trigger).
Now:

- Authenticated's `UPDATE` grant on `quotes` is **column-scoped**, and excludes every lifecycle
  column (`status`, `issued_at`, `issued_by`, `issued_snapshot`, `status_changed_at`,
  `status_changed_by`) and every server-computed total. A plain client `UPDATE` touching any of
  those columns fails with a Postgres permission error — **before the row or the trigger's
  business logic is ever reached.** Verified directly in the local dry run (a bare
  `UPDATE quotes SET status = 'issued' ...` returns `permission denied for table quotes`).
- `issue_quote(p_quote_id uuid)` is `SECURITY DEFINER` (the only `DEFINER` client-facing RPC in
  this migration — every other RPC is `INVOKER`) specifically so it can write those columns. It
  re-establishes the access boundary RLS would otherwise have given it, explicitly, in code: both
  its lookup and its `UPDATE`'s `WHERE` clause require `organisation_id = internal.
  current_organisation_id()`. Same pattern `011`'s `assign_variation_notice_number()` already
  established for calling a `DEFINER` function safely.
- The validation logic itself (recipient, line-item count, totals) stays written once, inside the
  trigger — not duplicated into `issue_quote()`'s body. Since the trigger's issue-transition
  branch is now reachable exclusively through this RPC, writing the checks twice would create two
  sources of truth that could silently drift; the RPC is functionally the sole validator even
  though the code lives in one place.

## Snapshot content

`quotes.issued_snapshot` (`jsonb`), populated only inside the `draft → issued` transition:
`quote_number`, every client/document field (`client_name` through `builder_approval_name`),
`gst_rate`, `subtotal_cents`/`gst_cents`/`total_cents`, and a `line_items` array (each line's
`position`, `description`, `quantity`, `unit`, `unit_price_cents`, `gst_applicable`,
`line_total_cents`, `gst_cents`).

**Noted overlap, deliberately kept:** because the whole row (and its line items) is independently
made fully immutable on issue (below), the *live* columns already equal the snapshot at every
moment after issue — the snapshot is currently redundant with the live row. Kept anyway for
forward-compatibility: if a future migration ever adds a legitimate post-issue correction/
revision mechanism, `issued_snapshot` remains a provably untouched record of exactly what was
originally issued, independent of whatever the live row evolves to represent. This is explained
in the migration's own comments so it doesn't read as an unexamined copy of `010`'s pattern.

## Post-issue immutability

One function, `enforce_quote_status_transition()`, `BEFORE INSERT OR UPDATE`:

- **On INSERT:** `status` forced to `'draft'` regardless of client input; `issued_at`/`issued_by`/
  `issued_snapshot`/`status_changed_at`/`status_changed_by` forced `null`. No insert path can
  create an already-issued row.
- **On UPDATE, while `status = 'draft'`:** ordinary edits pass through; `draft → issued` is
  validated and stamped (see above).
- **On UPDATE, once `status <> 'draft'`:** **any** update is rejected outright, unconditionally —
  confirmed directly in the local dry run for both a lifecycle-column attempt (blocked at the
  grant level, never reaches this trigger) and an ordinary-column attempt like `scope_of_works`
  (blocked here, with the trigger's own error). No exceptions for status, approval names, or
  anything else.
- A matching trigger on `quote_line_items` (`enforce_quote_line_item_draft_only`) blocks all
  insert/update/delete on line items once the parent is not `draft`.

## RLS policies

`quotes`: 3 policies (`select`/`insert`/`update`, no `delete`), each
`organisation_id = internal.current_organisation_id()`. `quote_line_items`: 4 policies (adds
`delete`), each scoped via `exists (select 1 from quotes q where q.id = quote_line_items.quote_id
and q.organisation_id = internal.current_organisation_id())`.

## Grants

- `quotes`: `SELECT`/`INSERT` table-level; `UPDATE` **column-scoped** (see "Issue-transition
  redesign"). Nothing to `anon`.
- `quote_line_items`: `SELECT`/`INSERT`/`UPDATE`/`DELETE` table-level (unrestricted at column
  level — computed columns there are protected by unconditional trigger overwrite instead, which
  is sufficient since there's no lifecycle/security boundary at the line-item level, only a
  freely-editable-while-draft one).
- `internal.quote_counters`: zero grants to any client role, ever.

## Triggers and RPCs (full list)

| Object | Fires on | Purpose |
|---|---|---|
| `enforce_quote_project_same_organisation` | `BEFORE INSERT OR UPDATE` on `quotes` | Cross-tenant integrity: `project_id` must belong to `organisation_id` |
| `enforce_quote_status_transition` | `BEFORE INSERT OR UPDATE` on `quotes` | Entire lifecycle state machine |
| `compute_quote_line_item_amounts` | `BEFORE INSERT OR UPDATE` on `quote_line_items` | Line totals |
| `enforce_quote_line_item_draft_only` | `BEFORE INSERT OR UPDATE OR DELETE` on `quote_line_items` | Freezes line items once parent issued |
| `recalculate_quote_totals` | `AFTER INSERT OR UPDATE OR DELETE` on `quote_line_items` | Header totals |
| `assign_quote_number` | `BEFORE INSERT` on `quotes` | Numbering |
| `quotes_set_updated_at` / `quote_line_items_set_updated_at` | `BEFORE UPDATE` | Reused `set_updated_at()` |
| `create_quote(...)` | RPC, `INVOKER` | Recommended creation entry point |
| `issue_quote(uuid)` | RPC, `DEFINER` | Sole entry point for `draft → issued` |

## Deletion/archive behaviour

**No `DELETE` grant on `quotes`** (ADR-010 soft-delete-only). **RESOLVED (restructure round):**
`'void'` and `'archived'` are now both in the status enum (7 values total — see
`docs/PHASE_5A_DESIGN_PROPOSAL.md`). Note this closes the *schema* gap only — the enum values are
now valid, but **no transition mechanism reaches them yet** (same as `accepted`/`declined`/
`expired`, which have always been enum-valid with no RPC behind them). A future controlled RPC is
still needed before a client can actually archive or void a quote; `status` remains fully
excluded from the client `UPDATE` grant at every layer of this migration set. `quote_line_items`
DOES support real `DELETE` while the parent is `draft` (unchanged — a draft's working rows, not
the document itself).

## Audit fields

`created_at`/`updated_at`/`created_by`/`updated_by` (standard, `updated_by` not automatically
maintained by any trigger — same pre-existing gap as `variation_notices`, not introduced here).
`issued_at`/`issued_by` (new this round, set once by `issue_quote()` only).
`status_changed_at`/`status_changed_by` (generic "most recent transition" pair, currently
identical to `issued_at`/`issued_by` since issuing is the only transition that exists, but kept
distinct for when future transitions land).

## Indexes

`quotes_organisation_id_idx`, `quotes_project_id_idx`, `quotes_organisation_status_idx`
(composite), `quotes_org_number_unique_idx` (the numbering uniqueness constraint, doubles as a
lookup index), `quote_line_items_quote_id_idx`.

## Concurrency behaviour

- **Numbering:** race-free by construction (atomic upsert on the counter table's primary key) —
  same proof as `011`.
- **Line-item recalculation:** two concurrent line-item writes to the *same* quote serialise on
  the parent row's own `UPDATE` lock (the second transaction's `recalculate_quote_totals()` call
  blocks until the first commits, then recomputes from the now-current state) — correct, not
  corrupting, at the cost of brief blocking under genuinely simultaneous multi-tab editing of one
  quote. Not tested under real concurrent load in this pass (the local dry run exercised sequential
  correctness only, same limitation noted for `012`/`013` generally) — recommend the same
  overlapping-transaction concurrency test `011` ran, against live Supabase, before real use.
- **Issue race:** two concurrent `issue_quote()` calls on the same quote — the second sees
  `old.status <> 'draft'` (the first already committed) and is rejected with the immutability
  error, not a corrupted double-issue.

## Ambiguity / unnecessary complexity — summary of findings

1. **No `'archived'` status** — real gap, flagged above.
2. **Issue requirements now cover `quote_type`/`valid_until`/`client_email`** — resolved this
   round, see above.
3. **`issued_snapshot` is currently redundant** with the fully-immutable live row — kept
   deliberately for forward-compatibility, not unexamined complexity; reasoning is in the
   migration's own comments.
4. Nothing else found to be over-engineered relative to what's actually needed — the numbering
   machinery mirrors `011`'s already-proven, already-necessary design; the two-layer
   calculation-ownership (line-item trigger + header trigger) is the minimum needed to keep both
   levels correct without a staleness gap (see `docs/PHASE_5A_DESIGN_PROPOSAL.md` §1).

## Independent deployability from Progress Claims

**Confirmed**, and now more precisely layered: `012`/`013`/`014` have no foreign key, trigger,
RPC, or RLS policy that references `progress_claims`/`progress_claim_line_items` in any way. Each
of the three Quotes files can also be applied independently of each other (see
`docs/PHASE_5A_DESIGN_PROPOSAL.md` §12) — `012` alone gives fully functional draft quotes with
manual numbering; `012`+`013` adds auto-numbering; all three give the full issue workflow.

---

## Verdict: **READY WITH CHANGES**

Remaining item: `'archived'`/`'void'` are now valid status values, but no transition RPC reaches
them yet (reserved for future work, consistent with `accepted`/`declined`/`expired`). Everything
else — calculation ownership, numbering, post-issue immutability, the RPC-only issue-transition
design, the tightened issue requirements, grants, RLS, the `SECURITY DEFINER` audit — is
implemented as specified and verified across two local dry-run rounds, including the layered
(012-only / 012+013 / full-stack) re-test specific to this restructure.
