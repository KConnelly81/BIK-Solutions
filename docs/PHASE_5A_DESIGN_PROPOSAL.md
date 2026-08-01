# Sprint 5a Design Proposal — Quotes, Progress Claims & Project Hub

**Status:** Revised draft (v2) — awaiting review. No migration SQL has been written against
this proposal. v1 proposed JSONB line items; this revision replaces that with typed child
tables per explicit direction, and adds server-side calculation ownership, DB-enforced
issued-document immutability, and final numbering formats.
**Scope:** Final schema for `quotes`/`quote_line_items` and `progress_claims`/
`progress_claim_line_items` (the ADR-016 dedicated-table pattern, per
`docs/BACKEND_MIGRATION_CHECKLIST.md`), plus the Project Hub page (approved in principle,
frontend work proceeding separately from this doc).
**Precedent:** `010_create_variation_notices.sql` / `011_variation_notice_number_generator.sql`,
both live and verified.

---

## 1. Calculation ownership rule (applies to both tables)

**The client proposes, the database decides.** Every RPC (`create_quote`, `create_progress_claim`,
and their `update_*` counterparts while a record is still `draft`) recomputes every derived
figure server-side from the typed inputs it receives. A client-submitted total, subtotal, GST
figure, or line total is never written to a column as-is — it is recalculated and the client's
figure discarded. This is the same principle already applied to canonical numbering (client
proposes a number, the database validates/assigns it) extended to money.

---

## 2. Final schema — Quotes

### `public.quotes`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `organisation_id` | `uuid not null references organisations(id) on delete restrict` | |
| `project_id` | `uuid not null references projects(id) on delete restrict` | `NOT NULL` — a `draft`-status project can exist before a job is won, so this doesn't force a false choice. |
| `quote_number` | `text not null` | Canonical `QT-0001`, unique **per organisation**. See §4. |
| `client_name`, `client_email`, `client_phone`, `client_address` | `text` | Snapshotted at insert, frozen thereafter (see §5). |
| `quote_date` | `date not null default current_date` | |
| `valid_until` | `date` | |
| `quote_type` | `text not null check (quote_type in ('fixed','estimate','cost-plus'))` | |
| `scope_of_works`, `inclusions`, `exclusions`, `assumptions`, `optional_items`, `payment_terms`, `additional_terms` | `text` | |
| `deposit_percent` | `smallint check (deposit_percent in (0,5,10,20,25,50))` | |
| `builder_approval_name` | `text` | |
| `subtotal_cents`, `gst_cents`, `total_cents` | `integer not null default 0` | **Server-computed** — sum of `quote_line_items.line_total_cents`, never client-supplied. |
| `status` | `text not null default 'draft' check (status in ('draft','issued','accepted','declined','expired'))` | |
| `issued_at` | `timestamptz` | Set once, by trigger, on the `draft → issued` transition. |
| `status_changed_at`, `status_changed_by` | `timestamptz`, `uuid references auth.users(id) on delete set null` | |
| `created_at`/`updated_at`/`created_by`/`updated_by` | standard audit columns | |

### `public.quote_line_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `quote_id` | `uuid not null references quotes(id) on delete cascade` | Cascade here is deliberate — see the deletion note below, it does not conflict with ADR-010. |
| `position` | `smallint not null` | Display order; `unique (quote_id, position)`. |
| `description` | `text not null` | |
| `quantity` | `numeric(12,2) not null default 1` | |
| `unit` | `text` | e.g. `m2`, `item`, `hr`, `ls`. |
| `unit_price_cents` | `integer not null` | Client-supplied input. |
| `gst_applicable` | `boolean not null default true` | |
| `line_total_cents` | `integer not null` | **Server-computed** = `round(quantity * unit_price_cents)`. |
| `created_at`/`updated_at` | standard | |

No `organisation_id` on the child table — RLS scopes it through a join to `quotes`, avoiding a
duplicated, independently-driftable tenant column on every line.

