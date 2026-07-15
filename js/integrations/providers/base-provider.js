/**
 * BaseProvider — Abstract Base Class
 *
 * All integration providers extend this class.
 * Every method that a provider does not support must throw NotImplementedError —
 * never return null or silently no-op, so callers get clear diagnostic feedback.
 *
 * IMPLEMENTING A NEW PROVIDER:
 *   1. Create js/integrations/providers/<name>/index.js
 *   2. Extend BaseProvider
 *   3. Override get id(), get name(), get capabilities()
 *   4. Override only the methods your provider supports
 *   5. Register in js/integrations/index.js
 *   6. See SPEC-002 (docs/specifications/integration-architecture.md)
 *
 * CAPABILITY TOKENS (use in get capabilities()):
 *   'contacts'    — createContact, getContact, listContacts, updateContact
 *   'invoices'    — createInvoice, getInvoice, listInvoices, updateInvoice, sendInvoice
 *   'quotes'      — createQuote, getQuote, listQuotes, acceptQuote
 *   'projects'    — createProject, getProject, listProjects, updateProject
 *   'attachments' — attachDocument, listAttachments, deleteAttachment
 *   'documents'   — (future) native document storage in the provider
 */

import { NotImplementedError } from '../core/errors.js';
import { createLogger }         from '../core/logger.js';

export class BaseProvider {

  /**
   * @param {Object} config — provider-specific configuration object
   */
  constructor(config = {}) {
    this._config = config;
    this.log     = createLogger(this.id);
  }

  // ── Identity (must override) ──────────────────────────────────

  /** @returns {string} Unique provider identifier, e.g. 'xero' */
  get id()   { return 'base'; }

  /** @returns {string} Human-readable provider name, e.g. 'Xero' */
  get name() { return 'Base Provider'; }

  /**
   * Array of capability tokens this provider supports.
   * @returns {string[]}
   */
  get capabilities() { return []; }

  /** @returns {{ [key: string]: string }} Provider-specific OAuth/API limits and notes */
  get providerInfo() { return {}; }

  // ── Auth (may override) ───────────────────────────────────────

  /**
   * Authenticate with the provider.
   * For OAuth providers: trigger OAuth flow or exchange stored code.
   * For API key providers: validate the stored key.
   * @returns {Promise<boolean>} true if authenticated
   */
  async authenticate() { this._notImpl('authenticate'); }

  /** @returns {boolean} True if currently authenticated with a valid token. */
  isAuthenticated() { return false; }

  /** Revoke auth and clear stored tokens. */
  async disconnect() { this._notImpl('disconnect'); }

  // ── Contacts ──────────────────────────────────────────────────

  /**
   * Create a contact in the provider.
   * @param {import('../interfaces/contact.js').Contact} contact — validated Contact DTO
   * @returns {Promise<Contact>} contact with externalId populated
   */
  async createContact(contact)         { this._notImpl('createContact'); }
  async getContact(externalId)         { this._notImpl('getContact'); }
  async listContacts(filters = {})     { this._notImpl('listContacts'); }
  async updateContact(externalId, data){ this._notImpl('updateContact'); }
  async searchContacts(query)          { this._notImpl('searchContacts'); }

  // ── Invoices ──────────────────────────────────────────────────

  /**
   * @param {import('../interfaces/invoice.js').Invoice} invoice — validated Invoice DTO
   * @returns {Promise<Invoice>} invoice with externalId populated
   */
  async createInvoice(invoice)         { this._notImpl('createInvoice'); }
  async getInvoice(externalId)         { this._notImpl('getInvoice'); }
  async listInvoices(filters = {})     { this._notImpl('listInvoices'); }
  async updateInvoice(externalId, data){ this._notImpl('updateInvoice'); }
  async sendInvoice(externalId)        { this._notImpl('sendInvoice'); }
  async voidInvoice(externalId)        { this._notImpl('voidInvoice'); }

  // ── Quotes ────────────────────────────────────────────────────

  /**
   * @param {import('../interfaces/quote.js').Quote} quote — validated Quote DTO
   * @returns {Promise<Quote>} quote with externalId populated
   */
  async createQuote(quote)             { this._notImpl('createQuote'); }
  async getQuote(externalId)           { this._notImpl('getQuote'); }
  async listQuotes(filters = {})       { this._notImpl('listQuotes'); }
  async acceptQuote(externalId)        { this._notImpl('acceptQuote'); }
  async declineQuote(externalId)       { this._notImpl('declineQuote'); }

  // ── Projects ──────────────────────────────────────────────────

  /**
   * @param {import('../interfaces/project.js').Project} project — validated Project DTO
   * @returns {Promise<Project>} project with externalId populated
   */
  async createProject(project)          { this._notImpl('createProject'); }
  async getProject(externalId)          { this._notImpl('getProject'); }
  async listProjects(filters = {})      { this._notImpl('listProjects'); }
  async updateProject(externalId, data) { this._notImpl('updateProject'); }
  async closeProject(externalId)        { this._notImpl('closeProject'); }

  // ── Attachments ───────────────────────────────────────────────

  /**
   * Attach a document to an entity in the provider.
   * @param {string}                                          entityType  — 'invoice' | 'contact' | etc.
   * @param {string}                                          externalEntityId — provider's ID
   * @param {import('../interfaces/attachment.js').Attachment} attachment
   * @returns {Promise<Attachment>} with externalId populated
   */
  async attachDocument(entityType, externalEntityId, attachment) {
    this._notImpl('attachDocument');
  }
  async listAttachments(entityType, externalEntityId) {
    this._notImpl('listAttachments');
  }
  async deleteAttachment(entityType, externalEntityId, attachmentId) {
    this._notImpl('deleteAttachment');
  }

  // ── Protected helpers ─────────────────────────────────────────

  _notImpl(method) {
    throw new NotImplementedError(this.id, method);
  }

  /** Map a canonical Contact to the provider's shape. Override in each provider. */
  _toProviderContact(contact) { return contact; }

  /** Map the provider's contact shape to the canonical Contact DTO. Override in each provider. */
  _fromProviderContact(raw) { return raw; }

  _toProviderInvoice(invoice) { return invoice; }
  _fromProviderInvoice(raw)   { return raw; }

  _toProviderQuote(quote)   { return quote; }
  _fromProviderQuote(raw)   { return raw; }

  _toProviderProject(project) { return project; }
  _fromProviderProject(raw)   { return raw; }
}
