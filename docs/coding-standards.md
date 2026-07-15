# Coding Standards

**Purpose:** Define code style, conventions, and review checklist for BIK Solutions.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## General Principles

1. **Readability over cleverness.** Code is read more than it's written.
2. **No premature abstraction.** Three similar blocks is fine; a fourth warrants a component.
3. **No dead code.** Remove unused classes, variables, and commented-out blocks before committing.
4. **Test before pushing.** No broken links, no console errors, no visual regressions.

---

## HTML Standards

### Document Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="[unique description per page]" />
  <title>[Page Name] - BIK Solutions</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
```

### Naming Conventions
- IDs: `kebab-case` (e.g., `hero-heading`, `contact-form`)
- Classes: `kebab-case` (e.g., `service-tile`, `btn--coral`)
- BEM-inspired: Block (`card`), Element (`card-title`), Modifier (`card--featured`)

### Semantic Requirements
- One `<h1>` per page
- Heading hierarchy: never skip levels (h1 → h2 → h3)
- All nav elements: `<nav>` with `aria-label`
- Footer: `<footer role="contentinfo">`
- Sections: `aria-labelledby` pointing to heading ID

### Accessibility Checklist
- [ ] All images have `alt` attributes
- [ ] Decorative images: `alt=""` and `aria-hidden="true"`
- [ ] Interactive elements have visible focus states
- [ ] Form inputs have associated `<label>` elements
- [ ] Buttons have descriptive text (no "Click here")
- [ ] Nav has `aria-label` attribute
- [ ] Colour contrast meets 4.5:1 minimum

---

## CSS Standards

### File Organisation (in styles.css)
```
/* ===== VARIABLES ===== */
/* ===== RESET ===== */
/* ===== TYPOGRAPHY ===== */
/* ===== LAYOUT UTILITIES ===== */
/* ===== NAV ===== */
/* ===== HERO ===== */
/* ===== SECTIONS ===== */
/* ===== COMPONENTS: [name] ===== */
/* ===== FOOTER ===== */
/* ===== RESPONSIVE ===== */
```

### CSS Rules
- Use CSS custom properties for all colours, radii, and transitions
- Mobile-first: base styles are mobile, enhance with min-width media queries
- Use `gap` for spacing between flex/grid children (not margins)
- Wide content gets `overflow-x: auto` on its own container
- Never use `!important` unless overriding a third-party style
- Use `clamp()` for responsive typography (no separate media query per font size)

### Specificity Management
- Avoid ID selectors for styling (use classes)
- Keep specificity flat — prefer `.component-name` over `section .component-name`
- Component styles must not accidentally inherit from generic element selectors

### Custom Property Naming
```css
--charcoal, --coral, --cream, --stone, --dark-stone  /* Brand colours */
--font-stack                                           /* Typography */
--radius                                               /* Border radius */
--transition                                           /* Hover transitions */
```

---

## JavaScript Standards

### File Organisation (in main.js)
Each feature is wrapped in an IIFE with a comment header:
```js
/* --- Feature name --- */
(function () {
  // Guard against missing elements
  const el = document.querySelector('.element');
  if (!el) return;

  // Feature code
})();
```

### Rules
- No global variables
- Guard against missing DOM elements before attaching events
- Use `const` and `let` (not `var`) in new code
- Use `addEventListener` (never inline `onclick`)
- Respect `prefers-reduced-motion` for any animation added in JS

### Adding New Features
1. Add a new IIFE at the end of main.js
2. Guard with an element existence check
3. Comment what the feature does (only if non-obvious)

---

## Git Conventions

### Branch Naming
- Feature branches: `feature/short-description`
- Fix branches: `fix/short-description`
- Current working branch: `claude/bik-solutions-website-yevsuk`

### Commit Messages
```
Short imperative summary (< 72 chars)

Optional longer description if needed.
Explain the why, not the what.
```

Examples:
- `Add Business Toolkit nav dropdown to all pages`
- `Fix mobile nav z-index clash with hero`
- `Create toolkit.html with phase 1 tool cards`

### Before Pushing
- [ ] No console errors on any page
- [ ] Nav works on mobile (drawer open/close)
- [ ] All links resolve (no 404s)
- [ ] Forms have correct action URL
- [ ] Lighthouse score not significantly degraded

---

## File Naming

| Type | Convention | Example |
|---|---|---|
| HTML pages | `kebab-case.html` | `ai-documents.html` |
| CSS files | `kebab-case.css` | `styles.css` |
| JS files | `kebab-case.js` | `main.js` |
| Image assets | `kebab-case.ext` | `site-protection-hero.jpg` |
| PDF downloads | `BIK-Solutions-Description.pdf` | `BIK-Solutions-SWMS-Template.pdf` |
| Documentation | `kebab-case.md` | `technical-architecture.md` |

---

## New Page Checklist

When creating a new HTML page:
- [ ] Copy nav and footer from existing page (exact copy — same structure)
- [ ] Set correct `class="active"` on the nav link for this page
- [ ] Set unique `<title>` and `<meta name="description">`
- [ ] Set unique heading IDs and `aria-labelledby` on all sections
- [ ] Add `<script src="js/main.js"></script>` before `</body>`
- [ ] Test mobile nav opens and closes correctly
- [ ] Test all links on the page are correct

---

## Related Documents

- [technical-architecture.md](technical-architecture.md) — Stack and infrastructure
- [ux-principles.md](ux-principles.md) — Design and UX standards
- [branding-guidelines.md](branding-guidelines.md) — Typography and colour usage
