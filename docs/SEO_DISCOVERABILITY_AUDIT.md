# BIK Solutions — Technical SEO & Discoverability Audit

**Date:** 2026-08-03
**Scope:** https://biksolutions.com.au (GitHub Pages, classic branch-deploy from `main`, no build step — repo source is byte-for-byte the live site)
**Auditor role:** Technical SEO / Web Architecture / AI Discoverability review of the full repository source
**Environment limitation (disclosed up front):** Outbound network access to `biksolutions.com.au` and to Google/Bing tooling was blocked in this sandbox (`host_not_allowed`, HTTP 403 on both `curl` and `WebFetch`). This audit was therefore conducted directly against the repository source, which is confirmed to deploy unmodified via GitHub Pages classic branch-deploy (no `.github/workflows`, no build/transform step). Everything below reflects what a crawler will see, but live PageSpeed/mobile-usability scores, actual current Search Console data, and real-world crawl-budget behaviour could not be pulled directly and should be verified once Search Console is connected (Phase 4).

---

## 1. Executive Summary

The core reason Google was indexing the GitHub repository ahead of the website was structural, not a ranking problem: the site had **zero** of the standard machine-readable signals that tell search engines and AI systems what it is. No `robots.txt`, no `sitemap.xml`, no canonical tags, no Open Graph/Twitter metadata, no structured data, no favicon — on any of the 54 HTML pages in the repo. On top of that, the homepage's entire visible content (title, meta description, H1, hero copy) described only the *local trade-services business* side of BIK, with no mention anywhere of the AI/SaaS toolkit — so even a well-crawled homepage gave search engines no strong topical link between "BIK Solutions" and "AI operations platform for trades." A GitHub repo with clear file names and a README was, in that context, a more legible document to a crawler than the homepage was.

This audit implemented the full set of safe, mechanical technical-SEO fixes directly in the repository (committed to `main`, live now): `robots.txt` + `sitemap.xml`, canonical URLs, favicon (SVG + PNG set), full Open Graph/Twitter metadata with a generated branded share image, JSON-LD structured data (Organization, WebSite, FAQPage, SoftwareApplication), a branded 404 page, `.nojekyll`, site-wide footer consistency fixes, and five factual corrections on `faq.html` where the copy no longer matched the shipped product. One deliberate content decision — rewriting the homepage hero copy to foreground the AI toolkit — is **recommended but not force-applied** (Phase 5 below), consistent with how brand/positioning changes have been handled throughout this project: implementation-safe changes ship directly, brand/copy decisions come back to you for sign-off.

## 2. Scores

