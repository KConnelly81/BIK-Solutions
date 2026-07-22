# BIK UI — Legacy Class Migration Log
**Branch:** `claude/ui-rollout-sprint`  
**Date:** 2026-07-22  

---

## Status Key

| Status | Meaning |
|---|---|
| ✅ Migrated | Replaced with bik-* equivalent across all pages |
| 🔒 Retained | Intentionally kept — functional, not purely visual |
| 🚫 Excluded | Marketing pages only — not in scope for app-shell migration |

---

## Document Builder App Shell Classes

These classes appear in `toolkit-app.css` and were used in the `<header class="app-header">` of every unmigrated document builder.

| Legacy Class | Replacement | Status | Notes |
|---|---|---|---|
| `.app-header` | `.bik-app-header` | ✅ Migrated | All 16 unmigrated builders updated |
| `.app-header-logo` | `.bik-app-header-logo` | ✅ Migrated | All 16 builders |
| `.app-header-spacer` | `.bik-app-header-spacer` | ✅ Migrated | All 16 builders |
| `.app-header-actions` | `.bik-app-header-actions` | ✅ Migrated | All 16 builders |
| `.logo-mark` (in app context) | `.bik-logo-mark` | ✅ Migrated | `<span>B</span>` inner span also removed |
| `.app-title-group` | `.bik-logo-text` | ✅ Migrated | All 16 builders |
| `.tool-name` | `.bik-logo-name` | ✅ Migrated | All 16 builders |
| `.tool-back` | `.bik-logo-tag` + `style="text-decoration:none"` | ✅ Migrated | All 16 builders |
| `.autosave-indicator` | `.bik-autosave` | ✅ Migrated | All 16 builders |
| `.autosave-dot` | `.bik-autosave-dot` | ✅ Migrated | All 16 builders |

---

## Button Classes

| Legacy Class | Replacement | Status | Notes |
|---|---|---|---|
| `.app-btn` | `.bik-btn` base | ✅ Migrated | All 16 builders |
| `.app-btn--ghost` | `.bik-btn--ghost-dark .bik-btn--sm` | ✅ Migrated | History, Clear, Copy, Print, Email buttons |
| `.app-btn--ghost-dark` | `.bik-btn--ghost-dark .bik-btn--sm` | ✅ Migrated | Edit toggle buttons |
| `.app-btn--coral` | `.bik-btn--primary .bik-btn--sm` | ✅ Migrated | "Generate document" primary CTA |
| `.app-btn--ai` | Retained as modifier on `.bik-btn` | 🔒 Retained | AI Writer button — specific styling in `toolkit-app.css` (glow effect, ✦ icon color). Still used alongside bik-btn classes. |
| `.draft-btn` | — | 🔒 Retained | Draft restore/discard bar — functional component defined in `toolkit-app.css`. Not visual-only. |
| `.draft-btn--restore` | — | 🔒 Retained | Coral restore action button |
| `.draft-btn--discard` | — | 🔒 Retained | Ghost discard action button |

---

## Dashboard-specific Classes (dashboard.css)

| Legacy Class | Status | Notes |
|---|---|---|
| `.dash-btn` | ✅ Migrated | Removed from `dashboard.html` — replaced with `bik-btn` variants |
| `.dash-header` | ✅ Migrated | Replaced with `bik-app-header` + `bik-app-nav` |
| `.hf-btn` | 🔒 Retained | Health filter button — functional component in `dashboard.css`, not in scope for this sprint |
| `.halert-action` | 🔒 Retained | Alert action button in dashboard health alerts — functional, keep for now |
| `.pf-btn` | 🔒 Retained | Project filter button — functional component in `dashboard.css` |

---

## Marketing Site Classes (styles.css)

These classes are in `styles.css` and used exclusively on marketing/public pages. They are **out of scope** for this rollout — the marketing site has its own consistent visual system and is not being migrated to the app shell.

| Legacy Class | Status | Notes |
|---|---|---|
| `.site-nav` | 🚫 Excluded | Marketing nav — correct for public pages |
| `.logo-mark` (marketing) | 🚫 Excluded | Used in `site-nav` and `site-footer` — marketing context only |
| `.btn--coral` | 🚫 Excluded | Marketing CTAs — styles.css variant |
| `.btn--ghost` | 🚫 Excluded | Marketing ghost buttons |
| `.btn--cream` | 🚫 Excluded | CTA strip button |
| `.filter-pill` | 🚫 Excluded | Tool catalogue filter pills — unique to `ai-documents.html` marketing page |
| `.tool-card` (styles.css) | 🚫 Excluded | Marketing tool card variant — different from `dashboard.css` tool-card |

---

## `toolkit-app.css` Structural Classes (Retained)

These classes provide the split-panel builder layout. They are shared across all document builders and are intentionally preserved — migrating them would require a full rewrite of the builder shell, which is outside this sprint's scope.

| Class | Defined In | Status | Notes |
|---|---|---|---|
| `.app-shell` | `toolkit-app.css` | 🔒 Retained | Page wrapper for split panel |
| `.app-toolbar` | `toolkit-app.css` | 🔒 Retained | Sub-header toolbar strip |
| `.progress-wrap` | `toolkit-app.css` | 🔒 Retained | Progress bar container |
| `.progress-bar-track` | `toolkit-app.css` | 🔒 Retained | Progress bar |
| `.progress-bar-fill` | `toolkit-app.css` | 🔒 Retained | Progress fill |
| `.app-body` | `toolkit-app.css` | 🔒 Retained | Main content area |
| `.form-panel` | `toolkit-app.css` | 🔒 Retained | Left form column |
| `.preview-panel` | `toolkit-app.css` | 🔒 Retained | Right preview column |
| `.form-section` | `toolkit-app.css` | 🔒 Retained | Form section wrapper (used by FormEngine) |
| `.form-section-title` | `toolkit-app.css` | 🔒 Retained | Section heading (used by FormEngine) |
| `.preview-panel-header` | `toolkit-app.css` | 🔒 Retained | Preview panel header |
| `.tab-bar` | `toolkit-app.css` | 🔒 Retained | Mobile tab navigation |
| `.tab-btn` | `toolkit-app.css` | 🔒 Retained | Mobile tab button |

---

## Summary Counts

| Category | Migrated | Retained | Excluded |
|---|---|---|---|
| App header/shell | 10 | 0 | 0 |
| Button classes | 4 | 4 | 4 |
| Dashboard classes | 1 | 3 | 0 |
| Marketing classes | 0 | 0 | 7 |
| Builder structural | 0 | 14 | 0 |

---

## Recommended Follow-up (Post-Sprint)

1. **`.hf-btn` / `.halert-action` / `.pf-btn`** — Dashboard filter and alert buttons should be migrated to `bik-btn` variants in a future dashboard polish sprint.
2. **`.draft-btn`** — Could be migrated to `bik-btn--ghost` + `bik-btn--primary` in a future toolkit-app refactor sprint.
3. **`.filter-pill`** — The `ai-documents.html` marketing page filter pills could adopt `bik-status` or a new `.bik-filter-pill` component in a future marketing polish pass.
4. **`toolkit-app.css` structural classes** — Long-term, the split-panel builder shell should be rebuilt using design-system tokens. Low priority while the FormEngine API is stable.
