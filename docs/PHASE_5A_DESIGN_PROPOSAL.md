# Sprint 5a Design Proposal — Quotes, Progress Claims & Project Hub

**Status:** Final (v3) — migrations drafted (`012_create_quotes.sql`,
`013_create_progress_claims.sql`) and locally dry-run tested against a disposable Postgres 16
instance (see §9). **Not applied to `hpcqncghvdrlvufxfdnd`.** v1 proposed JSONB line items; v2
replaced that with typed child tables and added server-side calculation ownership and
DB-enforced immutability; this revision (v3) finalises five specific points raised in review —
GST/retention auditability, minimum-line-item enforcement, the Progress Claim UI's real scope,
the full calculation-ownership rule, and post-issue immutability with no exceptions — and
records exactly how each is implemented in the two draft migrations.
**Scope:** Final schema for `quotes`/`quote_line_items` and `progress_claims`/
`progress_claim_line_items` (ADR-016), plus the Project Hub page, which is now built
(`project-hub.html`) and pending manual browser testing — see
`docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md`.
**Precedent:** `010_create_variation_notices.sql` / `011_variation_notice_number_generator.sql`,
both live and verified.

---

## 1. Calculation ownership rule (applies to both tables)

**The client proposes editable inputs. The database-controlled RPC — or, where an RPC isn't the
entry point, a trigger that no client role can bypass — computes and freezes all derived
monetary values.** Never trusted from client input, regardless of entry path (RPC or a plain
authenticated INSERT/UPDATE):

- line totals (`quote_line_items.line_total_cents`, `.gst_cents`)
- subtotal (`quotes.subtotal_cents`)
- GST (`quotes.gst_cents`, `progress_claims.gst_cents`)
- total (`quotes.total_cents`)
- retention amount (`progress_claims.retention_amount_cents`)
- previously-claimed aggregate (`progress_claims.previously_claimed_cents` — header level; see §6)
- claimed-to-date aggregate (`progress_claims.claimed_to_date_cents`,
  `progress_claim_line_items.claimed_to_date_cents`)
- remaining amount (`progress_claims.remaining_value_cents`,
  `progress_claim_line_items.remaining_value_cents`)

Mechanism, concretely (see `012`/`013` for the actual trigger functions): a `BEFORE INSERT OR
UPDATE` trigger on each line-item table always overwrites its own computed columns before the
row is written, regardless of what the client supplied for them. An `AFTER` trigger on each
line-item table then sums the current line items back into the parent header's raw totals
(`subtotal_cents`/`gst_cents` for quotes; `contract_value_cents`/`this_claim_cents` for progress
claims). A separate `BEFORE` trigger on each header table recomputes every further-derived figure
(retention, GST, net payable, claimed-to-date, remaining) from those raw totals on **every**
header write, not only ones triggered by a line-item change — this closes a real staleness gap: a
direct edit to `previously_claimed_cents` or `retention_rate` while still draft recomputes
everything dependent on it immediately, rather than waiting for the next unrelated line-item
write. Verified in the local dry run, §9.

---

## 2. Final schema — Quotes

### `public.quotes`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `organisation_id` | `uuid not null references organisations(id) on delete restrict` | |
| `project_id` | `uuid not null references projects(id) on delete restrict` | |
| `quote_number` | `text not null` | Canonical `QT-0001`, unique **per organisation**. See §4. |
| `client_name`, `client_email`, `client_phone`, `client_address` | `text`, nullable | A draft may exist before a recipient is chosen — `issue_quote()` is what requires `client_name` non-blank. Frozen once issued (§5). |
| `quote_date` | `date not null default current_date` | |
| `valid_until` | `date` | |
| `quote_type` | `text check (quote_type in ('fixed','estimate','cost-plus'))`, nullable | |
| `scope_of_works`, `inclusions`, `exclusions`, `assumptions`, `optional_items`, `payment_terms`, `additional_terms`, `builder_approval_name` | `text` | |
| `deposit_percent` | `smallint check (deposit_percent in (0,5,10,20,25,50))` | |
| `gst_rate` | `numeric(5,4) not null default 0.1000` | Stored explicitly per quote — see §7.1. |
| `subtotal_cents`, `gst_cents`, `total_cents` | `bigint not null default 0` | **Server-computed** — see §1. |
| `status` | `text not null default 'draft' check (status in ('draft','issued','accepted','declined','expired'))` | |
| `issued_at`, `status_changed_at`, `status_changed_by` | timestamps/uuid | Set once, by trigger, on `draft → issued`. See §5. |
| `created_at`/`updated_at`/`created_by`/`updated_by` | standard audit columns | |

