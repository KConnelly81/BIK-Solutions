# Sprint 5a Design Proposal — Quotes, Progress Claims & Project Hub

**Status:** Draft — awaiting review. No migration SQL has been written against this proposal.
**Scope:** Field inventory and open design questions for `quotes` and `progress_claims`
(the ADR-016 dedicated-table pattern, per `docs/BACKEND_MIGRATION_CHECKLIST.md`), plus the
shape of the new Project Hub page that becomes the single navigation point for a project's tools.
**Precedent:** `010_create_variation_notices.sql` / `011_variation_notice_number_generator.sql`,
both live and verified. Sprint 5a follows the same checklist, starting from field inventory.

---

## 1. Field inventory — Quotes (from `js/tools/quote-builder/config.js`)

| Form field | Proposed column | Type | Notes |
|---|---|---|---|
| builderName, builderABN, builderLicence, builderPhone, builderEmail, builderAddress | — | — | `profile: true` — drawn live from the organisation profile at render time, same as Variation Notice. Not stored per-row. |
| clientName, clientEmail, clientPhone, clientAddress | `client_name`, `client_email`, `client_phone`, `client_address` | text | Snapshotted at save time, same as Variation Notice's `deriveClientSnapshot` — the document must not silently change if the client record changes later. |
| quoteNumber | `quote_number` | text | Auto-assigned, canonical `Q-NNN` — see numbering question below. |
| projectName | — | — | Superseded by `project_id` join; `projects.name` is the source of truth once project-scoped. |
| quoteDate | `quote_date` | date | |
| validUntil | `valid_until` | date | |
| quoteType | `quote_type` | text + check (`fixed`, `estimate`, `cost-plus`) | |
| scopeOfWorks | `scope_of_works` | text | |
| inclusions, exclusions, assumptions, optionalItems | `inclusions`, `exclusions`, `assumptions`, `optional_items` | text | |
| depositPercent | `deposit_percent` | smallint + check (0/5/10/20/25/50) | |
| paymentTerms | `payment_terms` | text | |
| additionalTerms | `additional_terms` | text | |
| builderApprovalName | `builder_approval_name` | text | |
| lineItems (`data._extra.lineItems`) | see §3 open question 1 | — | array of `{description, qty, unit, unitPrice, gst, lineTotal}` |
| subtotal, gst, total | `subtotal_cents`, `gst_cents`, `total_cents` | integer cents | Derived from line items; stored so the issued document is a frozen snapshot, not recomputed on every read. |
| status | `status` | text + check (`draft`, `issued`, `accepted`, `declined`, `expired`) | Mirrors the tool's real states — needs confirmation against the current UI, which today has no explicit status field (localStorage version has none). This is a genuine addition, not a port. |

## 2. Field inventory — Progress Claims (from `js/tools/progress-claim/config.js`)

| Form field | Proposed column | Type | Notes |
|---|---|---|---|
| builderName, ABN, builderPhone, builderEmail, builderAddress | — | — | `profile: true`, same treatment as Quotes. |
| clientName, clientEmail | `client_name`, `client_email` | text | Snapshot, same pattern. |
| projectName, siteAddress | — | — | Superseded by `project_id` join (`projects.name`, `projects.site_address` already exist). |
| contractRef | `contract_ref` | text | |
| claimNumber | `claim_number` | text | Auto-assigned, canonical `PC-NNN` — see numbering question below. |
| claimDate | `claim_date` | date | |
| claimPeriodFrom, claimPeriodTo | `claim_period_from`, `claim_period_to` | date | |
| contractValue | `contract_value_cents` | integer cents | |
| previouslyClaimed | `previously_claimed_cents` | integer cents | Auto-derived at creation, not typed — see open question 3. |
| thisClaimAmount | `this_claim_cents` | integer cents | |
| gstApplicable | `gst_applicable` | boolean | |
| percentComplete | `percent_complete` | smallint | |
| retentionRate, retentionCustom | `retention_rate` | numeric(4,2) | Collapse the two fields into one stored rate; the "custom" UI option just becomes a free-entry value for the same column. |
| descriptionOfWork | `description_of_work` | text | |
| scheduleOfValues | `schedule_of_values` | text | Freeform in the current tool — stays a plain text column, not JSONB. It's prose, not structured line items. |
| specialConditions | `special_conditions` | text | |
| builderApprovalName, clientApprovalName | `builder_approval_name`, `client_approval_name` | text | |
| status | `status` | text + check (`draft`, `issued`, `approved`, `disputed`, `paid`) | Same note as Quotes — a real addition over the current tool, which has no status concept. |

