/**
 * Buildxact Provider — Stub
 *
 * Implements the BIK provider interface for Buildxact (AU/NZ construction estimating).
 * STUB — no live API calls. BX_IMPLEMENTATION_POINT marks each call.
 *
 * API Reference: https://developer.buildxact.com/
 * Auth:          API Key (passed as X-API-Key header) OR OAuth2 (contact Buildxact)
 * Rate limits:   Not publicly documented — respect Retry-After on 429
 * Base URL:      https://app.buildxact.com/api/v2
 *
 * Buildxact is focused on residential/light commercial builders.
 * Core entities: Clients (contacts), Estimates (quotes), Jobs (projects), Invoices.
 *
 * CAPABILITIES: contacts, invoices, quotes, projects
 */

import { BaseProvider }       from '../base-provider.js';
import { NotImplementedError } from '../../core/errors.js';
import { centsToAUD }         from '../../interfaces/invoice.js';

export const BX_CONFIG_SCHEMA = {
  apiKey:      'string — Buildxact API key (from Settings → Integrations)',
  baseUrl:     'string — override default base URL (optional)',
  tenantSlug:  'string — your Buildxact account slug (subdomain)'
};

export class BuildxactProvider extends BaseProvider {

  constructor(config = {}) {
    super(config);
    this._baseUrl = config.baseUrl || 'https://app.buildxact.com/api/v2';
  }

  get id()   { return 'buildxact'; }
  get name() { return 'Buildxact'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects'];
  }

  get providerInfo() {
    return {
      baseUrl:      this._baseUrl,
      dateFormat:   'YYYY-MM-DD',
      auth:         'API Key via X-API-Key header',
      gstType:      'Tax rate applied as percentage on line items',
      noteOnQuotes: 'Buildxact calls quotes "Estimates"',
      noteOnJobs:   'Buildxact calls projects "Jobs"'
    };
  }

  isAuthenticated() {
    // BX_IMPLEMENTATION_POINT: return !!this._config.apiKey
    return false;
  }

  /**
   * BX_IMPLEMENTATION_POINT:
   *   API Key auth — no OAuth flow required.
   *   Validate by calling GET /clients?limit=1 with X-API-Key header.
   *   Throw AuthenticationError if 401.
   */
  async authenticate() {
    throw new NotImplementedError('buildxact', 'authenticate');
  }

  // ── Contacts (Buildxact: "Clients") ───────────────────────────

  /**
   * BX_IMPLEMENTATION_POINT:
   *   POST /clients
   *   Headers: X-API-Key: {apiKey}
   *   Body: { firstName, lastName, company, email, phone, address: { line1, suburb, state, postcode } }
   */
  async createContact(contact) {
    throw new NotImplementedError('buildxact', 'createContact');
  }

  async getContact(externalId) {
    // BX_IMPLEMENTATION_POINT: GET /clients/{id}
    throw new NotImplementedError('buildxact', 'getContact');
  }

  async listContacts(filters = {}) {
    // BX_IMPLEMENTATION_POINT: GET /clients?search={q}&limit=50&offset=0
    throw new NotImplementedError('buildxact', 'listContacts');
  }

  // ── Invoices ──────────────────────────────────────────────────

  /**
   * BX_IMPLEMENTATION_POINT:
   *   POST /invoices
   *   Body: { jobId, clientId, issueDate, dueDate,
   *           lineItems: [ { description, quantity, unitPrice, taxRate } ] }
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('buildxact', 'createInvoice');
  }

  async getInvoice(externalId) {
    // BX_IMPLEMENTATION_POINT: GET /invoices/{id}
    throw new NotImplementedError('buildxact', 'getInvoice');
  }

  async sendInvoice(externalId) {
    // BX_IMPLEMENTATION_POINT: POST /invoices/{id}/send
    throw new NotImplementedError('buildxact', 'sendInvoice');
  }

  // ── Quotes (Buildxact: "Estimates") ───────────────────────────

  /**
   * BX_IMPLEMENTATION_POINT:
   *   POST /estimates
   *   Body: { clientId, name, date, expiryDate,
   *           sections: [ { name, items: [ { description, qty, unitCost, margin } ] } ] }
   */
  async createQuote(quote) {
    throw new NotImplementedError('buildxact', 'createQuote');
  }

  async getQuote(externalId) {
    // BX_IMPLEMENTATION_POINT: GET /estimates/{id}
    throw new NotImplementedError('buildxact', 'getQuote');
  }

  // ── Projects (Buildxact: "Jobs") ──────────────────────────────

  /**
   * BX_IMPLEMENTATION_POINT:
   *   POST /jobs
   *   Body: { clientId, name, description, startDate, estimatedEndDate, estimateId }
   *   Note: Jobs are often converted from an accepted Estimate
   */
  async createProject(project) {
    throw new NotImplementedError('buildxact', 'createProject');
  }

  async getProject(externalId) {
    // BX_IMPLEMENTATION_POINT: GET /jobs/{id}
    throw new NotImplementedError('buildxact', 'getProject');
  }

  // ── Translators ───────────────────────────────────────────────

  _toProviderContact(c) {
    const nameParts = (c.name || '').split(' ');
    return {
      firstName: c.firstName || nameParts[0] || '',
      lastName:  c.lastName  || nameParts.slice(1).join(' ') || '',
      company:   c.name || undefined,
      email:     c.email || undefined,
      phone:     c.phone || undefined,
      address:   c.address ? {
        line1:    c.address.line1    || '',
        suburb:   c.address.city     || '',
        state:    c.address.state    || '',
        postcode: c.address.postcode || '',
        country:  c.address.country  || 'AU'
      } : undefined
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId: String(raw.id),
      providerId: 'buildxact',
      name:       raw.company || `${raw.firstName} ${raw.lastName}`.trim(),
      email:      raw.email || undefined,
      phone:      raw.phone || undefined,
      type:       'customer'
    };
  }

  _toProviderInvoice(inv) {
    return {
      clientId:  inv.externalContactId,
      issueDate: inv.date,
      dueDate:   inv.dueDate,
      lineItems: (inv.lineItems || []).map(li => ({
        description: li.description,
        quantity:    li.quantity,
        unitPrice:   centsToAUD(li.unitPriceCents),
        taxRate:     li.taxType === 'GST' ? 10 : 0
      }))
    };
  }
}