### `public.quote_line_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `quote_id` | `uuid not null references quotes(id) on delete cascade` | Cascade is deliberate — see the note below. |
| `position` | `smallint not null` | `unique (quote_id, position)`. |
| `description` | `text not null` | |
| `quantity` | `numeric(12,2) not null default 1` | |
| `unit` | `text` | e.g. `m2`, `item`, `hr`, `ls`. |
| `unit_price_cents` | `bigint not null` | Client-supplied input. |
| `gst_applicable` | `boolean not null default true` | The only tax treatment modelled — no mixed/partial supply per line. |
| `line_total_cents`, `gst_cents` | `bigint not null default 0` | **Server-computed** — `round(quantity * unit_price_cents)`, and GST on that at the header's `gst_rate` when `gst_applicable`. |
| `created_at`/`updated_at` | standard | |

**On the cascade delete:** ADR-010's soft-delete-only rule is about the top-level document. While
a quote is `draft`, line items are freely added/edited/deleted as the builder prices the job —
real `DELETE` here is normal editing. Once `status` leaves `draft`, the immutability trigger (§5)
blocks all further changes to line items, same as the header.

---

## 3. Final schema — Progress Claims

### `public.progress_claims`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `organisation_id` | `uuid not null references organisations(id) on delete restrict` | |
| `project_id` | `uuid not null references projects(id) on delete restrict` | |
| `claim_number` | `text not null` | Canonical `PC-001`, unique **per project**. See §4. |
| `client_name`, `client_email` | `text`, nullable | Same draft-may-be-empty reasoning as Quotes. |
| `contract_ref` | `text` | |
| `claim_date`, `claim_period_from`, `claim_period_to` | `date` | |
| `contract_value_cents`, `this_claim_cents` | `bigint not null default 0` | **Server-computed** — sum of the corresponding line-item columns. |
| `previously_claimed_cents` | `bigint not null default 0` | **Database-derived at INSERT**, then an ordinary editable column while draft — see §6. |
| `claimed_to_date_cents`, `remaining_value_cents` | `bigint not null default 0` | **Server-computed** on every header write — see §1. |
| `gst_rate` | `numeric(5,4) not null default 0.1000` | Stored explicitly — see §7.1. |
| `gst_calculation_method` | `text not null default 'gst_on_claim_before_retention' check (... in ('gst_on_claim_before_retention'))` | Records which method was actually applied. See §7.1 — this is the specific unconfirmed assumption. |
| `gst_cents` | `bigint not null default 0` | **Server-computed.** |
| `retention_rate` | `numeric(5,4) not null default 0` | Fraction (`0.0500` = 5%). Header-level only — see the line-item table note below. |
| `retention_calculation_method` | `text not null default 'flat_percentage_of_claim' check (... in ('flat_percentage_of_claim'))` | Same auditability pattern as `gst_calculation_method`. No retention-cap logic implemented — see §11 in `013`'s "NOT built". |
| `retention_amount_cents`, `net_payable_cents` | `bigint not null default 0` | **Server-computed.** |
| `percent_complete` | `numeric(5,2)` | Informational. |
| `description_of_work`, `special_conditions`, `builder_approval_name`, `client_approval_name` | `text` | |
| `status` | `text not null default 'draft' check (status in ('draft','issued','approved','disputed','paid'))` | |
| `issued_at`, `status_changed_at`, `status_changed_by` | as Quotes | |
| `created_at`/`updated_at`/`created_by`/`updated_by` | standard | |

`schedule_of_values` (the old freeform textarea) is **dropped**, not ported — superseded by
`progress_claim_line_items` below. No live data exists yet for this tool.

### `public.progress_claim_line_items`

