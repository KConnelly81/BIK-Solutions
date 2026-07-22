# BIK Solutions — UI/UX Audit
**Branch:** ui-redesign-sprint  
**Date:** 2026-07-21  
**Scope:** Full platform audit before redesign

---

## 1. Pages Inventory

### Marketing / Public
| Page | File | Notes |
|---|---|---|
| Homepage | `index.html` | Full marketing site, site-nav |
| Landing (A/B?) | `landing.html` | — |
| About | `about.html` | — |
| Contact | `contact.html` | — |
| Services | `services.html` | — |
| Builders | `builders.html` | — |
| Resources | `resources.html` | Download hub |
| Shop | `shop.html` | — |
| Templates | `templates.html` | — |
| FAQ | `faq.html` | — |
| Productivity | `productivity.html` | — |
| Quick Start | `quick-start.html` | — |
| Trial Guide | `trial-guide.html` | — |
| Roadmap | `roadmap.html` | — |
| Release Notes | `release-notes.html` | — |
| Founding Builder | `founding-builder.html` | — |
| Support | `support.html` | — |
| Privacy Policy | `privacy-policy.html` | — |
| Terms of Use | `terms-of-use.html` | — |
| AI Usage Notice | `ai-usage-notice.html` | — |
| Coming Soon | `coming-soon.html` | — |
| Welcome Email | `welcome-email.html` | — |

### App Core
| Page | File | Notes |
|---|---|---|
| Dashboard | `dashboard.html` | Main builder hub |
| AI Documents | `ai-documents.html` | Document history hub |
| Toolkit | `toolkit.html` | Tool catalogue |
| Project Detail | `project.html` | Per-project workspace |

### Site / Attendance
| Page | File | Notes |
|---|---|---|
| Attendance Dashboard | `attendance.html` | Builder-facing, dark header |
| Worker Check-In | `checkin.html` | Mobile-first dark theme, QR entry |
| Worker Check-Out | `checkout.html` | Multi-step flow |

### Document Builders (all use toolkit-app shell)
`variation-generator.html`, `quote-builder.html`, `scope-of-works.html`, `site-diary.html`, `defect-report.html`, `progress-claim.html`, `payment-reminder.html`, `practical-completion.html`, `handover-checklist.html`, `toolbox-talk.html`, `non-conformance-report.html`, `incident-report.html`, `inspection-checklist.html`, `eot-claim.html`, `delay-notice.html`, `instruction-to-proceed.html`, `subcontractor-agreement.html`, `notice-to-show-cause.html`, `contract-termination.html`, `swms.html`

---

## 2. CSS Files

| File | Size (approx) | Role |
|---|---|---|
| `css/styles.css` | ~2,600 lines | Marketing site: nav, hero, cards, forms, footer, toolkit page components |
| `css/dashboard.css` | ~1,300 lines | App dashboard: header, tool cards, project cards, modals, health cards |
| `css/project.css` | ~530 lines | Project detail page |
| `css/toolkit-app.css` | ~1,700 lines | Document builder shell: split-panel, forms, preview, AI controls, print |

No shared component CSS exists. Each page area manages its own components independently.

---

## 3. Current Design Tokens (styles.css `:root`)

```css
--charcoal:   #252320
--coral:      #D85A30
--cream:      #F5F0E8
--stone:      #888780
--dark-stone: #3A3835
--font-stack: system stack (no Inter/Manrope loaded)
--nav-height: 72px
--max-width:  1200px
--radius:     4px
--transition: 0.2s ease
```

**Missing tokens:**
- No `--success`, `--warning`, `--danger` semantic colours
- No `--background`, `--surface`, `--border` tokens (though `var(--border)` is *referenced* in `dashboard.css` and `toolkit-app.css` without being defined — this is a silent bug)
- No spacing scale
- No typography scale

---

## 4. Navigation Patterns

### Marketing site
Sticky charcoal navbar (`.site-nav`), hamburger on mobile, nav links: Toolkit, Builders, Resources, etc. Clean and consistent across all marketing pages.