**On the cascade delete:** ADR-010's soft-delete-only rule is about the top-level document
(`status = 'archived'` in place of `DELETE`). It was never a rule about a draft's own working
rows. While a quote is `draft`, line items are freely added, edited and deleted as the builder
prices the job — real `DELETE` on `quote_line_items` is normal editing, not document loss. Once
`status` moves past `draft`, the immutability trigger (§5) blocks all further changes to line
items, same as it blocks changes to the parent row.

---

## 3. Final schema — Progress Claims

### `public.progress_claims`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `organisation_id` | `uuid not null references organisations(id) on delete restrict` | |
| `project_id` | `uuid not null references projects(id) on delete restrict` | |
| `claim_number` | `text not null` | Canonical `PC-001`, unique **per project**. See §4. |
| `client_name`, `client_email` | `text` | Snapshot. |
| `contract_ref` | `text` | |
| `claim_date` | `date not null default current_date` | |
| `claim_period_from`, `claim_period_to` | `date` | |
| `contract_value_cents` | `integer not null` | **Server-computed** = sum of `progress_claim_line_items.contract_value_cents`. |
| `previously_claimed_cents` | `integer not null default 0` | **Server-computed and frozen at insert** — see §6. |
| `this_claim_cents` | `integer not null` | **Server-computed** = sum of line items' `this_claim_cents`. |
| `claimed_to_date_cents` | `integer not null` | **Server-computed** = `previously_claimed_cents + this_claim_cents`. |
| `remaining_value_cents` | `integer not null` | **Server-computed** = `contract_value_cents - claimed_to_date_cents`. |
| `gst_applicable` | `boolean not null default true` | |
| `gst_cents` | `integer not null` | **Server-computed** — see the GST-timing flag in §7. |
| `retention_rate` | `numeric(5,2) not null default 0` | Percentage, e.g. `5.00`. Held **only at header level** — see §7. |
| `retention_amount_cents` | `integer not null` | **Server-computed** = `round(this_claim_cents * retention_rate / 100)`, frozen. |
| `net_payable_cents` | `integer not null` | **Server-computed** = `this_claim_cents + gst_cents - retention_amount_cents`. |
| `percent_complete` | `numeric(5,2)` | Overall job percentage, informational. |
| `description_of_work`, `special_conditions` | `text` | |
| `builder_approval_name`, `client_approval_name` | `text` | |
| `status` | `text not null default 'draft' check (status in ('draft','issued','approved','disputed','paid'))` | |
| `issued_at`, `status_changed_at`, `status_changed_by` | as Quotes | |
| `created_at`/`updated_at`/`created_by`/`updated_by` | standard | |

`schedule_of_values` (the old freeform textarea) is **dropped**, not ported — it's superseded by
`progress_claim_line_items` below, which is the structured version of the same information. No
live data exists yet for this tool, so there's nothing to migrate.

### `public.progress_claim_line_items`

The structured schedule of values — the industry-standard breakdown (earthworks, concrete,
framing, etc.), replacing the freeform textarea with typed, claimable rows.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `progress_claim_id` | `uuid not null references progress_claims(id) on delete cascade` | Same cascade reasoning as quote line items. |
| `position` | `smallint not null` | `unique (progress_claim_id, position)`. |
| `description` | `text not null` | The schedule item, e.g. "Concrete slab and footings". |
| `contract_value_cents` | `integer not null` | This item's share of the contract. |
| `previously_claimed_cents` | `integer not null default 0` | **User-editable, not derived** — see §6 for why. |
| `this_claim_percent` | `numeric(5,2)` | Optional — if given, `this_claim_cents` is server-computed from it. |
| `this_claim_cents` | `integer not null` | Server-computed from `this_claim_percent` if provided, otherwise the client-entered figure is accepted as this line's direct input (not further derived). |
| `claimed_to_date_cents` | `integer not null` | **Server-computed** = `previously_claimed_cents + this_claim_cents`. |
| `remaining_value_cents` | `integer not null` | **Server-computed** = `contract_value_cents - claimed_to_date_cents`. |
| `created_at`/`updated_at` | standard | |

No per-line retention — retention is a payment-terms concept applied to the whole claim, not to
individual schedule items, and the original tool only ever had one `retentionRate` field. Adding
per-line retention would be complexity with no product justification; header-level retention
satisfies "where applicable" from the brief.

