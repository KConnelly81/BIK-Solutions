# BIK Design System
**File:** `css/bik-design-system.css`  
**Status:** v1.1 — reconciled onto claude/session-recovery-f8syoy

---

## Overview

A lightweight, token-based design system for the BIK Business Toolkit. Built without a heavy framework — pure CSS variables and class conventions compatible with the existing HTML/CSS/JS architecture.

Load `bik-design-system.css` before `styles.css` and all page-specific CSS.

---

## Colour System

### Brand
| Token | Value | Use |
|---|---|---|
| `--bik-navy` | `#1E2333` | Navigation, headers, structure |
| `--bik-navy-dark` | `#14182A` | Hover states on navy |
| `--bik-navy-mid` | `#2B3147` | Secondary nav areas |
| `--bik-orange` | `#D85A30` | Primary CTA, accents, brand moments |
| `--bik-orange-dark` | `#BF4E27` | Orange hover state |
| `--bik-orange-light` | `rgba(216,90,48,0.10)` | Orange tint backgrounds |

### Semantic
| Token | Value | Use |
|---|---|---|
| `--bik-success` | `#1E7A30` | Healthy, approved, on-site |
| `--bik-success-bg` | `#E8F5EB` | Success background tint |
| `--bik-warning` | `#A85A00` | Attention, awaiting, upcoming |
| `--bik-warning-bg` | `#FEF3E8` | Warning background tint |
| `--bik-danger` | `#B91C1C` | Overdue, rejected, destructive |
| `--bik-danger-bg` | `#FEE2E2` | Danger background tint |
| `--bik-info` | `#1D4ED8` | Informational, sent |
| `--bik-info-bg` | `#DBEAFE` | Info background tint |

### Surfaces
| Token | Value | Use |
|---|---|---|
| `--bik-background` | `#F2F0EC` | Page background |
| `--bik-surface` | `#FFFFFF` | Cards, panels |
| `--bik-surface-raised` | `#FAFAF8` | Elevated surface (header on card) |
| `--bik-surface-sunken` | `#EEECE8` | Inset areas, hover backgrounds |

### Borders
| Token | Value | Use |
|---|---|---|
| `--bik-border` | `rgba(28,28,26,0.10)` | Default card/divider borders |
| `--bik-border-strong` | `rgba(28,28,26,0.20)` | Form controls |
| `--bik-border-focus` | `var(--bik-orange)` | Focus states |

### Text
| Token | Value | Use |
|---|---|---|
| `--bik-text` | `#1A1A18` | Primary body text |
| `--bik-text-secondary` | `#555551` | Secondary body, labels |
| `--bik-text-muted` | `#888782` | Metadata, hints |
| `--bik-text-placeholder` | `#AEACA7` | Input placeholders |
| `--bik-text-on-dark` | `#FFFFFF` | Text on navy/dark backgrounds |
| `--bik-text-on-dark-muted` | `rgba(255,255,255,0.55)` | Subdued text on dark |

---

## Typography

### Font
**Inter** (400, 500, 600, 700) loaded via Google Fonts. System stack fallback:  
`'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Scale
| Token | px | Use |
|---|---|---|
| `--bik-text-2xs` | 11px | Badges, very small labels |
| `--bik-text-xs` | 12px | Metadata, hints, status labels |
| `--bik-text-sm` | 13px | Secondary body, list items |
| `--bik-text-md` | 14px | Primary body (default) |
| `--bik-text-base` | 16px | Card titles, nav |
| `--bik-text-lg` | 18px | Sub-headings |
| `--bik-text-xl` | 20px | Section titles |
| `--bik-text-2xl` | 24px | Page section titles |
| `--bik-text-3xl` | 30px | Page titles |
| `--bik-text-4xl` | 36px | Hero headings |

### Utility classes
| Class | Description |
|---|---|
| `.bik-page-title` | 30px bold, tight leading |
| `.bik-section-title` | 20px semibold |
| `.bik-card-title` | 16px semibold |
| `.bik-body` | 14px body |
| `.bik-body-sm` | 13px secondary |
| `.bik-meta` | 12px muted |
| `.bik-label` | 12px uppercase semibold |
| `.bik-eyebrow` | 11px orange uppercase |

---

## Spacing Scale

| Token | Value |
|---|---|
| `--bik-space-1` | 4px |
| `--bik-space-2` | 8px |
| `--bik-space-3` | 12px |
| `--bik-space-4` | 16px |
| `--bik-space-5` | 20px |
| `--bik-space-6` | 24px |
| `--bik-space-8` | 32px |
| `--bik-space-10` | 40px |
| `--bik-space-12` | 48px |
| `--bik-space-16` | 64px |

---

## Buttons

Always prefer orange for the single most important action on a screen. Never put two orange buttons side by side.

```html
<!-- Primary (orange) — most important CTA -->
<button class="bik-btn bik-btn--primary">Save Draft</button>