### App pages (dashboard, project, attendance)
Each has its **own custom header** — not shared. No consistent navigation between app tools. Specifically:
- `dashboard.html`: charcoal header, "New Project" + "Profile" ghost buttons only
- `project.html`: charcoal header, back-arrow + logo + "New Doc" button
- `attendance.html`: dark header, project select + date + action buttons
- `checkin.html` / `checkout.html`: standalone pages with no app navigation at all

**Gap:** No breadcrumb or persistent nav lets users move between tools. After navigating to `attendance.html` or a document builder, the only way back is the browser's back button or the logo link.

---

## 5. Repeated UI Components

### Components with multiple independent implementations

| Component | Locations | Problem |
|---|---|---|
| Button | `.btn` (styles.css), `.dash-btn` (dashboard.css), `.app-btn` (toolkit-app.css), `.psa-btn` (project.css), `.draft-btn` (toolkit-app.css), `.halert-action` (dashboard.css) | 6+ independent button definitions; not interchangeable |
| Modal | `.modal-overlay/.modal-box` (dashboard.css), `.ai-key-modal` (toolkit-app.css), inline `<style>` modals in attendance.html | 3 independent modal implementations |
| Form inputs | `.form-group input` (styles.css), `.form-input/.form-field` (toolkit-app.css), `.pf-input` (dashboard.css), `.profile-input` (dashboard.css) | 4 independent input styles |
| Card | `.audience-card`, `.tool-card` (styles.css), `.tool-card` (dashboard.css — conflicts), `.roadmap-card`, `.health-card`, `.project-card`, `.proj-doc-group` | Multiple card types with no shared base |
| Status badge | `.rdi-approval--*`, `.hcard-health-badge--*`, `.project-status-inline`, `.pcard-dot` | 4 separate status pill systems |
| Toast | `.toast` in toolkit-app.css | Only exists in toolkit; other pages use `alert()` or no feedback |

---

## 6. Inconsistencies Found

### Buttons
- 6 separate button systems (see above)
- `styles.css` buttons use `padding: 12px 28px`, `border-radius: 4px`, `border: 2px solid`
- Dashboard buttons use `padding: 7px 14px`, `border-radius: 6px`, `border: 1px solid`
- Toolkit buttons use `min-height: 34px`, `border-radius: 5px`, `border: 1.5px solid`
- No consistent primary/secondary/destructive hierarchy across the app

### Cards
- Border radius: `4px` (styles.css base), `8px` (styles.css tool cards), `10px` (dashboard cards), `12px` (health/modal)
- Borders: `2px solid coral` (audience cards), `1.5px solid rgba(28,28,26,0.1)` (toolkit tool cards), `1px solid rgba(0,0,0,0.08)` (dashboard tool cards)
- Shadow: inconsistent — some cards use `box-shadow`, some don't, `transform: translateY(-2px)` on hover in some but not others

### Headings
- No consistent type scale
- Section headings in dashboard: `0.78rem`, uppercase, `letter-spacing: 0.08em`, colour `#999`
- Section headings in project: `0.72rem`, uppercase, `letter-spacing: 0.06em`, colour `#999`
- Section title on toolkit page: `clamp(1.75rem, 3vw, 2.5rem)`, weight 500
- Document builder section headings: `0.68rem`, coral, uppercase

### Spacing
Arbitrary values across files: `4px`, `5px`, `6px`, `7px`, `8px`, `10px`, `12px`, `13px`, `14px`, `16px`, `18px`, `20px`, `22px`, `24px`, `28px`, `32px`, `36px`, `40px`, `44px`, `48px`, `56px`, `64px`

No defined spacing scale. Same intent (gap between label and input) uses `4px` in some places, `6px` in others, `10px` in others.

### Forms
- Label size: `0.78rem` (toolkit), `0.8rem` (styles.css), `0.76rem` (dashboard), `0.72rem` (project)
- Input height: `42px` min-height (toolkit), `38px` implied (dashboard), no explicit height in styles.css forms
- Focus: coral border everywhere but shadow only in toolkit (`box-shadow: 0 0 0 3px rgba(216,90,48,0.1)`)
- Required indicators: `*` in coral (toolkit only); no pattern elsewhere

