# Progress Claims — External Decision Log

**Purpose:** A single, trackable record of the decisions that sit outside engineering's control
and gate real Progress Claim issuing. Each entry below is a real, unresolved question — this log
exists so the answer, when it arrives, has one obvious place to land, and so nobody has to
re-derive "what exactly are we waiting on" by re-reading the full migration review.
**Status:** Active. All 5 items below unresolved. Engineering work independent of these
questions (schema, RLS, calculations, numbering) is complete and locally verified —
`docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md` has the full technical detail.
**Enforcement while unresolved:** `017_create_progress_claim_issue_workflow.sql`'s
`enforce_progress_claim_status_transition()` unconditionally rejects every `draft → issued`
attempt — a database-level gate, not a frontend convention. Drafts remain fully creatable,
editable, and calculable. See §5 of the migration review for the exact mechanism.
**Owner:** BIK Solutions Pty Ltd — each item needs sign-off from an accountant and/or the
contract-policy owner, not from engineering.

---

## Open items

### 1. GST timing relative to retention

**Question:** Is GST correctly calculated on the full claimed amount before retention is
withheld (the platform's current default, `gst_on_claim_before_retention`), or only on the net
amount actually paid after retention deduction?
**Why it matters:** Changes `gst_cents` on every claim; a wrong default could mean incorrect tax
invoices issued to real clients.
**Current schema behaviour:** `progress_claims.gst_calculation_method` records which method was
applied, defaulting to and only implementing `gst_on_claim_before_retention` today — explicit and
auditable, not silently assumed. Confirming this question does not require a schema change,
only setting the confirmed method as the implemented default (already is) or adding a second
implemented value if the answer turns out to depend on contract terms.
**Status:** Open.
**Decision:** —
**Decided by / date:** —

### 2. Retention basis — GST-inclusive or GST-exclusive

**Question:** Should `retention_amount_cents` be calculated on the GST-exclusive claim amount
(the current implementation, `round(this_claim_cents * retention_rate)`) or on a GST-inclusive
figure?
**Why it matters:** Directly changes the dollar amount withheld from every payment claim.
**Current schema behaviour:** `retention_calculation_method` records the method
(`flat_percentage_of_claim`, GST-exclusive basis), same auditability pattern as GST.
**Status:** Open.
**Decision:** —
**Decided by / date:** —

### 3. Treatment of previously claimed amounts

**Question:** Is deriving `previously_claimed_cents` as the sum of prior `issued`/`approved`/
`paid` claims' `this_claim_cents` on the same project the correct rule — and is it acceptable
that the *line-level* figure of the same name remains user-entered rather than derived (see the
migration review §"Relationship to earlier claims" for why true per-line derivation needs a
shared schedule-of-values template that doesn't exist yet)?
**Why it matters:** Affects `claimed_to_date_cents`, `remaining_value_cents`, and therefore every
downstream total on every subsequent claim in a project.
**Current schema behaviour:** Header-level figure is database-derived and frozen at creation,
directly editable while draft (a documented manual-correction allowance). Line-level figure is
user-entered.
**Status:** Open.
**Decision:** —
**Decided by / date:** —

### 4. Whether overclaiming is permitted

**Question:** Should a claim ever be allowed to represent `claimed_to_date_cents >
contract_value_cents` (a negative `remaining_value_cents`) — e.g. to reflect legitimate,
not-yet-formalised variations — or should that always be rejected?
**Why it matters:** Real construction contracts do exceed original value via variations; but an
unconstrained system can't distinguish that from a data-entry error.
**Current schema behaviour:** **Interim tightening already applied**, per explicit instruction,
ahead of this question being answered: `progress_claims_totals_non_negative_check` now includes
`remaining_value_cents >= 0`, enforced at the core layer for every draft (not just at issue
time). This is a deliberate, reversible safety default — not a final position. If the eventual
answer is "overclaiming should be permitted under some conditions," this constraint will need to
be loosened (e.g. contract value should include approved variations first — see item 5 — which
may resolve this without loosening anything).
**Status:** Open (interim rule applied, see above).
**Decision:** —
**Decided by / date:** —

### 5. Whether contract value includes approved variations

**Question:** Should `contract_value_cents` (summed from the claim's own schedule-of-values line
items) automatically reflect approved variations, or does it require the builder to manually
re-enter an updated figure into each new claim's schedule?
**Why it matters:** Directly affects item 4 above — if approved variations should inflate
contract value automatically, the "overclaiming" question changes shape. Also affects whether a
claim's `contract_value_cents` should be checked for consistency against the prior claim's (not
currently done — see the migration review's "Relationship to earlier claims").
**Current schema behaviour:** No automatic mechanism. Each claim's `contract_value_cents` is
independently derived from its own line items, with no link to project-level variation records
(Variation Notices exist as their own tool/table but nothing currently connects the two).
**Status:** Open.
**Decision:** —
**Decided by / date:** —

---

## What is NOT gated by this log

Draft creation, editing, line-item entry, and all calculation logic (subtotal, GST, retention,
net payable, the interim overclaiming guard) work today and can be tested internally without
waiting on any of the above — see `docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md`'s verdict.
Only the `draft → issued` transition is blocked.

## How to close an item

1. Record the decision, who made it, and the date in the relevant section above.
2. If it changes schema behaviour (e.g. a new `gst_calculation_method` value, a loosened
   overclaiming constraint), that's a small, separately reviewed follow-up migration — not a
   reason to revisit `015`/`016`'s already-verified structure.
3. Once **all five** items are closed, the one-line removal of the temporary gate in
   `017_create_progress_claim_issue_workflow.sql` (see that file's own comments) becomes safe to
   draft as its own reviewed migration. Not before.