Both tools also confirm the known backlog item (#3): heavy `profile: true` field duplication
against the organisation profile. Not addressed in Sprint 5a — noted for the maintenance
backlog, consistent with how Variation Notice already handles it.

---

## 3. Open design questions — need explicit sign-off before SQL

### 1. Quote line items: JSONB or child table?

Line items are the one structurally new shape — nothing in Variation Notice has a repeating
sub-record. Two options:

- **JSONB column** (`line_items jsonb not null default '[]'`) — simpler: one insert, one table,
  no join, no cascade rules, no second RLS surface. Line items are only ever read or written as
  a complete set (the whole quote is generated/re-rendered together) — no current or foreseeable
  feature filters, sums, or reports on individual line items across quotes.
- **Child table** (`quote_line_items` with `quote_id` FK) — matches ADR-016's general preference
  for typed columns over JSONB, and would let future reporting query line items directly (e.g.
  "total value of concrete work quoted this quarter"). Costs: multi-row transactional insert
  (needs its own RPC step or a follow-up insert after the parent row), its own RLS policies, and
  cascade-delete handling.

**Recommendation: JSONB for Sprint 5a.** ADR-016 reserves JSONB for "genuinely variable
secondary data" — line items are variable-length but uniformly shaped and consumed as a whole,
which is the same shape the ADR's exception was written for. Nothing in the current product
needs cross-quote line-item reporting. If that need appears later, a migration to a child table
is a contained, mechanical change (the JSONB shape already defines the target schema). Flagging
this as the one recommendation most worth a second opinion, since it's a judgment call rather
than a mechanical port like everything else in this proposal.

### 2. Should `project_id` be `NOT NULL` on both tables?

Variation Notice requires it. The concern raised earlier was "a quote could exist before a
project is confirmed." Looking at `app-dashboard.html`, `projects.status` already includes
`draft` — a builder can create a project record the moment they start pricing a job, before
it's won, and only move it to `active` once confirmed. That already covers the "quote before
the job is real" case without a nullable foreign key.

**Recommendation: `NOT NULL` on both**, matching Variation Notice. This keeps RLS, the Project
Hub aggregation queries, and the numbering scope (below) uniform across all three document
types, and avoids a second code path for "orphaned" quotes that later need linking to a project.

### 3. Progress Claims — should `previously_claimed_cents` be computed, not typed?

The current tool has the builder type this figure by hand. Once real rows exist in the same
project, this is a correctness risk (nothing stops it from disagreeing with the actual prior
claims) as well as a missed convenience.

**Recommendation:** compute it automatically at claim-creation time — the `create_progress_claim`
RPC sums `this_claim_cents` from prior claims in the same project with `status in ('issued',
'approved', 'paid')`, and writes the result into `previously_claimed_cents` as a frozen value at
insert time. Not a live-computed column: a progress claim is a document that, once issued, must
not visibly change if a later claim is added or a status changes — same reasoning as the client
snapshot. The field stays user-editable after auto-fill, in case a builder needs to correct it
for a claim made outside the system (e.g. before this tool existed on a given contract).

### 4. Does each tool need atomic numbering (the `011` counter/trigger/RPC machinery)?

- **Quotes: yes.** `quoteNumber` is auto-incremented with an editable override in the existing
  UI — the exact UX Variation Notice had before Sprint 2, which was unsafe under concurrent use.
  Same justification, same pattern: `internal.quote_counters`, canonical `Q-NNN` formatter,
  manual-entry normaliser, `create_quote()` RPC. Recommend scoping the counter **per
  organisation**, not per project — a builder thinks of "my 47th quote," not "the 3rd quote on
  this project," and quotes commonly precede a project being fully set up.
- **Progress Claims: yes, but scoped per project.** `claimNumber` is also auto-incremented, and
  claims are inherently sequential within a single contract ("Claim 3 of the Smith job") — per-
  project scoping, same as Variation Notice's `VAR-NNN`.

---

## 4. Project Hub page

Checked the existing pages before proposing this. Two things already exist and neither is a
direct fit:

- `project.html` — a full project-detail page (status header, contract strip, tool-launch
  grid, timeline, documents-by-tool list) but it's wired to the **legacy** `project-store.js`
  (localStorage, anonymous) system, not Supabase. It's a strong visual/structural precedent —
  status pill, per-tool document grouping, a tool-launch row — but not directly reusable code,
  per the existing "two project systems" boundary documented in `technical-architecture.md`.
- `app-dashboard.html` — the real Supabase dashboard. Each `project-card` currently renders one
  hardcoded link straight to `variation-generator.html?project=<id>` ("New Variation Notice").
  This is the exact thing the Project Hub replaces.

**Proposal: new page, `project-hub.html?project=<id>`**, Supabase-backed, built on
`js/toolkit/supabase-project-context.js` (already gates on session + project, already renders
the org/project context bar — no new gating code needed). Structure, borrowing `project.html`'s
proven layout language but querying real tables:

- Header: project name, site address, status pill (reusing `status-pill--<status>` from
  `css/supabase-app.css`).
- **Tool launch row** — the single source of navigation the user asked for: "New Variation
  Notice," "New Quote," "New Progress Claim" (and future tools), each linking to
  `<tool>.html?project=<id>`. This replaces the inline link on `app-dashboard.html`'s project
  cards, which becomes a single "Open project" link to the hub.
- **Document summary** — three lists (variation notices / quotes / progress claims for this
  project), each using `js/toolkit/supabase-record-panel.js`'s `refreshRecordList()` against the
  respective table filtered by `project_id`, same pattern already built for Variation Notice's
  own in-tool list. Nothing new to write here beyond three config objects.
- **Totals strip** (optional, low cost given the list data is already fetched): count and value
  of variation notices, quotes outstanding, progress claims paid-to-date. Deferred to a follow-up
  pass if it adds scope risk — the navigation requirement is the hard commitment, the dashboard
  polish is not.

`app-dashboard.html` change: the project card's action link changes from `New Variation Notice`
to `Open project` → `project-hub.html?project=<id>`.

---

## 5. What this document does not do

No migration SQL, no RPC definitions, no RLS policies are drafted here. Per
`docs/BACKEND_MIGRATION_CHECKLIST.md` and the pattern followed for every schema change so far
in this project, SQL gets drafted only after the four open questions above are explicitly
resolved, then goes through the same local-dry-run → review → apply → verify sequence as `010`
and `011`.