<!-- Secondary (navy) — strong but not the hero action -->
<button class="bik-btn bik-btn--secondary">View Project</button>

<!-- Ghost — tertiary, on light background -->
<button class="bik-btn bik-btn--ghost">Cancel</button>

<!-- Ghost dark — on navy/dark background -->
<button class="bik-btn bik-btn--ghost-dark">New Project</button>

<!-- Tertiary — text-only link style -->
<button class="bik-btn bik-btn--tertiary">View all →</button>

<!-- Danger — destructive action only -->
<button class="bik-btn bik-btn--danger">Delete</button>

<!-- Sizes -->
<button class="bik-btn bik-btn--primary bik-btn--sm">Small</button>
<button class="bik-btn bik-btn--primary bik-btn--lg">Large</button>

<!-- Icon only -->
<button class="bik-btn bik-btn--ghost bik-btn--icon" aria-label="Close">✕</button>
```

---

## Cards

```html
<!-- Base card -->
<div class="bik-card">
  <div class="bik-card-body">Content</div>
</div>

<!-- Clickable card -->
<a href="..." class="bik-card">
  <div class="bik-card-body">Content</div>
</a>

<!-- Card with header + footer -->
<div class="bik-card">
  <div class="bik-card-header">Header</div>
  <div class="bik-card-body">Body</div>
  <div class="bik-card-footer">Footer</div>
</div>

<!-- Status accent borders -->
<div class="bik-card bik-card--success">Healthy</div>
<div class="bik-card bik-card--warning">Needs attention</div>
<div class="bik-card bik-card--danger">Overdue</div>
```

---

## Status Pills

Used for document status, project health, attendance, approvals — everywhere.

```html
<span class="bik-status bik-status--active">Active</span>
<span class="bik-status bik-status--draft">Draft</span>
<span class="bik-status bik-status--sent">Sent</span>
<span class="bik-status bik-status--awaiting">Awaiting Approval</span>
<span class="bik-status bik-status--approved">Approved</span>
<span class="bik-status bik-status--overdue">Overdue</span>
<span class="bik-status bik-status--attention">Attention Required</span>
<span class="bik-status bik-status--completed">Completed</span>
<span class="bik-status bik-status--on-hold">On Hold</span>
<span class="bik-status bik-status--rejected">Rejected</span>

<!-- No dot -->
<span class="bik-status bik-status--active bik-status--no-dot">Active</span>
```

---

## Form Controls

```html
<div class="bik-form-field">
  <label class="bik-label-text" for="name">
    Project Name <span class="required">*</span>
  </label>
  <input class="bik-input" type="text" id="name" required>
  <span class="bik-field-hint">Use the full site address if possible.</span>
  <span class="bik-field-error" id="name-error">Please enter a project name.</span>
</div>

<div class="bik-form-field">
  <label class="bik-label-text" for="type">Worker Type</label>
  <select class="bik-select" id="type">
    <option value="">Select type</option>
    <option>Subcontractor</option>
  </select>
</div>

