/**
 * BIK Integration Layer — Public Entry Point
 *
 * Import from this module only. Never import providers or core modules directly
 * from business components — doing so would couple business logic to a specific
 * provider and break the abstraction layer.
 *
 * Usage:
 *   import { initIntegrations, createInvoice, attachDocument } from '../integrations/index.js';
 *   initIntegrations();          // call once at app start
 *   await createInvoice(data);   // delegates to active provider
 */

// ── Lifecycle ───────────────────────────────────────────────────
export { initIntegrations, configureProvider, setActiveProvider,
         disconnectProvider, getIntegrationSettings,
         SUPPORTED_PROVIDERS } from './config/integration-config.js';

// ── Registry (read-only access for UI) ──────────────────────────
export { registry } from './core/provider-registry.js';

// ── Contact operations ───────────────────────────────────────────
export { createCustomer, getContact, listContacts,
         searchContacts, updateContact } from './services/contact-service.js';

// ── Invoice operations ───────────────────────────────────────────
export { createInvoice, getInvoice, listInvoices,
         updateInvoice, sendInvoice, voidInvoice } from './services/invoice-service.js';

// ── Quote operations ─────────────────────────────────────────────
export { createQuote, getQuote, listQuotes,
         acceptQuote, declineQuote } from './services/quote-service.js';

// ── Project operations ───────────────────────────────────────────
export { createProject, getProject, listProjects,
         updateProject, closeProject } from './services/project-service.js';

// ── Attachment operations ────────────────────────────────────────
export { attachDocument, listAttachments,
         deleteAttachment } from './services/attachment-service.js';

// ── Interface helpers ────────────────────────────────────────────
export { validateContact, contactFromFormData } from './interfaces/contact.js';
export { validateInvoice, invoiceFromVariationNotice,
         centsToAUD, audToCents, GST_RATE } from './interfaces/invoice.js';
export { validateQuote }                       from './interfaces/quote.js';
export { validateProject, projectFromVariationFormData } from './interfaces/project.js';
export { validateAttachment }                  from './interfaces/attachment.js';
export { validateDocument, documentFromVariationNotice,
         TOOL_IDS }                            from './interfaces/document.js';

// ── Error types ──────────────────────────────────────────────────
export { BIKIntegrationError, AuthenticationError, NotFoundError,
         ValidationError, ProviderError, NotImplementedError,
         RateLimitError, NetworkError, TimeoutError,
         CapabilityError, NoProviderError } from './core/errors.js';

// ── Logging ──────────────────────────────────────────────────────
export { createLogger, rootLogger } from './core/logger.js';
