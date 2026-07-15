# Release Plan

**Purpose:** Release schedule, launch checklists, and deployment process for BIK Solutions.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Current Release: Phase 1 Website Build

**Branch:** `claude/bik-solutions-website-yevsuk`
**Target:** biksolutions.com.au
**Hosting:** GitHub Pages
**Status:** In Progress

### Scope
- Add Business Toolkit dropdown to nav (all 7 existing pages)
- Create 6 new toolkit pages
- Add SaaS component CSS to styles.css
- Test all pages locally before push

### Definition of Done
- [ ] All 6 new pages created and styled
- [ ] Nav dropdown working on desktop (hover) and mobile (drawer links)
- [ ] No console errors on any page
- [ ] All internal links resolve (no 404s)
- [ ] Contact form still works (Formspree)
- [ ] Mobile nav opens/closes on all pages
- [ ] Scroll animations work on all pages
- [ ] Lighthouse score ≥ 85 on homepage
- [ ] Pushed to branch and GitHub Pages live

---

## Deployment Process

### GitHub Pages (Current)

1. **Test locally** using Python HTTP server:
   ```bash
   python3 -m http.server 8080 --directory /home/user/BIK-Solutions
   ```
2. **Verify** with Playwright screenshots (desktop + mobile)
3. **Commit** with descriptive message
4. **Push** to branch:
   ```bash
   git push -u origin claude/bik-solutions-website-yevsuk
   ```
5. GitHub Pages auto-deploys within ~2 minutes
6. **Verify live** at biksolutions.com.au

### If Push Rejected (Remote Ahead)
```bash
git pull origin claude/bik-solutions-website-yevsuk --rebase
git push -u origin claude/bik-solutions-website-yevsuk
```

---

## Planned Releases

### Phase 1.0 — Toolkit Pages Launch
**Target:** Q3 2026
- 6 new toolkit pages
- Updated navigation
- Waitlist form live

### Phase 1.1 — Free Template Library
**Target:** Q3 2026 (2–3 weeks after 1.0)
- First 5 free downloadable templates
- Gated by email (Formspree)
- SEO content for template keywords

### Phase 2.0 — Platform Launch
**Target:** Q1 2027
- User authentication (Supabase)
- First 10 AI tools live
- Stripe subscription payments
- Pro and Starter tier access

### Phase 2.1 — Document History
**Target:** Q2 2027
- User dashboard
- Document save and retrieval
- PDF export with branding

---

## DNS and Domain

**Domain:** biksolutions.com.au
**Registrar:** GoDaddy
**DNS Records:**

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | kconnelly81.github.io |

**Important:** The GoDaddy "Parked" A record was deleted in a previous session. Do not re-add it — it would override GitHub Pages and show the GoDaddy parking page.

**HTTPS:** GitHub Pages SSL certificate. Enforce HTTPS checkbox in GitHub Pages settings once cert is fully issued.

---

## Rollback Procedure

If a deployment breaks the live site:

1. Identify the last working commit:
   ```bash
   git log --oneline -10
   ```
2. Revert to it:
   ```bash
   git revert HEAD
   git push -u origin claude/bik-solutions-website-yevsuk
   ```
   (Do not use `git reset --hard` without confirmation — it discards history.)

---

## Related Documents

- [technical-architecture.md](technical-architecture.md) — Infrastructure detail
- [feature-backlog.md](feature-backlog.md) — Task tracking
- [changelog.md](changelog.md) — Version history
