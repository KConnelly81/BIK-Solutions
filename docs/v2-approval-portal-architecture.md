# V2 Approval Portal — Architecture Design

**Status:** Design only — not implemented  
**Version:** Design v1.0  
**Date:** 15 July 2026  
**Depends on:** V1 Client Approval Workflow (implemented Sprint 4)

---

## Purpose

V2 transforms the manual approval tracking in V1 into a fully digital, self-serve approval experience. The client receives a secure link, reviews the Variation Notice in their browser, and signs digitally — without needing a printer, scanner, or email attachment.

V1 data structures are forward-compatible: every `record.approval` field used in V2 already exists in the V1 schema (set to `null` in V1).

---

## V1 vs V2 Comparison

| Capability | V1 (Live) | V2 (Planned) |
|---|---|---|
| Send approval email | ✅ Via mailto: | ✅ Via backend API |
| Track status | ✅ Manual builder update | ✅ Auto-updated when client responds |
| Client review page | ❌ | ✅ Secure portal link |
| Digital signature | ❌ | ✅ |
| Audit log | ❌ | ✅ Timestamped, IP-logged |
| PDF locking | ❌ | ✅ Locked on approval |
| Xero invoice creation | ❌ | ✅ Post-approval trigger |
| Storage | localStorage | Database (Supabase) |

---

## V2 Data Flow

```
Builder generates VN
       ↓
Builder clicks "Send for approval" → Backend generates portalToken (UUID) + portalUrl
       ↓
Backend sends email to client with portalUrl
       ↓
Client opens portal link → Review page loads the locked VN PDF
       ↓
Client clicks "Approve" or "Request changes"
       ↓
If Approved:
  → Client signs (signature pad → base64)
  → PDF is locked + SHA-256 hash stored
  → Audit log entry written
  → Builder notified
  → Xero invoice created (if integration enabled)
If Request Changes:
  → Client submits change notes
  → Builder notified
  → Status → 'changes-requested' (V2-only status, not in V1)
```

---

## Backend Requirements

V2 requires a backend. Recommended stack given the existing architecture:

| Component | Choice | Reason |
|---|---|---|
| API | Supabase Edge Functions | Serverless, no infra management |
| Database | Supabase Postgres | Row-level security, real-time, auth |
| File storage | Supabase Storage | PDF storage + signed URLs |
| Auth | Supabase Auth | Builder login for multi-device |
| Email | Resend (resend.com) | Transactional email, simple API |
| Signature | Signature Pad (open source) | Lightweight canvas-based |

This is a significant architecture shift — the product moves from fully static to requiring a Supabase project and a domain for the approval portal.

---

## Portal Page Design

The client portal URL will follow this pattern:

```
https://approve.biksolutions.com.au/v/{portalToken}
```

**Portal page flow:**

1. Builder name, logo, project name shown — no login required for client
2. PDF rendered inline (from Supabase Storage signed URL)
3. Two primary actions:
   - **Approve** — requires name entry + signature pad
   - **Request changes** — requires text input explaining changes needed
4. On Approve:
   - POST to `/api/approve` with `{ token, name, signature }`
   - Server validates token, locks PDF, writes audit entry, sends confirmation email
5. Expiry: portal links expire after 30 days (configurable per VN)

---

## V1 → V2 Data Migration

No migration required for the approval sub-object shape — V1 already writes all V2 fields as `null`. The `DOCUMENT_HISTORY_STORAGE_POINT` comment in `document-history.js` marks where `_load()` / `_save()` swap from localStorage to Supabase API calls.

The only new V2 status is `'changes-requested'` — not present in V1. The V1 status change UI will need this option added.

```javascript
// V1 approval object (already written to localStorage)
record.approval = {
  status:              'sent',
  statusUpdatedAt:     '2026-07-15T...',
  sentAt:              '2026-07-15T...',
  sentTo:              'client@email.com',
  sentBy:              'builder',
  approvedAt:          null,
  rejectedAt:          null,
  notes:               null,
  // These are null in V1, populated in V2:
  portalToken:         null,  // ← UUID for portal link
  portalUrl:           null,  // ← full URL
  portalRequestedAt:   null,  // ← when link was generated
  portalRespondedAt:   null,  // ← when client responded
  clientIp:            null,  // ← client IP at signing
  clientUserAgent:     null,  // ← browser at signing
  clientSignature:     null,  // ← base64 signature data
  pdfHash:             null,  // ← SHA-256 of locked PDF
  pdfLockedAt:         null,  // ← when PDF was locked
  auditLog:            [],    // ← [{ts, action, actor, ip}]
  xeroInvoiceId:       null   // ← Xero invoice ID post-approval
}
```

---

## Xero Integration

Post-approval, V2 can optionally create a Xero invoice for the variation amount:

- Requires builder to connect Xero account (OAuth2 flow)
- On approval: POST to Xero API with line item = variation cost
- Store `xeroInvoiceId` on the approval record
- Builder sees "Invoice created in Xero" in the approval bar

This is a separate sprint. The connection flow and OAuth token storage are not yet designed.

---

## Security Design

| Concern | V2 Approach |
|---|---|
| Portal link guessability | `portalToken` = UUID v4 (cryptographically random, 122 bits entropy) |
| Link expiry | 30-day TTL enforced server-side |
| PDF integrity | SHA-256 hash of PDF stored at time of locking |
| Signature authenticity | IP + user-agent logged; signature timestamp from server |
| XSS on portal page | All VN content escaped before rendering in portal |
| CSRF | Portal submit uses token-scoped API endpoint (stateless, no session) |
| Rate limiting | Supabase Edge Functions rate limiting on `/api/approve` |

---

## Sprint Estimate

| Work item | Estimate |
|---|---|
| Supabase project setup + schema | 1 day |
| Edge Functions (send, approve, reject) | 2 days |
| Client portal HTML page | 1 day |
| Signature pad integration | 0.5 days |
| PDF storage + locking + hash | 1 day |
| Builder notification emails | 0.5 days |
| V1 → V2 UI changes (portal link in approval bar) | 0.5 days |
| Xero integration | 2 days (separate sprint) |
| **Total (excl. Xero)** | **~6.5 days** |

---

## Integration Points in Current Code

These comments mark V2 integration points already in the codebase:

| File | Comment | What changes in V2 |
|---|---|---|
| `js/toolkit/document-history.js` | `DOCUMENT_HISTORY_STORAGE_POINT` | `_load()` / `_save()` swap to Supabase API |
| `js/toolkit/approval-ui.js` | `APPROVAL_INTEGRATION_POINT` | `_openSendModal()` sends to backend instead of mailto: |
| `js/toolkit/analytics.js` | `ANALYTICS_INTEGRATION_POINT` | Already stubbed for GA4/Clarity |

---

## Recommended V2 Phasing

**Phase 2a — Portal (no Xero):**
Supabase backend + client portal + digital signature + PDF locking + audit log.
This is the MVP for V2. Launch when Supabase project is set up and tested.

**Phase 2b — Xero:**
Separate sprint once portal is stable and builder demand is confirmed.

**Phase 2c — Multi-device:**
Supabase Auth for builder login — documents sync across devices.
Currently blocked by the localStorage-only architecture.

---

*Architecture designed Sprint 4. Implementation begins Sprint 5 or later, subject to commercial priority.*
