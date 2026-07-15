# Branding Guidelines

**Purpose:** Define the visual identity, tone, and brand standards for BIK Solutions.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Brand Identity

**Company Name:** BIK Solutions Pty Ltd
**Trading Name:** BIK Solutions
**Tagline:** Beyond Industry Knowledge
**Website:** biksolutions.com.au

---

## Logo

### Mark
The BIK logo mark is a square with rounded corners in Charcoal (#252320), containing a large white "B".

### Logotype
"IK SOLUTIONS" in spaced uppercase, paired with "Beyond Industry Knowledge" as a smaller tagline below.

### Variations
| Context | Usage |
|---|---|
| Light background | Full mark + logotype in Charcoal |
| Dark background | Full mark + logotype in Cream |
| Footer | "IK SOLUTIONS PTY LTD" (full legal name) |
| Nav | "IK SOLUTIONS" (abbreviated) |

### HTML Implementation
```html
<a href="index.html" class="logo">
  <div class="logo-mark"><span>B</span></div>
  <div class="logo-text">
    <span class="logo-name">IK SOLUTIONS</span>
    <span class="logo-tagline">Beyond Industry Knowledge</span>
  </div>
</a>
```

---

## Colour Palette

| Name | Hex | Usage |
|---|---|---|
| Charcoal | `#252320` | Primary dark; nav, hero background, dark sections |
| Coral | `#D85A30` | Accent; CTAs, highlights, badges, hover states |
| Cream | `#F5F0E8` | Light section backgrounds |
| Stone | `#888780` | Secondary text, subheadings, captions |
| Dark Stone | `#3A3835` | Cards on dark backgrounds, subtle borders |
| White | `#FFFFFF` | Hero headlines (on dark), form backgrounds |

### Usage Rules
- Never use coral as a background for large areas (too intense)
- Coral on white: only for small text (bold weight) or buttons — not body text
- Charcoal and Cream are the two primary backgrounds; alternate between them for section rhythm
- Stone is for secondary information only; never use for primary headings or key actions

---

## Typography

### Font Stack
```css
--font-stack: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Type Scale
| Element | Size | Weight | Notes |
|---|---|---|---|
| H1 (hero) | clamp(2.8rem, 6vw, 5.5rem) | 500 | White on dark |
| H1 (pages) | clamp(2rem, 4vw, 3.5rem) | 500 | Charcoal |
| H2 (section) | clamp(1.6rem, 3vw, 2.4rem) | 500 | |
| H3 (card) | 1.05–1.15rem | 500 | |
| Body | 1rem | 400 | Line height 1.7 |
| Caption / eyebrow | 0.75–0.8rem | 500 | Uppercase, letter-spaced |
| Button | 0.875–0.95rem | 500 | |

### Eyebrow Labels
Small uppercase labels above section headings. Format:
```html
<span class="eyebrow text-coral">Category label</span>
```
Always paired with a section heading. Never used alone.

---

## Voice and Tone

### Brand Voice
**Direct.** We say what we mean. No jargon, no buzzwords, no corporate speak.
**Confident.** We know our craft. We don't hedge.
**Practical.** Every sentence should answer "so what?" for the reader.
**Human.** We're tradespeople who built a business. We speak like it.

### What We Say
- "Done right, the first time." (not "Our quality assurance processes ensure...")
- "One call." (not "A streamlined single point of contact solution...")
- "We protect what should stay." (not "Non-destructive methodology applied...")

### What We Don't Say
- No em-dashes. Use " - " instead.
- No exclamation marks in body copy (buttons and CTAs only, rarely).
- No "solutions" as a generic filler word (ironic given our name — use it purposefully).
- No "leverage", "synergy", "ecosystem", "seamless".
- Australian spelling throughout: "organise", "colour", "specialise", "licence" (noun), "license" (verb).

### Australian Spelling Reference
| Wrong (US) | Correct (AU) |
|---|---|
| organize | organise |
| color | colour |
| behavior | behaviour |
| labor | labour (except Fair Work "labour") |
| center | centre |
| program | programme (project context); program (software) |
| license (noun) | licence |
| canceled | cancelled |

---

## UI Component Standards

### Buttons
| Variant | Class | Usage |
|---|---|---|
| Primary (coral) | `.btn.btn--coral` | Primary CTAs |
| Ghost (outline) | `.btn.btn--ghost` | Secondary actions on dark backgrounds |
| Cream | `.btn.btn--cream` | CTAs on dark section strips |
| Cart | `.btn.btn--cart` | Gumroad purchase buttons |

### Section Backgrounds
Alternate between `.bg-charcoal` and `.bg-cream` for visual rhythm. White (`#fff`) used for toolkit/SaaS pages.

### Cards
Cards use `border-radius: 6px` throughout. Hover state: `translateY(-4px)` with appropriate shadow.

---

## Imagery Guidelines

Phase 1 uses no photography (all illustrations and CSS graphics). When real photography is introduced:
- Subject: actual BIK work on site (not stock)
- Colour treatment: slightly desaturated; Charcoal/Cream palette harmony
- People: BIK team members only (no stock people)
- Quality: professional, well-lit, not phone photos

---

## Related Documents

- [ux-principles.md](ux-principles.md) — Design philosophy and component patterns
- [coding-standards.md](coding-standards.md) — CSS naming conventions
