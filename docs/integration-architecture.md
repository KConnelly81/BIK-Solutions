# BIK Integration Architecture (SPEC-002)

## Overview

The BIK Integration Layer is a provider-based abstraction that allows BIK tools to push data into third-party accounting and field service platforms without coupling business logic to any specific provider.

Business components call generic service functions (`createInvoice()`, `createCustomer()`, `attachDocument()`). The integration layer translates these into provider-specific API calls, handling authentication, retry, error normalisation, and logging transparently.

**Status:** Architecture and stubs complete. No live API connections implemented.

---

## Architecture

```
Business Component (e.g. variation-notice/index.js)
        │
        ▼
 Service Layer  ──────────────────────────────────────
 contact-service.js   invoice-service.js   quote-service.js
 project-service.js   attachment-service.js
        │
        ▼
 Provider Registry  (provider-registry.js)
        │
        ├── XeroProvider
        ├── MYOBProvider
        ├── QuickBooksProvider
        ├── BuildxactProvider
        ├── ServiceM8Provider
        ├── SimPROProvider
        └── AroFloProvider
        │
        ▼
 Core Infrastructure
 http-client.js   auth-manager.js   errors.js   logger.js
```

---

## File Structure

```
js/integrations/
  index.js                      ← Public entry point (import from here only)
  core/
    errors.js                   ← Typed error hierarchy
    logger.js                   ← Structured logging with ring buffer
    http-client.js              ← Fetch wrapper with retry + timeout
    auth-manager.js             ← OAuth2 PKCE + API key management
    provider-registry.js        ← Provider registration and selection
  interfaces/
    contact.js                  ← Contact DTO, validateContact(), AU-specific helpers
    invoice.js                  ← Invoice DTO, cents arithmetic, GST helpers
    quote.js                    ← Quote DTO
    project.js                  ← Project DTO
    attachment.js               ← Attachment DTO
    document.js                 ← BIK Document DTO, TOOL_IDS
  providers/
    base-provider.js            ← Abstract base class, capability tokens
    xero/index.js               ← Xero stub (contacts, invoices, quotes, projects, attachments)
    myob/index.js               ← MYOB stub (contacts, invoices, quotes, projects)
    quickbooks/index.js         ← QuickBooks stub (contacts, invoices, quotes, projects)
    buildxact/index.js          ← Buildxact stub (contacts, invoices, quotes, projects)
    servicem8/index.js          ← ServiceM8 stub (contacts, invoices, quotes, projects)
    simpro/index.js             ← SimPRO stub (contacts, invoices, quotes, projects)
    aroflo/index.js             ← AroFlo stub (contacts, invoices, quotes, projects)
  services/
    contact-service.js          ← createCustomer(), getContact(), etc.
    invoice-service.js          ← createInvoice(), sendInvoice(), etc.
    quote-service.js            ← createQuote(), acceptQuote(), etc.
    project-service.js          ← createProject(), closeProject(), etc.
    attachment-service.js       ← attachDocument(), listAttachments(), etc.
  config/
    integration-config.js       ← initIntegrations(), configureProvider(), localStorage
```

---

## Provider Capabilities

| Provider     | Contacts | Invoices | Quotes | Projects | Attachments |
|--------------|:--------:|:--------:|:------:|:--------:|:-----------:|
| Xero         | ✅       | ✅       | ✅     | ✅       | ✅          |
| MYOB         | ✅       | ✅       | ✅     | ✅       | —           |
| QuickBooks   | ✅       | ✅       | ✅     | ✅       | —           |
| Buildxact    | ✅       | ✅       | ✅     | ✅       | —           |
| ServiceM8    | ✅       | ✅       | ✅     | ✅       | —           |
| SimPRO       | ✅       | ✅       | ✅     | ✅       | —           |
| AroFlo       | ✅       | ✅       | ✅     | ✅       | —           |

---

## Capability Tokens

Used in `get capabilities()` on each provider:

