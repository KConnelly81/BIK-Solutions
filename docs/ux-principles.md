# UX Principles

**Purpose:** Define the design philosophy, UX standards, and component patterns for BIK Solutions.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Design Philosophy

**One call, done right** — our service philosophy is also our design philosophy.

Every page should:
1. Tell the visitor immediately what they can do here
2. Remove friction from the path to that action
3. Build trust at every scroll step
4. Work perfectly on a phone held by someone standing on a building site

---

## Core UX Principles

### 1. Mobile-first, always
More than 60% of trade visitors will be on mobile. Design for phone first, enhance for desktop. Never assume a mouse.

### 2. Clarity over cleverness
A builder at 6am checking a document on a dusty phone does not want clever. They want clear. Every interaction should be obvious without instruction.

### 3. Speed is a feature
Every kilobyte of JavaScript, every font, every animation adds load time. The target audience is often on variable 4G networks in construction zones. Keep it lean.

### 4. Respect the reader's time
Section content should be scannable. Headers, short paragraphs, bullet points. Never bury the action in the fourth paragraph.

### 5. Trust is earned, not assumed
The audience has been burned by cowboys and overpriced software. Every design element should reinforce professionalism, reliability, and honesty.

---

## Page Structure Patterns

### Service/Marketing Pages
```
Nav (sticky)
→ Page Hero (eyebrow + H1 + lead text)
→ Primary content sections (alternating cream/charcoal)
→ CTA strip (coral background)
→ Footer
```

### Toolkit/SaaS Pages
```
Nav (sticky, with Business Toolkit dropdown)
→ Page Hero (white background, large headline, badge)
→ Category filters (sticky on scroll)
→ Tool/content grid
→ Pricing or CTA block
→ Footer
```

---

## Navigation Standards

### Desktop Nav
- Sticky at top; background: `--charcoal`
- Logo left, links centre, CTA button right
- Active link: coral colour with optional underline
- Business Toolkit: dropdown on hover with sub-pages

### Mobile Nav (Hamburger Drawer)
- Full-screen overlay drawer
- All links plus CTA button
- Close on link click
- Body scroll locked when open

### Dropdown Accessibility Requirements
- `aria-expanded` on trigger button
- `aria-haspopup="true"` on trigger
- Keyboard: arrow keys navigate options; Escape closes
- Focus trapped within open dropdown
- Click outside closes

---

## Section Spacing

```css
.section { padding-block: 64px; }           /* Standard sections */
.page-hero { padding-block: 72px 56px; }    /* Page heroes */
.hero-block { padding-block: 72px 64px; }   /* Homepage hero block */
.cta-strip { padding-block: 56px; }         /* CTA strips */
```

Responsive (mobile): reduce by ~25%.

---

## Animation Standards

### Scroll-in Animations
- Class: `.animate-on-scroll` → `.is-visible` (added by IntersectionObserver)
- Effect: `fadeSlideUp` — opacity 0→1, translateY 24px→0
- Duration: 0.55s ease
- Threshold: 12% visible before triggering
- Stagger: `.delay-1` (0.1s), `.delay-2` (0.2s), `.delay-3` (0.3s)
- Respect `prefers-reduced-motion`: skip animation, show element immediately

### Hover Transitions
- Duration: 0.2s ease (global `--transition`)
- Cards: `translateY(-4px)` lift with shadow increase
- Links: colour transition only
- Buttons: background-color transition

### Stat Counters
- Count-up animation with cubic ease-out
- Duration: 900ms
- Triggers on 50% element visibility

---

## Form Design Standards

### Input Fields
```css
padding: 12px 16px;
border: 1.5px solid rgba(28,28,26,0.2);
border-radius: 6px;
transition: border-color 0.2s ease;
focus: border-color: var(--coral); outline: none;
```

### Buttons
- All CTAs use `.btn` base class
- Minimum touch target: 44px height
- Loading states: text changes to "Sending..." + disabled attribute
- Success states: text changes; form may hide
- Error states: text explains what to do ("please call us on...")

### Form Validation
- HTML5 `required` attributes for basic validation
- Custom error messages in plain English
- Never use red-only error indicators (accessibility: colour-blind users)

---

## Accessibility Requirements

- All images: descriptive `alt` text (or `alt=""` + `aria-hidden="true"` for decorative)
- All interactive elements: visible focus state
- Colour contrast: minimum 4.5:1 for body text, 3:1 for large text
- Nav and landmark roles: `role="navigation"`, `role="contentinfo"`, `aria-label` on all navs
- Skip-to-content link (add in Phase 2)
- Form labels always associated with inputs
- Error announcements: `aria-live` regions (Phase 2)

---

## Responsive Breakpoints

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 480px | Single column, largest text size |
| Tablet | 480px–900px | Some 2-column layouts |
| Desktop | > 900px | Full grid layouts |

---

## Related Documents

- [branding-guidelines.md](branding-guidelines.md) — Colours, typography, voice
- [coding-standards.md](coding-standards.md) — CSS and JS conventions
- [technical-architecture.md](technical-architecture.md) — Stack decisions