The structured schedule of values — a genuine purpose-built UI target, not a generic form
payload. See §7.3.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `progress_claim_id` | `uuid not null references progress_claims(id) on delete cascade` | Same cascade reasoning as quote line items. |
| `position` | `smallint not null` | `unique (progress_claim_id, position)`. |
| `description` | `text not null` | The schedule item, e.g. "Concrete slab and footings". |
| `contract_value_cents` | `bigint not null` | This item's share of the contract. |
| `previously_claimed_cents` | `bigint not null default 0` | **User-editable, not derived** — see §6 for why this is a deliberate exception from §1's rule. |
| `this_claim_percent` | `numeric(5,2)`, nullable | If supplied, drives `this_claim_cents`. |
| `this_claim_cents` | `bigint not null default 0` | **Server-computed from `this_claim_percent`** when supplied; otherwise the client's direct input for this line, accepted as-is (not itself an aggregate). |
| `claimed_to_date_cents`, `remaining_value_cents` | `bigint not null default 0` | **Server-computed**, always. |
| `created_at`/`updated_at` | standard | |

No per-line GST or retention — both are payment-claim-level concepts in Australian practice
(shown once at the bottom of the claim, not itemised per schedule line), and the original tool
only ever had one `retentionRate` field.

---

## 4. Numbering

Both use the `011` pattern: a dedicated `internal.*_counters` table (RLS enabled, zero policies,
zero grants, only reachable via a `SECURITY DEFINER` trigger), a canonical-format helper, a
manual-entry normaliser, a `BEFORE INSERT` assignment trigger with a proactive collision-avoidance
loop, and a `create_*()` RPC with a bounded retry on the unique-violation constraint.

- **Quotes — `QT-0001`, unique per organisation.** `internal.quote_counters` keyed by
  `organisation_id` — a builder thinks in terms of their own quote sequence, and quotes commonly
  precede a project being fully set up.
- **Progress Claims — `PC-001`, unique per project.** `internal.progress_claim_counters` keyed by
  `project_id` — claims are inherently sequential within one contract, matching Variation
  Notice's `VAR-NNN`.

**Manual override and normalisation:** a bare number or a case/spacing variant of the prefix
(`"qt 50"`, `"PC-3"`) normalises to canonical form (`QT-0050`, `PC-003`); a genuinely custom
reference is stored unchanged; a normalised duplicate raises a plain-language conflict error, not
a raw constraint violation. All confirmed in the local dry run (§9).

---

## 5. Post-issue immutability — no exceptions

Resolved per review: **no broad exceptions for status, approval names, or anything else.** Each
header table has exactly one `BEFORE INSERT OR UPDATE` trigger
(`enforce_<table>_status_transition()`) that is the entire lifecycle state machine:

- On **every INSERT**, `status` is forced to `'draft'` regardless of what the client supplies —
  `issued_at`/`status_changed_at`/`status_changed_by` are forced `null`. There is no insert path
  that can create an already-issued row.
- On **UPDATE, while `status = 'draft'`**: if `NEW.status` is still `'draft'`, this is an
  ordinary draft edit, allowed. If `NEW.status = 'issued'`, this is the one legal transition —
  validated (recipient present, at least one line item, totals internally consistent — see §7.2)
  and stamped entirely inside the trigger. Any other target status is rejected.
- On **UPDATE, once `status <> 'draft'`**: the entire update is rejected outright, unconditionally
  — full stop. Not status, not approval names, not line items (a matching trigger on each
  line-item table enforces the same rule for its rows).

This is enforced at the trigger level, reachable by any insert/update path (the RPC or a plain
authenticated statement) — same "the RPC is a convenience, the trigger is the actual guarantee"
relationship `011` established for `create_variation_notice()`.

**What this deliberately does not build yet:** accepted/declined/expired/approved/disputed/paid
transitions, and any void or correction workflow. Only `draft → issued` exists in `012`/`013`. A
future controlled RPC for each of those transitions is real, necessary future work — and, per
review, **a correction to an issued record should produce a new revision/replacement/void row,
not a mutation of the original.** This migration does not build that mechanism, but its
uncompromising trigger (no exceptions at all once issued) is what keeps that door open cleanly:
there is no partial-mutability precedent to work around later, only a single, well-understood
point (`old.status <> 'draft'`) where a future migration will need its own explicit, reviewed
path around this trigger — not a blanket carve-out added defensively now.

---

## 6. Where "previously claimed" is genuinely derived, and where it isn't

