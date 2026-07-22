# BIK UI Rollout — Tool Inventory
**Branch:** `claude/ui-rollout-sprint`  
**Date:** 2026-07-22  
**Scope:** All HTML pages assessed for design-system migration status

---

## Migration Status Key

| Status | Meaning |
|---|---|
| ✅ MIGRATED | `bik-design-system.css`, `bik-app-header`, `bik-btn` all applied |
| ⚠️ PARTIAL | Design system linked but header or buttons not fully migrated |
| ❌ NOT MIGRATED | Still using legacy `app-header`, `app-btn`, `styles.css` only |
| 🚫 EXCLUDED | Marketing/public page — intentionally uses `site-nav` + `styles.css` |

---

## App Core Pages

| File | Type | Header | Buttons | Forms | Status |
|---|---|---|---|---|---|
| `dashboard.html` | Operational Dashboard | `bik-app-header` + `bik-app-nav` | `bik-btn` | `bik-*` tokens | ✅ MIGRATED |
| `project.html` | Project Workspace | `bik-app-header` + `bik-app-nav` | `bik-btn` | `bik-*` tokens | ✅ MIGRATED |
| `ai-documents.html` | Document History Hub | `site-nav` (wrong) | legacy | `styles.css` | ❌ NOT MIGRATED |
| `toolkit.html` | Tool Catalogue (marketing) | `site-nav` (correct) | `.btn` | `styles.css` | 🚫 EXCLUDED |

---

## Site / Attendance Pages

| File | Type | Header | Buttons | Forms | Status |
|---|---|---|---|---|---|
| `attendance.html` | Operational Dashboard | `bik-app-header` | `bik-btn` | `bik-*` tokens | ✅ MIGRATED |
| `checkin.html` | Worker Sign-In (mobile) | Custom `.ci-header` (bik tokens) | `.btn-primary` (bik tokens) | `bik-*` tokens | ✅ MIGRATED |
| `checkout.html` | Worker Sign-Out (mobile) | Custom `.ci-header` (bik tokens) | `.btn-primary` (bik tokens) | `bik-*` tokens | ✅ MIGRATED |

---

## Document Builders — Commercial / Contract

| File | Tool Name | Type | Header | Buttons | Status | Batch |
|---|---|---|---|---|---|---|
| `variation-generator.html` | Variation Notice | Commercial | `bik-app-header` | `bik-btn` | ✅ MIGRATED | — |
| `quote-builder.html` | Quote Builder | Commercial | `bik-app-header` | `bik-btn` | ✅ MIGRATED | — |
| `progress-claim.html` | Progress Claim | Commercial | `bik-app-header` | `bik-btn` | ✅ MIGRATED | — |
| `payment-reminder.html` | Payment Reminder | Commercial | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `eot-claim.html` | EOT Claim | Commercial/Contract | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `delay-notice.html` | Delay Notice | Commercial/Contract | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `instruction-to-proceed.html` | Instruction to Proceed | Commercial/Contract | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `subcontractor-agreement.html` | Subcontractor Agreement | Commercial | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `notice-to-show-cause.html` | Notice to Show Cause | Commercial/Legal | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `contract-termination.html` | Contract Termination | Commercial/Legal | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | B |
| `scope-of-works.html` | Scope of Works | Document Builder | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | E |

---

## Document Builders — Safety

| File | Tool Name | Type | Header | Buttons | Status | Batch |
|---|---|---|---|---|---|---|
| `swms.html` | SWMS | Safety | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | A |
| `toolbox-talk.html` | Toolbox Talk | Safety | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | A |
| `incident-report.html` | Incident Report | Safety | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | A |
| `inspection-checklist.html` | Inspection Checklist | Safety/Quality | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | A |

---

## Document Builders — Quality / Handover

| File | Tool Name | Type | Header | Buttons | Status | Batch |
|---|---|---|---|---|---|---|
| `defect-report.html` | Defect Report | Quality | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | C |
| `non-conformance-report.html` | Non-Conformance Report | Quality/Safety | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | C |
| `practical-completion.html` | Practical Completion | Handover | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | D |
| `handover-checklist.html` | Handover Checklist | Handover | `app-header` (legacy) | `app-btn` (legacy) | ❌ NOT MIGRATED | D |

---

## Marketing / Public Pages (Excluded from rollout)

These pages use `site-nav` and `styles.css` by design. They are public-facing marketing pages and are intentionally excluded from the app-shell migration.

| File | Notes |
|---|---|
| `index.html` | Homepage — `site-nav` ✓ |
| `landing.html` | Landing page — `site-nav` ✓ |
| `about.html` | About — `site-nav` ✓ |
| `builders.html` | Builders page — `site-nav` ✓ |
| `contact.html` | Contact — `site-nav` ✓ |
| `faq.html` | FAQ — `site-nav` ✓ |
| `founding-builder.html` | Founding Builder — `site-nav` ✓ |
| `privacy-policy.html` | Legal — `site-nav` ✓ |
| `terms-of-use.html` | Legal — `site-nav` ✓ |
| `ai-usage-notice.html` | Legal/AI — `site-nav` ✓ |
| `resources.html` | Resources — `site-nav` ✓ |
| `roadmap.html` | Roadmap — `site-nav` ✓ |
| `release-notes.html` | Release Notes — `site-nav` ✓ |
| `services.html` | Services — `site-nav` ✓ |
| `shop.html` | Shop — `site-nav` ✓ |
| `templates.html` | Templates — `site-nav` ✓ |
| `support.html` | Support — `site-nav` ✓ |
| `quick-start.html` | Quick Start — `site-nav` ✓ |
| `trial-guide.html` | Trial Guide — `site-nav` ✓ |
| `productivity.html` | Productivity — `site-nav` ✓ |
| `coming-soon.html` | Coming Soon — `site-nav` ✓ |
| `welcome-email.html` | Welcome Email — standalone ✓ |
| `construction-resources.html` | Resources — `site-nav` ✓ |

