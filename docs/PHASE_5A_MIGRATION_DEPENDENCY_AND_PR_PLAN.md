# Sprint 5a — Migration Dependency Map & Clean PR Split Plan

**Purpose:** A single reference for (a) exactly what each of `012`-`017` depends on, so applying
or reviewing them out of order is never ambiguous, and (b) a proposed PR grouping for eventually
landing them — a plan, not yet executed. No migrations are applied and no branches/PRs are
created by this document.
**Status:** Planning only, per explicit instruction.

---

## 1. Dependency map

```
001_create_organisations.sql
004_create_projects.sql
005_phase1_rls.sql (internal.current_organisation_id())
        │
        ├── 012_create_quotes.sql  (core: table, line items, calculations, RLS, grants)
        │       │
        │       ├── 013_create_quote_numbering.sql  (counters, create_quote())
        │       │       │
        │       │       └── 014_create_quote_issue_workflow.sql  (issue_quote(), BLOCKED: none — issuing works)
        │       │
        │       └── (013 and 014 both also directly reference 012's tables/indexes;
        │            014 does not require 013 to function, only to be useful —
        │            see §2)
        │
        └── 015_create_progress_claims.sql  (core, mirrors 012)
                │
                ├── 016_create_progress_claim_numbering.sql  (counters, create_progress_claim())
                │       │
                │       └── 017_create_progress_claim_issue_workflow.sql  (issue_progress_claim(),
                │                                                          BLOCKED: temporary gate,
                │                                                          see decision log)
                │
                └── (same 016/017 relationship as 013/014 above)
```

Quotes (`012`/`013`/`014`) and Progress Claims (`015`/`016`/`017`) have **zero cross-references**
to each other — confirmed in both migration review docs. Either tool's three-file stack can be
applied, reviewed, or reverted independently of the other's existing at all.

## 2. What each layer actually requires vs. merely benefits from

| Migration | Hard dependency | Functions without, but... |
|---|---|---|
| `012` | `001`, `004`, `005` | Fully functional alone — draft quotes with manually-typed `quote_number`, full calculation ownership, full RLS. This is the real `010`-equivalent state. |
| `013` | `012` (table + `quotes_org_number_unique_idx`) | Without it, `quote_number` stays manual-only (`012`'s own behaviour) — not broken, just less convenient. |
| `014` | `012` (table), `013` NOT structurally required — `014` only adds columns/trigger/RPC to what `012` already defines | Without `013`, quotes issued via `014` alone would still work but every `quote_number` would need to be manually supplied at creation (no auto-assignment). Applying `014` before `013` is *possible* but not the intended or tested order — the local dry run only exercises `012→013→014`. |
| `015` | `001`, `004`, `005` | Same relationship to `012` as `015` mirrors it. |
| `016` | `015` | Same as `013`/`012`. |
| `017` | `015`; not structurally dependent on `016` | Same caveat as `014`/`013` — untested order if applied before `016`. **Also: BLOCKED regardless of what it's applied on top of** — see the decision log. |

**Practical implication:** `012`→`013`→`014` and `015`→`016`→`017` are the only two orders this
project has actually tested (`docs/PHASE_5A_DESIGN_PROPOSAL.md` §9). Even where a later layer
doesn't hard-fail without an earlier one, applying out of the tested order is not recommended
without a fresh local dry run against that specific order.

## 3. Proposed PR grouping (plan only — not created)

Six files does not have to mean six PRs. Proposed grouping, balancing review overhead against
the actual risk profile of each layer:

| PR | Contents | Rationale |
|---|---|---|
| **Quotes — Core + Numbering** | `012`, `013` | Lowest risk: table shape, calculations, and numbering all mirror `010`/`011`'s already-live, already-proven pattern closely. Reviewing them together is reasonable — neither introduces the newer, less-precedented issue-workflow machinery. |
| **Quotes — Issue Workflow** | `014` | Reviewed and merged separately, deliberately — this is the newest, least-precedented layer (RPC-only issuing, column-scoped grants, the one that caught a real bug in this session's own review). Isolating it for review and for rollback is the entire point of the restructure. |
| **Progress Claims — Core + Numbering** | `015`, `016` | Same reasoning as the Quotes pair. Includes the new interim overclaiming constraint, which is itself worth its own focused look. |
| **Progress Claims — Issue Workflow (BLOCKED)** | `017` | Opened for review of the *mechanism* only (the gate, the RPC shape, the snapshot) — not for merge-and-forget. PR description should say plainly: approve the design, but do not expect this to enable real issuing; it can't, by construction, until the decision log closes. |

**Why not one PR per file (six total):** the Core+Numbering pairs share almost all their review
context (same table, same reviewer questions about column choices) — splitting them adds process
overhead without a corresponding safety benefit, since neither introduces the issue-workflow risk
profile the restructure was actually protecting against. **Why not fewer than four:** collapsing
Core+Numbering with Issue Workflow reintroduces exactly the bundling this restructure undid.

**Sequencing relative to application:** each PR, once merged to `main`, still only represents
*reviewed source*, not applied database state — applying to `hpcqncghvdrlvufxfdnd` remains a
separate, explicit step per `docs/BACKEND_MIGRATION_CHECKLIST.md`, gated the same way `010`/`011`
were (review sign-off, then live catalog + functional verification with disposable data). Merging
a migration PR to `main` is not itself permission to apply it.

## 4. Explicit non-actions

Per instruction, none of the following have been done as part of this planning pass:
- No branch created for either proposed PR.
- No migration applied to Supabase.
- No change to the six existing migration files' content.
- No frontend work for either tool.