- **Header-level `previously_claimed_cents`** (on `progress_claims`) **is fully database-derived**
  — computed at INSERT (regardless of entry path: the RPC or a plain INSERT) as the sum of
  `this_claim_cents` from prior claims on the same project with `status in ('issued', 'approved',
  'paid')`. It is never a parameter the client can supply, on any path. It is then frozen against
  line-item recalculation but remains an ordinary, directly editable column while the claim is
  still `draft` — a deliberate, documented exception, for a manual correction of a claim made
  outside the system before this tool existed on a given contract.
- **Line-level `previously_claimed_cents`** (on `progress_claim_line_items`) **is user-entered,
  not derived.** Correctly deriving it would require matching a schedule item in this claim to
  "the same" item in a prior claim — reliable only with a stable, identity-bearing schedule
  template shared across a project's claims, which doesn't exist yet. Flagged explicitly rather
  than quietly presenting a manually-typed figure as more accurate than it is.

---

## 7. Final decisions on the five review points

### 7.1 GST and retention — explicit, auditable, not asserted as one universal order

No universal calculation order is asserted. `gst_rate` and `retention_rate` are stored explicitly
per claim (not hard-coded), and `gst_calculation_method`/`retention_calculation_method` record,
per claim, exactly which method was actually applied — plain `text` columns with a `check`
constraint, not buried in a generated-column expression (`012`/`013` use ordinary stored columns
written by trigger logic throughout, never `GENERATED ALWAYS AS`, specifically so this logic
stays reviewable and revisable). Only one value of each is implemented today; the derivation
trigger (`compute_progress_claim_derived_totals()`) raises rather than silently guessing if it
ever sees an unrecognised method.