<div class="bik-form-field">
  <label class="bik-label-text" for="notes">Notes</label>
  <textarea class="bik-textarea" id="notes" rows="4"></textarea>
</div>
```

---

## Modal

```html
<div class="bik-modal-overlay" id="my-modal" hidden role="dialog" aria-modal="true">
  <div class="bik-modal">
    <div class="bik-modal-header">
      <h2 class="bik-modal-title">Title</h2>
      <button class="bik-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="bik-modal-body">Content</div>
    <div class="bik-modal-footer">
      <button class="bik-btn bik-btn--ghost">Cancel</button>
      <button class="bik-btn bik-btn--primary">Save</button>
    </div>
  </div>
</div>
```

---

## Toast Notifications

```html
<!-- Place once in body -->
<div class="bik-toast-region" aria-live="polite" aria-atomic="true">
  <div class="bik-toast" id="bik-toast" role="status">Message</div>
</div>

<script>
function showToast(msg, type = '') {
  const t = document.getElementById('bik-toast');
  t.textContent = msg;
  t.className = 'bik-toast' + (type ? ' bik-toast--' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
// Usage:
showToast('Saved successfully', 'success');
showToast('Check-in recorded');
showToast('Failed to save', 'danger');
</script>
```

---

## App Header (shared shell)

```html
<header class="bik-app-header">
  <a href="dashboard.html" class="bik-app-header-logo">
    <div class="bik-logo-mark">B</div>
    <div class="bik-logo-text">
      <span class="bik-logo-name">BIK Business Toolkit</span>
      <span class="bik-logo-tag">Beyond Industry Knowledge</span>
    </div>
  </a>
  <nav class="bik-app-nav">
    <a href="dashboard.html" class="bik-app-nav-link">Dashboard</a>
    <a href="project.html" class="bik-app-nav-link">Projects</a>
    <a href="attendance.html" class="bik-app-nav-link active">Site</a>
    <a href="toolkit.html" class="bik-app-nav-link">Tools</a>
  </nav>
  <div class="bik-app-header-spacer"></div>
  <div class="bik-app-header-actions">
    <button class="bik-btn bik-btn--primary bik-btn--sm">+ New</button>
    <button class="bik-btn bik-btn--ghost-dark bik-btn--icon" aria-label="Profile">⚙</button>
  </div>
</header>
```

---

## Metric Strip

```html
<div class="bik-metric-strip">
  <div class="bik-metric">
    <span class="bik-metric-value">7</span>
    <span class="bik-metric-label">On Site Now</span>
  </div>
  <div class="bik-metric bik-metric--success">
    <span class="bik-metric-value">$284k</span>
    <span class="bik-metric-label">Contract Value</span>
  </div>
  <div class="bik-metric bik-metric--warning">
    <span class="bik-metric-value">2</span>
    <span class="bik-metric-label">Awaiting Approval</span>
  </div>
</div>
```

---

## Tabs

```html
<nav class="bik-tabs" role="tablist">
  <button class="bik-tab active" role="tab" aria-selected="true">
    Today <span class="bik-tab-count">7</span>
  </button>
  <button class="bik-tab" role="tab" aria-selected="false">Register</button>
  <button class="bik-tab" role="tab" aria-selected="false">Reports</button>
</nav>
```

---

## Principles

1. **Orange is an accent, not the base.** Use navy/charcoal for structure; orange only for the primary CTA or key brand moments.
2. **One primary button per screen.** Don't put two orange buttons side by side.
3. **Clickable cards lift; non-clickable cards don't.** The hover transform signals interactivity.
4. **Colour never carries meaning alone.** Every status uses a dot + text label, not just colour.
5. **Minimum 40px touch targets.** All interactive controls meet this threshold.
6. **`--bik-border` is the single border token.** Never hardcode `rgba(28,28,26,0.10)` directly.
7. **Spacing from the scale only.** No arbitrary pixel values.
8. **Use `bik-status` pills for all statuses.** Don't invent new status badge patterns in individual pages.