| Token          | Methods Covered                                                 |
|----------------|-----------------------------------------------------------------|
| `contacts`     | createContact, getContact, listContacts, updateContact, searchContacts |
| `invoices`     | createInvoice, getInvoice, listInvoices, updateInvoice, sendInvoice, voidInvoice |
| `quotes`       | createQuote, getQuote, listQuotes, acceptQuote, declineQuote    |
| `projects`     | createProject, getProject, listProjects, updateProject, closeProject |
| `attachments`  | attachDocument, listAttachments, deleteAttachment               |

---

## Core Modules

### errors.js — Typed Error Hierarchy

```
BIKIntegrationError (base)
  ├── AuthenticationError     — OAuth/token failures
  ├── NotFoundError           — 404 from provider
  ├── ValidationError         — failed DTO validation (includes errors[])
  ├── ProviderError           — provider returned an error response
  ├── NotImplementedError     — stub method not yet implemented
  ├── RateLimitError          — 429; includes retryAfterMs
  ├── NetworkError            — fetch/network failure
  ├── TimeoutError            — request exceeded timeoutMs
  ├── CapabilityError         — active provider doesn't support this capability
  └── NoProviderError         — no active provider configured
```

All errors have: `code`, `meta`, `timestamp`, `toJSON()`.

### logger.js — Structured Logging

- `createLogger(namespace, context)` returns an `IntegrationLogger`
- Methods: `debug`, `info`, `warn`, `error`, `time(label, asyncFn)`
- `.child(extraContext)` for scoped sub-loggers
- 200-entry ring buffer (`IntegrationLogger._ring`) for diagnostics
- `LOG_INTEGRATION_POINT` — swap `_output()` for production log aggregation

### http-client.js — Fetch with Retry

- Retry: 3 attempts, exponential backoff (500ms base, 8000ms max)
- Retried on: 429, 500, 502, 503, 504
- Timeout: 20s default, configurable per-request
- `getHeaders` callback — provider injects auth headers
- Methods: `get`, `post`, `put`, `patch`, `delete`, `upload` (multipart)

### auth-manager.js — OAuth2 + API Key

- `buildAuthorizationUrl(cfg)` — generates PKCE challenge (S256), returns `{ url, codeVerifier, state }`
- `exchangeCode(providerId, cfg, code, verifier)` — token exchange, stores result
- `getBearerToken(providerId, oauthCfg)` — returns access token, auto-refreshes within 60s of expiry
- `apiKeyHeaders(config)` — `{ Authorization: 'ApiKey {key}' }`
- `basicHeaders(config)` — `{ Authorization: 'Basic base64(user:pass)' }`
- Phase 1: `LocalStorageTokenStore` — tokens in localStorage
- Phase 2: Swap to `SupabaseTokenStore` via `StorageAdapter` interface

### provider-registry.js — Provider Selection

```javascript
import { registry } from './core/provider-registry.js';

registry.register('xero', XeroProvider);
registry.configure('xero', { clientId: '...', tenantId: '...' });
registry.setActive('xero');

const provider = registry.getActive();
const provider = registry.getActiveForCapability('invoices'); // throws CapabilityError if unsupported
```

---

## Interface Definitions

### Contact DTO

```javascript
{
  id?:          string,          // BIK internal UUID
  externalId?:  string,          // provider-assigned ID
  providerId?:  string,          // 'xero' | 'myob' | etc.
  name:         string,          // required
  email?:       string,
  phone?:       string,
  firstName?:   string,
  lastName?:    string,
  abn?:         string,          // 11-digit AU Business Number
  acn?:         string,          // 9-digit AU Company Number
  type?:        'customer' | 'supplier' | 'both' | 'employee',
  address?: {
    line1, city, state, postcode, country
  }
}
```

### Invoice DTO

```javascript
{
  id?:                 string,
  externalId?:         string,
  externalContactId:   string,   // required — provider's contact ID
  reference?:          string,
  date:                string,   // YYYY-MM-DD
  dueDate:             string,
  status?:             'draft' | 'sent' | 'approved' | 'paid' | 'void',
  lineItems: [{
    description:    string,
    quantity:       number,
    unitPriceCents: number,      // integer cents (no floats)
    taxType?:       'GST' | 'NONE',
    accountCode?:   string
  }],
  // Computed by validateInvoice():
  subtotalCents:  number,
  gstCents:       number,
  totalCents:     number
}
```