---

## 4. Numbering

Both use the `011` pattern exactly: a dedicated `internal.*_counters` table (RLS enabled, zero
policies, zero grants), a canonical-format helper, a manual-entry normaliser, a `BEFORE INSERT`
assignment trigger with the proactive collision-avoidance loop, and a `create_*()`
`SECURITY INVOKER` RPC wrapping validation + insert + bounded retry on the unique-violation
constraint.

- **Quotes — `QT-0001`, unique per organisation.** `internal.quote_counters` keyed by
  `organisation_id`. A builder thinks in terms of their own quote sequence, and quotes commonly
  precede a project being fully set up, so organisation scope (not project scope) is correct.
- **Progress Claims — `PC-001`, unique per project.** `internal.progress_claim_counters` keyed
  by `project_id`. Claims are inherently sequential within one contract ("Claim 3 of the Smith
  job"), matching Variation Notice's `VAR-NNN` project-scoped precedent.

**Manual override and normalisation (both tables, same as `011`):** a user may type a number
instead of accepting the auto-assigned one. The normaliser uppercases the prefix, validates it
matches the canonical pattern for that table (`^QT-\d{4}$` / `^PC-\d{3}$`), and rejects anything
that doesn't fit the format outright rather than attempting to reshape it. The assignment trigger
then checks the normalised number isn't already used in that scope (`organisation_id` for
quotes, `project_id` for claims); on collision it raises the same friendly conflict error
Variation Notice already surfaces, and the counter is never decremented on a failed manual entry
— only ever advanced, matching the existing `prevent_*_counter_decrease()` guard pattern.

---

## 5. Snapshot and immutability approach

Client fields are frozen at insert (already agreed). This revision adds the piece the executive
review flagged as missing: **database-enforced** immutability, not just an app-level convention.

- A `BEFORE UPDATE` trigger on `quotes` and `progress_claims` — `enforce_<table>_issued_immutability()`
  — rejects any change to a financial or content column once `status` has moved past `draft`.
  The only columns it allows to keep changing post-draft are `status`, `status_changed_at`,
  `status_changed_by`, `builder_approval_name`/`client_approval_name` (the approval workflow),
  and `updated_at`/`updated_by`.
- A matching `BEFORE INSERT OR UPDATE OR DELETE` trigger on both line-item tables rejects any
  change once the parent record's `status` is not `draft`.
- `issued_at` is set exactly once, by trigger, on the specific `draft → issued` transition — not
  writable directly, and not overwritable on a later status change.

This closes the gap between "the frontend won't let you edit an issued document" and "the
document is actually provably fixed" — material for Progress Claims specifically, since an
issued claim is a legal payment claim under state Security of Payment legislation with statutory
response deadlines, and the stored record may need to match exactly what was served if a dispute
reaches adjudication.

---

## 6. Where "previously claimed" is genuinely derived, and where it isn't

Two different things share a similar name and need to be kept separate:

- **Header-level `previously_claimed_cents`** (on `progress_claims` itself) **is fully derived
  and database-computed.** The `create_progress_claim` RPC sums `this_claim_cents` from prior
  claims on the same project with `status in ('issued','approved','paid')`, writes the result,
  and freezes it. This is safe because it only requires knowing the project, not matching
  individual schedule items across claims.
- **Line-level `previously_claimed_cents`** (on `progress_claim_line_items`) **is user-entered,
  not derived**, in this revision. Deriving it correctly would require matching a schedule item
  in this claim to "the same" schedule item in a prior claim — reliable only if claims share a
  stable, identity-bearing schedule of values, which they don't yet (each claim's line items are
  typed fresh). Building that (e.g. a shared `project_schedule_items` template that every claim
  on a project references) is a real improvement but a bigger feature than Sprint 5a's scope.
  Flagging this explicitly rather than quietly under-delivering on "claimed to date" accuracy at
  the line level — the header-level figure is the one the platform can actually stand behind.

---

## 7. Open questions / trade-offs carried forward — need explicit sign-off