---

## Migration Batch Plan

### BATCH A — Safety Tools
**Files:** `swms.html`, `toolbox-talk.html`, `incident-report.html`, `inspection-checklist.html`  
**Priority:** High — safety tools carry the highest trust requirement; inconsistent UI undermines credibility.

### BATCH B — Commercial & Contract Tools
**Files:** `payment-reminder.html`, `eot-claim.html`, `delay-notice.html`, `instruction-to-proceed.html`, `subcontractor-agreement.html`, `notice-to-show-cause.html`, `contract-termination.html`  
**Priority:** High — these tools handle money and legal relationships.

### BATCH C — Quality Tools
**Files:** `defect-report.html`, `non-conformance-report.html`  
**Priority:** Medium — used frequently on active projects.

### BATCH D — Handover & Completion
**Files:** `practical-completion.html`, `handover-checklist.html`  
**Priority:** Medium — used at project close-out.

### BATCH E — Remaining App Pages
**Files:** `scope-of-works.html`, `ai-documents.html`  
**Priority:** `ai-documents.html` is high (app core page using wrong header). `scope-of-works.html` is standard document builder migration.

---

## Migration Pattern (Document Builders)

All document builders share the same structural migration:

**1. CSS links** — add `bik-design-system.css` before `styles.css` and `toolkit-app.css`  
**2. Header** — replace `app-header` with `bik-app-header` markup  
**3. Autosave** — replace `autosave-indicator`/`autosave-dot` with `bik-autosave`/`bik-autosave-dot`  
**4. Spacer** — replace `app-header-spacer` with `bik-app-header-spacer`  
**5. Actions** — replace `app-header-actions` with `bik-app-header-actions`  
**6. Buttons** — replace `app-btn app-btn--ghost` → `bik-btn bik-btn--ghost-dark bik-btn--sm`  
**7. Buttons** — replace `app-btn app-btn--coral` → `bik-btn bik-btn--primary bik-btn--sm`  
**8. Buttons** — retain `app-btn--ai` as modifier alongside `bik-btn` (AI-specific toolkit styles)  
**9. Logo** — replace `logo-mark` with `bik-logo-mark`; use `bik-logo-name` for tool title  

**Preserved unchanged:**  
- All `id=` attributes  
- All JS module imports  
- All form schema references  
- `toolkit-app.css` structural layout (split panel, form sections, preview panel, progress bar, draft restore, tabs, print styles)  
- `draft-btn` classes (functional, not visual)

---

## Legacy Classes Encountered

| Class | Location | Plan |
|---|---|---|
| `.app-header` | All unmigrated document builders | **Migrate** → `bik-app-header` |
| `.app-header-logo` | All unmigrated document builders | **Migrate** → `bik-app-header-logo` |
| `.app-header-spacer` | All unmigrated document builders | **Migrate** → `bik-app-header-spacer` |
| `.app-header-actions` | All unmigrated document builders | **Migrate** → `bik-app-header-actions` |
| `.logo-mark` | All unmigrated document builders | **Migrate** → `bik-logo-mark` |
| `.app-title-group` | All unmigrated document builders | **Migrate** → `bik-logo-text` |
| `.tool-name` | All unmigrated document builders | **Migrate** → `bik-logo-name` |
| `.tool-back` | All unmigrated document builders | **Migrate** → `bik-logo-tag` |
| `.autosave-indicator` | All unmigrated document builders | **Migrate** → `bik-autosave` |
| `.autosave-dot` | All unmigrated document builders | **Migrate** → `bik-autosave-dot` |
| `.app-btn` | All unmigrated document builders | **Migrate** → `bik-btn` base |
| `.app-btn--ghost` | All unmigrated document builders | **Migrate** → `bik-btn--ghost-dark bik-btn--sm` |
| `.app-btn--ghost-dark` | All unmigrated document builders | **Migrate** → `bik-btn--ghost-dark bik-btn--sm` |
| `.app-btn--coral` | All unmigrated document builders | **Migrate** → `bik-btn--primary bik-btn--sm` |
| `.app-btn--ai` | All unmigrated document builders | **Retain** as modifier (AI-specific styles in toolkit-app.css) |
| `.draft-btn` | All document builders | **Retain** (functional restore/discard pattern, not visual) |
| `.draft-btn--restore` | All document builders | **Retain** |
| `.draft-btn--discard` | All document builders | **Retain** |
| `.site-nav` | `ai-documents.html` | **Migrate** → `bik-app-header` + `bik-app-nav` |
