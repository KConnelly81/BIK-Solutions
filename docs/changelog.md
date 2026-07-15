# Changelog

**Purpose:** Version history and record of significant changes to the BIK Solutions platform.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Format

```
## [Version] — YYYY-MM-DD
### Added / Changed / Fixed / Removed
- Description
```

---

## [Unreleased] — In Progress

### Added
- /docs folder with 14 documentation files covering product, business, design, and technical standards
- Product strategy document (62 tools, 4-phase roadmap) — HTML Artifact
- Business Toolkit nav dropdown (in progress)
- 6 new toolkit pages (in progress): toolkit.html, ai-documents.html, templates.html, construction-resources.html, productivity.html, coming-soon.html
- SaaS component CSS (in progress)

---

## [0.4.0] — 2026-07 (Approximate)

### Added
- Unified hero block: merged hero, "Where we fit in" stories, and "Who we work with" into one `<section class="hero-block">` with Charcoal background and coral accent dividers
- Scroll-in animations: `.animate-on-scroll` with `fadeSlideUp` keyframe, `.delay-1/2/3` staggering, IntersectionObserver trigger
- Stat counter animations: count-up effect on `data-count-to` elements, cubic ease-out, 900ms duration
- Card hover depth: `translateY(-4px)` lift with shadow on service tiles, story cards, audience cards
- Background texture: subtle SVG noise overlay on `.bg-charcoal` sections (opacity 0.04)
- `.audience-grid--dark` and `.audience-card--dark` CSS components

### Changed
- Hero background: warmed from cold `#1C1C1A` to `#252320` (CSS var `--charcoal`)
- Hero: added diagonal gradient `linear-gradient(160deg, #2e2b27 0%, var(--charcoal) 60%)`
- Hero h1: set to `color: #fff` (pure white, previously inherited cream)
- Section padding: reduced from 96px to 64px across all sections
- Card and section padding reduced ~20-30% site-wide to reduce scrolling

### Fixed
- Em-dashes removed site-wide across all 7 HTML files; replaced with ` - `
- DNS: Deleted GoDaddy "Parked" A record that was overriding GitHub Pages
- GitHub Pages: Re-enabled after repository was accidentally set to private; branch re-selected

---

## [0.3.0] — 2026-07 (Earlier)

### Added
- Hero section redesign: new eyebrow, refined h1 copy, hero-sub paragraph
- "Where we fit in" stories grid with 3 story cards
- "Who we work with" audience cards (Property Managers, Builders, Homeowners)
- Stats grid section: GC-BNE, 1× (one call), 0× (zero collateral damage)

---

## [0.2.0] — 2026-06 (Approximate)

### Added
- Formspree AJAX contact form integration
- Free download gate with Formspree + PDF trigger
- Gumroad product integrations on shop.html and resources.html
- Cart placeholder buttons
- builders.html (Builders / Deconstruction specialist page)
- Mobile hamburger nav with drawer

---

## [0.1.0] — 2026-05 (Approximate)

### Added
- Initial static website launch
- index.html, services.html, about.html, contact.html
- css/styles.css with BIK brand tokens
- js/main.js with nav toggle and active link detection
- GitHub Pages deployment on custom domain biksolutions.com.au
- GoDaddy DNS configuration

---

## Related Documents

- [release-plan.md](release-plan.md) — Upcoming releases and deployment process
- [feature-backlog.md](feature-backlog.md) — Current sprint tasks