1. **GST relative to retention, for Progress Claims.** This design computes `gst_cents` on the
   full `this_claim_cents` (before retention is withheld) and deducts retention afterward in
   `net_payable_cents`. This matches common Australian construction practice (retention is a
   withholding against payment, not a reduction of the taxable supply) but GST attribution timing
   has real ATO nuance that depends on the entity's accounting basis and contract terms. This is
   flagged for confirmation from an accountant or the eventual Invoices-tool compliance review,
   not asserted as correct — recommend not treating this column as final until that check happens.
2. **Minimum one line item.** Recommend requiring at least one row in both line-item tables
   before a document can move out of `draft` (enforced in the RPC, not a bare-metal `CHECK`, so
   the error message can be specific). A quote or claim with zero priced items isn't a real
   document.
3. **Progress Claims' structured schedule is a bigger UI change than a straight port.** Moving
   from one freeform textarea to a repeating line-item editor is the same UI component Quote
   Builder now also needs — genuine reuse opportunity, but it means Progress Claims' frontend
   work in Sprint 5a is not just "wire up the existing form," the schedule-of-values section
   needs to be rebuilt. Flagging so this isn't underestimated when the frontend work is scoped.

---

## 8. RLS and privileges (both new table pairs)

Same pattern as `010`/`011`, applied to four tables now instead of one:

- [ ] `enforce_<table>_project_same_organisation()` trigger on `quotes` and `progress_claims`
      (not needed on the line-item children — they inherit tenancy through their parent).
- [ ] `enforce_<table>_issued_immutability()` trigger on all four tables, per §5.
- [ ] `set_updated_at()` reused, not reimplemented.
- [ ] RLS enabled on all four tables. `quotes`/`progress_claims`: 3 policies each
      (`select`/`insert`/`update`, no `delete`, scoped `organisation_id = internal.current_organisation_id()`).
      Line-item tables: same 3 operations plus `delete` (per §2's cascade note), each scoped via
      `exists (select 1 from quotes/progress_claims parent where parent.id = quote_id/progress_claim_id
      and parent.organisation_id = internal.current_organisation_id())`.
- [ ] Explicit grants on all four: `revoke all ... from public, anon; grant select, insert,
      update on quotes, progress_claims to authenticated; grant select, insert, update, delete on
      quote_line_items, progress_claim_line_items to authenticated`. Nothing inherited by default.
- [ ] Counter tables (`internal.quote_counters`, `internal.progress_claim_counters`): RLS enabled,
      zero policies, zero grants — identical to `internal.variation_number_counters`.
- [ ] Local Postgres dry run as the `authenticated` role before anything touches live Supabase,
      same test matrix `011` used (auto-assign, manual-entry normalisation, duplicate rejection,
      cross-organisation rejection, counter non-decrease, concurrency).

---

## 9. What this document still does not do

No migration SQL, no RPC bodies, no trigger function bodies are written here. Migrations `012`
(`quotes`/`quote_line_items`) and `013` (`progress_claims`/`progress_claim_line_items`) get
drafted only after this revision is reviewed, then go through the same local-dry-run → review →
apply → verify sequence as `010` and `011`.

---

## 10. Project Hub — status note

Approved in principle (separate from the schema questions above). Frontend build proceeding
against `project-hub.html?project=<id>` on the existing `supabase-project-context.js` /
`supabase-record-panel.js` modules, per the plan in the prior revision of this document (§4,
retained below for reference). `project.html` (legacy, localStorage-backed) is untouched.

### Project Hub design (unchanged from v1)

- `app-dashboard.html`'s project cards drop their inline "New Variation Notice" link in favour of
  a single `Open project` link to the hub.
- Header: project name, site address, status pill.
- Tool launch row: "New Variation Notice", "New Quote", "New Progress Claim" (and future tools),
  each linking to `<tool>.html?project=<id>`.
- Document summary: three lists (variation notices / quotes / progress claims for this project)
  via `supabase-record-panel.js`'s `refreshRecordList()`, filtered by `project_id`.
- Totals strip: deferred/optional, not the hard commitment.

This section will be merged into the schema sections above once Quotes and Progress Claims have
real tables to list — for now the hub's record lists only have Variation Notice data to show,
which is expected and not a blocker to building the page now.