**Important:** All amounts are stored as integer cents. Use `centsToAUD(cents)` for display and provider calls. Use `audToCents(dollars)` when reading from provider responses.

---

## Australian Tax Notes

- GST rate: 10% (`GST_RATE = 0.1`)
- Xero tax type: `OUTPUT2` (GST on Income)
- MYOB: TaxCode UID reference (must fetch tax codes first)
- QuickBooks AU: Tax Code ID (`TAX001` for GST in AU)
- All other providers: percentage (10) applied per line item

---

## Adding a New Provider

1. Create `js/integrations/providers/<name>/index.js`
2. `export class MyProvider extends BaseProvider`
3. Override `get id()`, `get name()`, `get capabilities()`
4. Override only the methods your provider supports
5. Add `IMPLEMENTATION_POINT` comments for each method showing the exact API endpoint
6. Add `_toProvider*` and `_fromProvider*` translators
7. Register in `js/integrations/config/integration-config.js` → `SUPPORTED_PROVIDERS`
8. Export config schema as `MY_CONFIG_SCHEMA`

---

## Implementing a Provider (Removing a Stub)

Each stub method has a comment like `// XERO_IMPLEMENTATION_POINT` showing:
- The HTTP method and path
- Required headers
- Request body shape
- Response mapping

Steps to implement:
1. Inject an `HttpClient` in the provider constructor
2. Call `authManager.getBearerToken(providerId, oauthCfg)` to get the auth header
3. Replace the `throw new NotImplementedError(...)` with the actual HTTP call
4. Map the response through `_fromProvider*()` before returning
5. Update `isAuthenticated()` to check real token state

---

## Integration Points for Future Phases

| Marker | Location | Phase |
|--------|----------|-------|
| `LOG_INTEGRATION_POINT` | `core/logger.js _output()` | 2 — Swap for Datadog/Sentry |
| `INTEGRATION_CONFIG_STORAGE_POINT` | `config/integration-config.js` | 2 — Move config to user account API |
| `AUTH_INTEGRATION_POINT` | `core/auth-manager.js` | 2 — Move token exchange to backend to protect client_secret |
| `XERO_IMPLEMENTATION_POINT` | `providers/xero/index.js` | 3 — Live Xero API |
| `MYOB_IMPLEMENTATION_POINT` | `providers/myob/index.js` | 3 — Live MYOB API |
| `QB_IMPLEMENTATION_POINT` | `providers/quickbooks/index.js` | 3 — Live QB API |
| `BX_IMPLEMENTATION_POINT` | `providers/buildxact/index.js` | 3 — Live Buildxact API |
| `SM8_IMPLEMENTATION_POINT` | `providers/servicem8/index.js` | 3 — Live ServiceM8 API |
| `SIMPRO_IMPLEMENTATION_POINT` | `providers/simpro/index.js` | 3 — Live SimPRO API |
| `AF_IMPLEMENTATION_POINT` | `providers/aroflo/index.js` | 3 — Live AroFlo API |

---

## Usage Example (Future — Once Providers Are Implemented)

```javascript
import {
  initIntegrations, configureProvider,
  createCustomer, createInvoice, attachDocument,
  invoiceFromVariationNotice, documentFromVariationNotice
} from '../integrations/index.js';

// App startup
initIntegrations();
configureProvider('xero', { clientId: '...', tenantId: '...' }, true);

// After generating a Variation Notice
const contact = await createCustomer({ name: 'Acme Builders', email: 'acme@example.com' });
const invoice = await createInvoice(invoiceFromVariationNotice(formData, contact.externalId));
const doc = documentFromVariationNotice(formData, html);
await attachDocument('invoice', invoice.externalId, {
  filename: `VN-${formData.variationNumber}.pdf`,
  mimeType: 'application/pdf',
  blob: pdfBlob
});
```