**The specific question this leaves open, for an accountant or the contract-policy owner, before
Progress Claims are used to issue a real document to a real client:** is GST correctly calculated
on the full claimed amount before retention is withheld (this migration's default,
`gst_on_claim_before_retention`), or only on the net amount actually paid after retention
deduction — and does the applicable contract's retention terms affect the timing of GST
attribution on the withheld portion? A second, related question flagged but not modelled: some
contracts apply a **retention cap** (e.g. withholding stops once cumulative retention reaches
half the contract's total retention target) rather than a flat percentage of every claim — not
built here (`013`'s "NOT built"), same reasoning.

Because the method is recorded per row rather than assumed platform-wide, a future correction
changes data/config, not schema, and no already-issued claim's record needs reinterpreting.

### 7.2 Minimum line items — enforced in the database, not only the frontend

A draft may exist with zero line items — confirmed in the local dry run (`create_quote()`/
`create_progress_claim()` both succeed with none). The `draft → issued` transition is where this
is actually gated, inside `enforce_<table>_status_transition()` (§5) — not a `CHECK` constraint
on the table (a `CHECK` can't count related rows) and not left to frontend validation alone:

- recipient present (`client_name` non-blank)
- at least one line item / schedule item exists
- calculated totals are internally consistent (a defensive re-check — `total_cents =
  subtotal_cents + gst_cents` for Quotes; the equivalent net-payable/claimed-to-date identities
  for Progress Claims — that should already hold by construction via §1's triggers, re-verified
  at the one irreversible moment rather than only trusted)

All four branches (blank recipient, zero line items, successful issue, and the totals-consistency
assert) were exercised directly in the local dry run, §9.

### 7.3 Progress Claim UI — a genuine purpose-built schedule, not a generic form payload

Confirmed as scope, not assumed away: `progress_claim_line_items` is a real structured editor —
per-line description, contract value, previously claimed, current claim (amount or percentage),
claimed to date, remaining value, clear totals — replacing the old tool's single freeform
textarea, not a straight port. This is real frontend work (a repeating line-item editor,
consistent totals display, mobile-usable), sharing the underlying Supabase modules
(`supabase-project-context.js`, `supabase-record-panel.js`) and design-system components with
Quotes' own line-item editor, but not sharing a reduced-to-generic-payload component with it —
each keeps its own field set and validation. Not built in this pass (schema/migrations only, per
the "do not begin either frontend build" instruction); tracked as the next piece of work once
these migrations are reviewed and applied.

### 7.4 Calculation ownership — see §1 above (the full untrusted-fields list).

### 7.5 Post-issue immutability — see §5 above (no exceptions, single state-machine trigger).

---

## 8. RLS and privileges (both new table pairs) — implemented as designed

- [x] `enforce_<table>_project_same_organisation()` trigger on `quotes` and `progress_claims`.
- [x] `enforce_<table>_status_transition()` on both header tables — supersedes the earlier
      "issued immutability" trigger concept; see §5.
- [x] `enforce_<table>_line_item_draft_only()` on both line-item tables.
- [x] `set_updated_at()` reused, not reimplemented, on all four tables.
- [x] RLS enabled on all four tables. Header tables: `select`/`insert`/`update`, no `delete`
      (ADR-010), scoped `organisation_id = internal.current_organisation_id()`. Line-item tables:
      same three plus `delete` (per §2's cascade note), each scoped via `exists (select 1 from
      quotes/progress_claims parent where parent.id = ... and parent.organisation_id =
      internal.current_organisation_id())`.
- [x] Explicit grants on all four — nothing inherited.
- [x] Counter tables: RLS enabled, zero policies, zero grants.
- [x] Local Postgres dry run completed — see §9.

---

## 9. Local dry run — completed against a disposable Postgres 16 instance

Both migrations were applied in full, in sequence after `001`-`011`, to a disposable local
database (not `hpcqncghvdrlvufxfdnd`), with a minimal `auth.users`/`auth.uid()` stub standing in
for the parts of the platform Supabase itself provides. All statements applied cleanly with no
syntax or dependency errors. Functional tests then ran as the `authenticated` role (not the
migrating superuser), simulating two separate organisations:

- Draft creation with zero line items for both tables; sequential auto-numbering (`QT-0001` →
  `QT-0002`; `PC-001` → `PC-002` deriving `previously_claimed_cents` correctly from the first,
  now-issued claim).
- Line-item insert with a deliberately tampered `line_total_cents`/`gst_cents` payload — confirmed
  silently overwritten with the server-computed correct values, not merely rejected.
- Parent totals confirmed correct after insert/update/delete of line items, and confirmed to
  update immediately after a direct header edit to `retention_rate` with no line-item change
  involved (the §1 staleness-gap fix).
- `issue_quote()`/`issue_progress_claim()`: confirmed rejection with blank recipient, confirmed
  rejection with zero line items (both branches individually, not just the first one reached),
  confirmed success stamps `issued_at`/`status_changed_at`/`status_changed_by` correctly.
- Post-issue immutability: confirmed a header `UPDATE`, a line-item `INSERT`, and a second
  `issue_*()` call are all rejected once a record is `issued`.
- Manual numbering normalisation (`"qt 50"` → `QT-0050`) and duplicate-manual-entry rejection,
  with the friendly error text, not a raw constraint name.
- Cross-tenant project/organisation mismatch rejected on insert.
- Cross-organisation isolation: a second organisation confirmed to see zero rows across `quotes`,
  `progress_claims`, and `quote_line_items` belonging to the first.

Not covered by this local dry run (real Supabase-specific behaviour that can't be stubbed
locally): actual JWT-based session handling, the real `pg_net`/Auth email flows, and the specific
Postgres version/extension set of the live project. The full checklists embedded at the end of
`012`/`013` remain the record of what to re-verify against `hpcqncghvdrlvufxfdnd` itself before
and after live application, same as `010`/`011`.

---

## 10. What these migrations still do not do

No transitions beyond `draft → issued` (§5). No revision/void/correction workflow. No retention
caps. No per-line GST/retention. No multi-currency. Full lists are in each migration's own "NOT
built" section (`012`, `013`).

---

## 11. Project Hub — built, pending manual testing

`project-hub.html` is built on the existing `supabase-project-context.js`/
`supabase-record-panel.js` modules: project header (name, site address, status pill), a tool
launch row ("New Variation Notice" live; "New Quote"/"New Progress Claim" shown disabled —
"Coming soon" — until `012`/`013` are applied and their frontends built), and the project's
variation notices list. `app-dashboard.html`'s project cards now show a single "Open project"
link to the hub in place of the old direct "New Variation Notice" link. `project.html` (legacy,
localStorage-backed) is untouched.

**Not merged.** Manual browser test checklist:
`docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md` — covering authenticated access, invalid/missing
project id, cross-organisation access, header details, the Variation Notice launch link,
project-scoped list rendering, the empty state, mobile layout, return navigation, and the
dashboard's "Open project" links. Must pass before merge.