### Colours hardcoded (not using variables)
The following appear as literals in CSS rather than tokens:
- `#c0392b` (danger red) — used in 6+ places
- `#2b9e3f` (success green) — used in 4+ places
- `#e67e22` (warning orange) — used in 2 places
- `#D85A30`, `#d85a30` — coral appears both ways in same codebase
- `#1a1a1a`, `#333`, `#555`, `#666`, `#888`, `#999`, `#aaa`, `#bbb`, `#ccc` — grey scale without tokens
- `#f0ede8`, `#faf8f5`, `#eeece9` — near-cream backgrounds, all slightly different

### Status indicators
No unified status system. Current ad-hoc statuses include:
- Health cards: `healthy`, `attention`, `critical`
- Documents: `draft`, `sent`, `approved`, `rejected`, `archived`  
- Projects: custom dot colours per project
- Attendance: active, checked-out, forgotten checkout

---

## 7. Mobile Usability Issues

| Issue | Where | Impact |
|---|---|---|
| Breakpoints inconsistent | styles.css at 768px, dashboard.css at 700px, toolkit-app.css at 900px | Layout shifts at different widths per tool |
| No mobile app navigation | All app pages | Builder must use browser back/forward; easy to get "lost" |
| Dashboard tool grid collapses to 1-col at 700px | dashboard.css | OK, but 280px minmax means 2 cols can appear at awkward widths |
| Toolkit split-panel stacks on mobile | toolkit-app.css | Reasonable but tab-bar switch UX is not prominent |
| `checkin.html` designed mobile-first | checkin.html | ✅ This is good |
| `attendance.html` has tables | attendance.html | Likely cramped on small phones |
| Min touch targets | Various | Toolkit buttons: `min-height: 34px` ✅. Dashboard `.hf-btn` padding `5px 12px` — may be <44px |
| Marketing nav drawer full-screen | styles.css | ✅ Reasonable |
| Hero buttons on mobile forced `width: 100%` | styles.css @480px | May feel heavy |

---

## 8. Visually Disconnected Pages

| Page | Issue |
|---|---|
| `checkin.html` | Dark purple/charcoal theme is dramatically different from cream dashboard aesthetic — intentionally mobile-optimised but feels like a different product |
| `checkout.html` | Dark theme, very different from dashboard. Also different from `checkin.html` in some respects |
| `attendance.html` | Dark header + light body — hybrid feel |
| Document builders | Split-panel chrome (app-header + toolbar) is consistent within builders, but disconnected from the dashboard aesthetic |
| Marketing pages | Use `site-nav` + full `styles.css`; completely separate from app pages (by design for public-facing, but navigation between marketing and app feels jarring) |

---

## 9. Duplicated CSS That Could Be Consolidated

| Pattern | Duplicated in | Safe to consolidate? |
|---|---|---|
| `.logo-mark` (charcoal bg + B letter) | styles.css + dashboard.css + toolkit-app.css | Yes — extract to shared component |
| Button base pattern | 6 locations | Yes — shared base, then variants |
| Form input pattern | 4 locations | Yes — shared `.bik-input`, `.bik-label` |
| Toast notification | toolkit-app.css only | Yes — extract to shared component for all pages |
| Modal overlay | 3 locations | Yes — shared `.bik-modal-overlay/.bik-modal` |
| Status badges | 4 systems | Yes — shared `.bik-status-pill` + modifiers |
| Card base | Many | Yes — shared base class with surface/border/radius |

---

## 10. `--border` Variable Bug

`var(--border)` is referenced in `dashboard.css` and `toolkit-app.css` but never defined in any `:root` block. Modern browsers fall back to an empty string (no border). This means some inputs, tables and panels may silently lose their borders in some rendering contexts. Must be fixed in the design system.

---

## Summary: Priority Issues

1. **Three separate button systems** — must be unified
2. **No semantic colour tokens** (success/warning/danger/border) — colours hardcoded everywhere
3. **No Inter/Manrope** — system font used, typography feels undifferentiated
4. **No app navigation** — users have no consistent way to move between app areas
5. **Six different font-size values below 0.85rem** — no readable type scale
6. **Status system is 4 incompatible patterns** — must be unified
7. **`var(--border)` referenced but never defined** — silent visual bug
8. **Spacing is entirely arbitrary** — no scale, values 4px–64px with no system
9. **Checkin/checkout feel like a different product** from the dashboard
10. **Cards have 4 different border-radius values and no shared base**
