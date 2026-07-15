# API Documentation

**Purpose:** Specify API endpoints, integrations, and AI service interfaces for BIK Business Toolkit.
**Last Updated:** 2026-07-15
**Status:** Draft (Phase 2 planning)
**Owner:** BIK Solutions Pty Ltd

---

## Current Integrations (Phase 1)

### Formspree
**Purpose:** Form submissions (contact, waitlist, download gate)
**Endpoint:** `https://formspree.io/f/xojonaww`
**Method:** POST
**Headers:** `Accept: application/json`
**Body:** `FormData` (multipart/form-data)

**Forms using this endpoint:**
- Contact form (`contact.html`)
- Free download gate (`resources.html`)
- Waitlist form (`coming-soon.html`) — planned

**Response handling:**
- `res.ok` (200–299): Success state shown
- Non-ok: Error message shown with phone number fallback

**Note:** All form data is stored in Formspree dashboard. Export monthly to spreadsheet for CRM use.

---

### Gumroad
**Purpose:** Digital product sales (templates, bundles)
**Integration:** Outbound links to Gumroad product pages
**No API integration in Phase 1** — direct links only.

**Phase 2 plan:** Use Gumroad Ping (webhook) to grant access to purchased templates.

---

## Phase 2 Planned API (Draft)

### Base URL
```
https://api.biksolutions.com.au/v1/
```
(Or via Vercel/Netlify serverless function path)

### Authentication
All protected endpoints require Bearer token:
```
Authorization: Bearer <jwt_token>
```

Tokens issued by Supabase Auth; 1-hour expiry; refresh token rotation.

---

### Endpoints (Draft)

#### POST /auth/signup
Create a new user account.
```json
Request:
{
  "email": "user@example.com",
  "password": "string",
  "company_name": "string",
  "trade_type": "builder | trades | property_manager | other"
}

Response 201:
{
  "user_id": "uuid",
  "email": "user@example.com",
  "tier": "free"
}
```

#### POST /auth/login
```json
Request:
{ "email": "string", "password": "string" }

Response 200:
{
  "access_token": "jwt",
  "refresh_token": "string",
  "user": { "id": "uuid", "email": "string", "tier": "free | starter | pro | business" }
}
```

#### POST /documents/generate
Generate a document using AI.
```json
Request:
{
  "tool_id": "quote-builder | swms-generator | site-diary | ...",
  "inputs": {
    // Tool-specific input fields
    // See tool specifications in docs/specifications/
  }
}

Response 202 (async):
{
  "job_id": "uuid",
  "status": "queued",
  "estimated_seconds": 15
}
```

#### GET /documents/generate/:job_id
Poll for document generation result.
```json
Response 200 (complete):
{
  "job_id": "uuid",
  "status": "complete",
  "document": {
    "id": "uuid",
    "title": "Quote - Smith Residence",
    "tool_id": "quote-builder",
    "created_at": "ISO8601",
    "pdf_url": "https://storage.supabase.../doc.pdf",  // Signed URL, 24h expiry
    "html_preview": "<string>"  // For in-browser preview
  }
}

Response 200 (pending):
{
  "job_id": "uuid",
  "status": "processing",
  "progress": 0.6
}
```

#### GET /documents
List user's document history.
```json
Response 200:
{
  "documents": [
    {
      "id": "uuid",
      "title": "string",
      "tool_id": "string",
      "created_at": "ISO8601",
      "pdf_url": "string"
    }
  ],
  "total": 42,
  "page": 1
}
```

#### GET /subscription
Get current subscription status.
```json
Response 200:
{
  "tier": "pro",
  "status": "active",
  "current_period_end": "ISO8601",
  "generations_used": 12,
  "generations_limit": null  // null = unlimited
}
```

---

## AI Integration (Phase 2)

### Provider
Anthropic Claude API (claude-sonnet-5 or claude-haiku-4-5 depending on tool complexity)

### Prompt Architecture
Each tool has a system prompt (stored in `docs/prompts/`) that:
1. Sets the role and context ("You are an Australian construction document expert...")
2. Specifies the output format (structured JSON or HTML)
3. Includes Australian compliance requirements
4. Includes a disclaimer instruction for legal documents

See [prompts/](prompts/) for individual tool prompt specifications.

### Rate Limits
- Free tier: 5 generations/month
- Starter: 20 generations/month
- Pro: Unlimited (subject to platform-level rate limiting at 100/day per user)
- Business: Unlimited

### Error Handling
- Claude API timeout (>30s): Return to user with "Generation timed out — please try again"
- Content policy rejection: Return "Unable to generate this document — please contact support"
- All errors logged for review

---

## Webhook Events (Phase 2)

### Stripe Webhooks
```
/webhooks/stripe

Events handled:
- customer.subscription.created  → provision tier access
- customer.subscription.updated  → update tier
- customer.subscription.deleted  → downgrade to free
- invoice.payment_failed         → send payment failed email
```

### Gumroad Ping (Phase 2)
```
/webhooks/gumroad

Events handled:
- sale  → unlock purchased template for user's email
```

---

## Related Documents

- [technical-architecture.md](technical-architecture.md) — Stack decisions
- [prompts/](prompts/) — AI system prompts per tool
- [specifications/](specifications/) — Tool input/output specifications