| Score | Value | Basis |
|---|---|---|
| **Overall SEO score** | **58 / 100** | Weighted: technical foundation now strong; content/authority signals still thin (new domain, no backlinks, no blog, homepage copy doesn't foreground the product) |
| **Technical SEO score** | **82 / 100** | All 21 checks addressed or explicitly N/A; remaining gap is unverifiable live performance data (Phase 1) and Search Console not yet connected (Phase 4) |
| **AI Discoverability score** | **60 / 100** | Organization/WebSite/FAQPage/SoftwareApplication schema and AI-crawler-friendly `robots.txt` now in place; site still lacks the volume of dated, quotable content (docs, blog, release notes as public pages) that AI answer engines weight most heavily |

Scores are estimates based on repository-source inspection, not a live crawl — treat them as directional, and re-baseline once Search Console/Bing Webmaster Tools are connected (Phase 4).

## 3. Critical Issues (highest priority, ranked)

1. **Homepage copy never mentions the AI/SaaS product.** The single biggest topical-authority gap. `index.html`'s H1 and hero paragraph describe only the trades/deconstruction business. Recommendation drafted in Phase 5 below — **not yet applied, awaiting your sign-off.**
2. **No backlinks / no off-site presence yet.** Technical fixes only help crawlers *understand* the site once they arrive — Phase 8 below is the plan to get anything pointing at it.
3. **Search Console / Bing Webmaster Tools not yet connected.** Sitemap now exists but hasn't been submitted anywhere. This is the single highest-leverage next action (5 minutes, zero risk) — see Phase 4.
4. **No dated, citable long-form content** (blog, docs-as-pages, case studies). AI answer engines (ChatGPT Search, Perplexity, Gemini, AI Overviews) preferentially cite pages with clear authorship/dates and specific, quotable claims. `release-notes.html` and `roadmap.html` are the closest existing candidates but are changelog-style, not narrative.
5. **`shop.html` has no Product/Offer structured data** — deliberately, because all 11 listings show "POA" with no real numeric price. Not a bug to fix by adding fake data; a business decision (publish real indicative pricing, or leave as-is) — flagged for your awareness, no action taken.

## 4. Phase 1 — Technical SEO Audit (21 checks)

Legend: Severity = Critical / High / Medium / Low / Info. Effort = S(mall, done)/M(edium)/L(arge).

| # | Check | Finding | Severity | Fix | Effort | Status |
|---|---|---|---|---|---|---|
| 1 | Page titles | 0/54 pages had unique, descriptive titles tuned for search; several were generic ("BIK Solutions"). | High | Verified/rewrote titles on all 20 indexable pages; unique per page, 20-78 chars. | S | **Done** |
| 2 | Meta descriptions | Several indexable pages had no `<meta name="description">` at all (`landing.html`). | High | Added missing descriptions; audited length across all 20 pages (70-191 chars — see note below). | S | **Done**, 1 recommendation below |
| 3 | Heading hierarchy | Spot-checked all 20 indexable pages: each has exactly one `<h1>`. No hierarchy defects found. | Low | N/A | — | **Pass** |
| 4 | Canonical URLs | 0/54 pages had `<link rel="canonical">`. | High | Added to all 20 indexable pages, self-referencing absolute URLs. | S | **Done** |
| 5 | robots.txt | File did not exist at repo root. | Critical | Created `robots.txt` at root: allows all crawlers including named AI crawlers (GPTBot, ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, ChatGPT-User, Bingbot), links `Sitemap:`. Does **not** `Disallow` the noindex'd tool pages (see design note below). | S | **Done** |
| 6 | sitemap.xml | File did not exist. | Critical | Created `sitemap.xml`, 20 `<url>` entries (all indexable pages), `lastmod` dates, priority weighting (`toolkit.html` 0.9, etc.). | S | **Done** |
| 7 | Open Graph tags | 0/54 pages had any `og:*` tags. | High | Full OG block (`og:type/site_name/title/description/url/image/image:width/height/locale`) added to all 20 indexable pages, generated 1200×630 branded share image. | M | **Done** |
| 8 | Twitter/X card metadata | 0/54 pages had `twitter:*` tags. | Medium | `summary_large_image` card added to all 20 pages, reusing the OG image. | S | **Done** |
| 9 | Favicon | No favicon anywhere; browsers/search result thumbnails fell back to a blank/default icon. | Medium | New SVG-primary favicon (coral mark, brand-consistent) + PNG fallbacks at 32/180 (apple-touch-icon)/192/512px, linked from all indexable pages plus `404.html`. | M | **Done** |
| 10 | Structured data / schema.org | 0/54 pages had any JSON-LD. | Critical | Organization + WebSite on `index.html`, FAQPage (11 Q&As) on `faq.html`, SoftwareApplication on `toolkit.html`. All validated as parseable JSON. See Phase 2 for detail and rationale. | M | **Done** |
| 11 | Breadcrumbs (visual + BreadcrumbList) | No visual breadcrumb UI exists anywhere on the site; it's a shallow, mostly one-level nav structure (nav bar covers depth). | Low | Not implemented — see note below. | — | **Deferred, see note** |
| 12 | Internal linking | Footer nav was inconsistent: several pages missing links to `toolkit.html` and/or `faq.html`; `about.html`/several others had a stale `© 2025` in the footer. | Medium | Standardised footer links across all 17 pages that share the common footer partial; added missing Toolkit/FAQ links; fixed 8 pages with stale copyright year. `landing.html`'s minimal lead-magnet footer left as-is (deliberate distraction-free design for a conversion page) but its copyright year was fixed. | S | **Done** |
| 13 | URL structure | Flat, descriptive, lowercase, hyphenated where needed (`construction-resources.html`, `progress-claim.html`) — no query strings or deep nesting. | Low | N/A | — | **Pass** |
| 14 | Image alt tags | The 20 indexable pages use **no raster `<img>` tags at all** — logo/marks are inline SVG, everything else is CSS. Only `<img>` in the whole repo is on `project.html` (a noindex'd app page). | Info | N/A — nothing to fix; flagged so it isn't mistaken for an oversight. | — | **N/A (verified)** |
| 15 | Performance (Core Web Vitals) | Could not be measured live (network restriction, see top of report). Repo-level signals are favourable: no render-blocking JS frameworks, no unused heavy libraries, plain CSS/HTML, small asset sizes. | Info | Recommend running PageSpeed Insights / Lighthouse once Search Console access is available (Phase 4) to get real LCP/CLS/INP numbers. | — | **Cannot verify in this environment — flagged** |
| 16 | Mobile-friendliness | Every audited page has a `<meta name="viewport">` tag and a mobile nav drawer pattern (`nav-drawer`, `nav-toggle`) already implemented site-wide. Cannot confirm live rendering without device/emulator access to the production URL. | Info | Recommend Google's Mobile-Friendly Test once reachable. | — | **Source suggests pass — flagged for live verification** |
| 17 | Crawlability | Previously unconstrained (no robots.txt = crawlable by default, but also no signal of what *should* be crawled). Now explicit and correct: marketing pages allowed, ~35 app/tool pages self-exclude via `noindex` (not blocked from crawling — see design note). | Medium | Addressed via #5/#6. | — | **Done** |
| 18 | Indexability | ~35 of 54 pages carry `<meta name="robots" content="noindex">` — these are gated app UIs (`project.html`, `dashboard.html`, etc.) or literal document-generator tools, correctly excluded. `faq.html` was incorrectly `noindex`'d despite being genuine public content — this was the one indexability bug found. | High | Removed `noindex` from `faq.html`. Verified all other `noindex` pages are correctly classified as app UI, not content. | S | **Done** |
| 19 | Duplicate content | No duplicate `<title>`/description pairs found across the 20 indexable pages. | Low | N/A | — | **Pass** |
| 20 | Redirects | GitHub Pages custom-domain setup (`CNAME` file present, points to `biksolutions.com.au`) — GitHub Pages auto-redirects `http→https` and enforces the canonical host once "Enforce HTTPS" is enabled in repo settings. Could not verify this toggle's live state (Settings UI access, not repo source). | Info | Verify **Settings → Pages → Enforce HTTPS** is checked in the GitHub UI — outside repo-source scope, 1-minute manual check. | — | **Action needed (outside repo)** |
| 21 | 404 handling | No custom `404.html` existed; GitHub Pages default 404 gives no branding, no navigation back into the site (a dead end for both users and crawlers). | Medium | Added branded `404.html` at repo root (GitHub Pages convention), reusing site nav/footer, `noindex`+canonical-to-self, links back to `toolkit.html`/`faq.html`. | S | **Done** |
| — | HTTPS | Enforced by GitHub Pages for the custom domain (subject to the Settings toggle in #20). | Info | See #20. | — | **See #20** |
| — | Security headers (HSTS, CSP, X-Frame-Options, etc.) | GitHub Pages classic hosting **does not support custom response headers** — there is no `_headers` file mechanism (that's a Netlify/Vercel feature) and no server config access. | Info | Not fixable within the current hosting model. If this becomes a priority, it requires moving off GitHub Pages to a host that supports custom headers (Cloudflare Pages, Netlify) — a hosting-migration decision, not a code fix. Flagged for awareness, no action taken. | — | **Not fixable on current host — flagged** |

**Design note on robots.txt (#5/#17):** the ~35 `noindex`'d tool/app pages are deliberately **not** `Disallow`'d in `robots.txt`. Blocking crawl would prevent Googlebot from ever seeing the `noindex` tag on those pages, which can paradoxically leave old URLs indexed from before the tag existed. Allowing crawl + relying on `noindex` is the standard, correct pattern for "let Google see it and then leave it out."

**Note on breadcrumbs (#11):** the site's actual structure is shallow — nav bar + one dropdown level, no deep hierarchical paths — so a `BreadcrumbList` schema would describe a hierarchy the site doesn't really have (e.g., `Home > Toolkit > Templates` is the only real 2-hop path). Implementing it purely for schema's sake without a matching visual breadcrumb UI risks a Search Console mismatch warning. Recommend deferring until/unless deeper page hierarchies exist (e.g., individual template detail pages).

**Note on meta description lengths (#2):** `support.html` (70 chars) and `release-notes.html` (82 chars) are shorter than the ideal 120–158 char range and could be expanded to use more SERP real estate; `index.html` (187 chars) and `landing.html` (191 chars) are long enough that Google will likely truncate them. None are broken, just non-optimal — low-effort copy tightening, left as a Phase 8 backlog item rather than force-edited, since description copy is closer to a content decision than a mechanical fix.

## 5. Phase 2 — Structured Data (JSON-LD)

| Page | Schema type(s) | Why this type | Why others were skipped |
|---|---|---|---|
| `index.html` | `Organization` + `WebSite` | Organization establishes BIK Solutions as a real business entity with verified contact channels for Google's Knowledge Panel and AI answer engines. WebSite enables sitelinks search box eligibility. | `LocalBusiness` was considered and rejected — the physical address on the site is a placeholder map pin, and the ABN is explicitly "to be confirmed" per `roadmap.html`; fabricating either would violate schema.org/Google's structured-data guidelines and risk a manual action. Only verified fields (phone, email, name, URL) were used. |
| `faq.html` | `FAQPage` | 11 real Q&A pairs already existed as visible page content — direct, defensible match, and FAQPage is one of the highest-value schema types for AI Overviews/answer-engine citation since it's literally pre-formatted as question→answer. | — |
| `toolkit.html` | `SoftwareApplication` | The toolkit is a real web application with a genuine price point ("free during Beta," confirmed against `faq.html`'s corrected pricing answer) — accurately describable without fabrication. | `Product` schema (with `Offer.price`) was considered for `shop.html` instead and **rejected**: every one of its 11 listings shows "POA" with no real numeric price anywhere in the markup. Required `Offer.price` fields would have to be invented. Better to have no Product schema than one Google could flag as inaccurate structured data. |
| — | `Article`, `Person` | Not applied anywhere. | No page on the site is an authored, dated editorial article (release-notes/roadmap are changelog-style, not narrative), and no individual is presented as a named author/expert on any page — both are correctly out of scope right now. Once a blog exists (Phase 8), `Article` becomes directly applicable. |

All JSON-LD blocks were validated as syntactically correct JSON via `json.loads()` before commit (site-wide sweep re-run at the end of this session — zero invalid blocks across all 54 pages).

## 6. Phase 3 — Search Engine Readiness

| Engine | Readiness | Notes |
|---|---|---|
| **Google Search** | Good | Canonical, sitemap, robots.txt, structured data, OG image all now present. Remaining gap is Search Console submission (Phase 4) and off-site authority (Phase 8). |
| **Bing** | Good | `Bingbot` explicitly allowed in `robots.txt`; sitemap referenced. Bing Webmaster Tools submission not yet done — same action as Search Console, near-zero effort. |
| **Google AI Overviews** | Fair | Structured data (Organization/FAQPage) and clean, crawlable HTML help; the current content depth (marketing pages, no long-form docs/blog) limits how often the site would be the *cited* source for a generative answer versus just a link. |
| **ChatGPT Search** | Fair | `GPTBot` and `ChatGPT-User` explicitly allowed in `robots.txt`. FAQPage schema directly helps here — OpenAI's crawler and search product favour clearly structured Q&A content. Same content-depth caveat as above. |
| **Gemini** | Fair | `Google-Extended` explicitly allowed (governs Gemini/Bard training+grounding use of Google-crawled content, separate from classic Googlebot). Same content-depth caveat. |
| **Perplexity** | Fair | `PerplexityBot` explicitly allowed. Perplexity weights recency and citation-friendly formatting highly — `release-notes.html` (dated entries) is the best-positioned existing page for this; more dated content would help more than any further technical change. |

## 7. Phase 4 — Google Search Console Readiness

| Item | State |
|---|---|
| `sitemap.xml` | **Created**, referenced from `robots.txt`. Ready to submit. |
| `robots.txt` | **Created**, no accidental blocks, allows all standard + AI crawlers. |
| Canonical consistency | **Consistent** — every indexable page self-canonicalizes to its own `https://biksolutions.com.au/<page>` URL; no conflicting canonicals. |
| Duplicate URLs | None found (checked for duplicate title/description pairs — see Phase 1 #19). |
| Preferred domain | `CNAME` file sets `biksolutions.com.au` (apex, no `www`) — consistent with all canonical/OG URLs used throughout this audit. |
| Crawl paths | Flat, all pages reachable from the homepage nav within 1-2 clicks; no orphaned indexable pages found. |

**Action required (outside repo scope, needs your GitHub/Google account access):**
1. Verify **Settings → Pages → Enforce HTTPS** is checked (Phase 1 #20).
2. Add the property in Google Search Console, verify via the existing DNS/HTML-tag method, submit `https://biksolutions.com.au/sitemap.xml`.
3. Same for Bing Webmaster Tools (can import directly from Search Console in a couple of clicks).

These three steps are the highest-leverage, lowest-effort remaining actions in this entire audit — recommend doing them first, before anything in Phase 8.

## 8. Phase 5 — Content Discoverability (Homepage Clarity)

**Finding:** `index.html`'s H1 — "When it needs to be done right the *second* time." — and its hero paragraph describe only the physical trade-services business (deconstruction/demolition-adjacent positioning). Nowhere above the fold — or arguably anywhere on the page — does it say BIK Solutions is also an AI-powered software toolkit for trade businesses. A first-time visitor (human or crawler) reading only the hero has no way to know the SaaS product exists. This is very likely the single largest reason the GitHub repository (whose README and file names openly describe "AI-powered quoting/toolkit/Supabase platform") reads to Google as more topically relevant to those search terms than the homepage does.

**Recommendation (not applied — content/brand decision, awaiting your sign-off):**
- Add a short, clearly-scoped section near the top of the homepage (or a strengthened eyebrow/subhead near the existing hero) that names the toolkit explicitly: who it's for (Australian trade businesses), what it does (AI-generated quotes, variation notices, progress claims, site diaries), and that it works *alongside* existing tools like ServiceM8/Buildxact/SimPRO rather than replacing them — consistent with the product-direction decisions already recorded in `docs/business-strategy.md`.
- This does not require replacing the existing trade-services positioning, just adding a clear, crawlable statement of the second product line. Happy to draft exact copy on request — held back here because homepage messaging is a brand decision, not a mechanical fix.

## 9. Phase 6 — Internal Linking

- **Footer:** now consistent across all 17 pages sharing the standard footer partial — every page links to `toolkit.html` and `faq.html` (previously missing on many), stale `© 2025` corrected to `© 2026` on 8 pages. (Details in Phase 1 #12.)
- **Nav bar:** primary nav (`services.html`, `builders.html`, `about.html`, toolkit dropdown, `shop.html`, `resources.html`, `contact.html`) is consistent site-wide already — no defects found.
- **Cross-linking into docs/blog:** none exists yet, because no public docs/blog pages exist yet — this is a Phase 8 content-strategy item, not a linking bug.
- **`landing.html`** intentionally keeps a minimal footer (phone + site link only) as a lead-magnet/conversion page — this is a legitimate UX pattern (reduce exit paths on a single-CTA page), left as-is except for the copyright year fix.

## 10. Phase 7 — AI Discoverability

What AI systems can now reliably determine from crawling the site, and where each fact comes from:

| Fact | Source after this audit |
|---|---|
| Company name | `Organization` JSON-LD (`name`), page titles, OG `site_name` |
| Official website | Canonical tags + `Organization.url` + `WebSite` schema, all pointing at `https://biksolutions.com.au` |
| Country | Content copy ("Australian trade businesses," QBCC/WHS references) — no explicit `Organization.address.addressCountry` was added since street address is a placeholder (see Phase 2 rationale) |
| Product category | `SoftwareApplication.applicationCategory: BusinessApplication`, page titles/descriptions |
| Target customers | `SoftwareApplication.audience`, homepage/toolkit copy ("Australian builders, tradies and property managers") |
| Key features | `toolkit.html` copy, `FAQPage` schema Q&As |
| Pricing | `SoftwareApplication.offers` ("Free during the Beta period," `price: 0`) — matches the corrected `faq.html` answer |
| Contact info | `Organization` JSON-LD (verified real phone/email only — no fabricated ABN/address) |

Remaining gap: AI answer engines weight **volume and recency of citable content** heavily, and the site currently has very little of it beyond the FAQ. This is a content-production question (Phase 8), not a further technical fix.

## 11. Phase 8 — 6-Month Authority Building Plan (no paid advertising)

**Month 1**
- Submit sitemap to Search Console + Bing Webmaster Tools (Phase 4 actions).
- Ship the homepage-copy update from Phase 5 (pending your sign-off).
- Publish 2-3 short FAQ-style pages targeting specific search queries trades actually type (e.g., "how to write a variation notice Queensland," "progress claim template Australia") — each a natural FAQPage-schema candidate.

**Month 2**
- Turn `release-notes.html` into a proper dated changelog people (and AI crawlers) can cite — add per-entry anchors and consider `Article`/`BlogPosting` schema per release once entries are substantive enough.
- Add 3-5 short "how this works" doc pages under a `/docs/` or `/guides/` public path (e.g., "How BIK Quotes work," "How Progress Claims work") — genuinely useful, also plugs the AI-discoverability content-depth gap directly.

**Month 3**
- Reach out for 3-5 relevant, legitimate backlink opportunities: trade associations, QBCC-adjacent resource directories, local Gold Coast/Brisbane business directories, guest posts on trade/construction industry blogs. No paid placements.
- Add a `Person`/team page if/when there's a named founder or team member willing to be publicly attributed — helps both E-E-A-T signals and AI "who runs this" queries.

**Month 4**
- Publish 2-3 genuine case studies or before/after workflow stories (e.g., "How [trade] cut quoting time from 2 hours to 10 minutes") — high-value, highly citable, no fabrication needed once real users exist.
- Revisit meta description lengths flagged in Phase 1 #2 (`support.html`, `release-notes.html`) as part of a general content-quality pass.

**Month 5**
- Add `BreadcrumbList` schema if/when deeper page hierarchies exist (e.g., individual template/tool detail pages) — deferred from Phase 1 #11 until there's a real hierarchy to describe.
- Consider whether `shop.html` should carry real indicative pricing (unblocking `Product` schema) — a business decision, not a technical one.

**Month 6**
- Full re-audit: re-run Phase 1's 21 checks, pull real Search Console data (impressions, clicks, indexed-page count, any manual actions), compare against this baseline.
- Decide whether the security-headers gap (Phase 1, HTTPS/headers row) is worth a hosting migration off GitHub Pages, based on actual traffic/risk profile by then.

---

## 12. What Was Implemented in This Session (Deliverable #8/#9)

Committed to `main` in commit `cdc79a2` ("SEO: add technical SEO infrastructure and structured data site-wide"), pushed live:

- `robots.txt`, `sitemap.xml` (new, repo root)
- `.nojekyll` (new, repo root — ensures GitHub Pages doesn't silently exclude underscore-prefixed paths)
- `404.html` (new, branded, repo-root convention for GitHub Pages)
- `assets/brand/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.png` (new brand asset set)
- Canonical + favicon + full OG/Twitter metadata block added to all 20 indexable pages
- Organization + WebSite JSON-LD on `index.html`; FAQPage JSON-LD on `faq.html`; SoftwareApplication JSON-LD on `toolkit.html`
- `faq.html`: removed incorrect `noindex`; corrected 5 statements that no longer matched the shipped product (login/account requirement, AI Writer setup/data-storage claims ×2, pricing/AI-key claim) after checking against the live `js/toolkit/ai-writer.js` proxy implementation
- Footer consistency: added missing `toolkit.html`/`faq.html` links across 17 pages, corrected stale `© 2025` → `© 2026` on 8 pages
- Full JS test suite re-run after all changes: **107/107 passing**, unaffected (all changes scoped to public marketing pages, no app/tool logic touched)

## 13. Remaining Recommendations (not applied, awaiting decision or outside repo scope)

1. Enable "Enforce HTTPS" in GitHub Pages settings if not already on (1-minute manual check).
2. Submit sitemap to Google Search Console + Bing Webmaster Tools (near-zero effort, highest remaining leverage).
3. Homepage hero copy update to foreground the AI toolkit (Phase 5) — drafted recommendation above, copy not yet written pending your go-ahead.
4. 6-month content/authority plan (Phase 8) — no code changes, a content production roadmap.
5. `shop.html` Product schema — blocked on a real-pricing decision, not a technical gap.
6. Security headers / HSTS — not achievable on current GitHub Pages hosting; would require a hosting migration if it becomes a priority.
7. Live performance/mobile-usability verification via PageSpeed Insights / Google's Mobile-Friendly Test once the site is reachable from an environment with network access, or once Search Console is connected.

Nothing in this list requires further code changes to execute — items 1-2 are account-access actions, 3 is a copy decision, 4 is a content roadmap, 5-6 are business/hosting decisions, 7 is a verification step. No Sprint 6 (AI Edge Function) work was started or implied by any of this — that remains a separate, paused proposal per your earlier instruction.
