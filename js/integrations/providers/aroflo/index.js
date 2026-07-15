/**
 * AroFlo Provider — Stub
 *
 * Implements the BIK provider interface for AroFlo (AU field service management).
 * STUB — no live API calls. AF_IMPLEMENTATION_POINT marks each call.
 *
 * API Reference: https://developer.aroflo.com/
 * Auth:          API Key + encoded org string (no OAuth2)
 * Rate limits:   Not publicly documented — respect Retry-After on 429
 * Base URL:      https://api.aroflo.com
 *
 * AroFlo is a field service management platform popular with trade businesses.
 * Authentication is via API key encoded with the organisation string in the header.
 * Core entities: Clients (contacts), Quote Tasks, Work Orders (projects), Invoices.
 *
 * Auth header format:
 *   Authorization: AroFlo zone="{orgString}",key="{apiKey}"
 *   Or encode as: Authorization: Basic base64(orgString:apiKey)
 *
 * CAPABILITIES: contacts, invoices, quotes, projects
 */

import { BaseProvider }       from '../base-provider.js';
import { NotImplementedError } from '../../core/errors.js';
import { centsToAUD }         from '../../interfaces/invoice.js';

export const AROFLO_CONFIG_SCHEMA = {
  apiKey:    'string — AroFlo API key (from Settings → Integrations → API)',
  orgString: 'string — AroFlo organisation string (from API settings page)',
  zoneId:    'string — AroFlo zone/organisation ID'
};

export class AroFloProvider extends BaseProvider {

  get id()   { return 'aroflo'; }
  get name() { return 'AroFlo'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects'];
  }

  get providerInfo() {
    return {
      baseUrl:       'https://api.aroflo.com',
      dateFormat:    'YYYY-MM-DD',
      auth:          'API Key + org string encoded in Authorization header',
      gstType:       'Tax applied as percentage flag on line items (10% GST)',
      noteOnQuotes:  'AroFlo calls quotes "Quote Tasks" — linked to Work Orders',
      noteOnJobs:    'AroFlo calls projects "Work Orders"',
      noteOnClients: 'AroFlo has both Client records and Site records (locations)'
    };
  }

  isAuthenticated() {
    // AF_IMPLEMENTATION_POINT: return !!(this._config.apiKey && this._config.orgString)
    return false;
  }

  /**
   * AF_IMPLEMENTATION_POINT:
   *   No OAuth flow — API Key auth only.
   *   Validate by calling GET /clients/?pagesize=1 with Authorization header.
   *   Authorization: AroFlo zone="{orgString}",key="{apiKey}"
   */
  async authenticate() {
    throw new NotImplementedError('aroflo', 'authenticate');
  }

  // ── Contacts (AroFlo: "Clients") ──────────────────────────────

  /**
   * AF_IMPLEMENTATION_POINT:
   *   POST /clients/
   *   Body (XML or JSON depending on Accept header):
   *     { client: { name, abn, primaryphone, primaryemail,
   *                 billingaddress: { address, suburb, state, postcode, country } } }
   *   Note: AroFlo supports both XML and JSON — send Accept: application/json
   */
  async createContact(contact) {
    throw new NotImplementedError('aroflo', 'createContact');
  }

  async getContact(externalId) {
    // AF_IMPLEMENTATION_POINT: GET /clients/{id}/
    throw new NotImplementedError('aroflo', 'getContact');
  }

  async listContacts(filters = {}) {
    // AF_IMPLEMENTATION_POINT: GET /clients/?pagesize=50&page=1&search={q}
    throw new NotImplementedError('aroflo', 'listContacts');
  }

  // ── Invoices ──────────────────────────────────────────────────

  /**
   * AF_IMPLEMENTATION_POINT:
   *   POST /invoices/
   *   Body: { invoice: { workorderid, invoicedate, duedate,
   *                      invoicetasks: [ { description, quantity, unitprice, taxrate } ] } }
   *   Note: Invoices must be linked to a Work Order
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('aroflo', 'createInvoice');
  }

  async getInvoice(externalId) {
    // AF_IMPLEMENTATION_POINT: GET /invoices/{id}/
    throw new NotImplementedError('aroflo', 'getInvoice');
  }

  async sendInvoice(externalId) {
    // AF_IMPLEMENTATION_POINT: POST /invoices/{id}/send/
    // Body: { email: { to, subject, body } }
    throw new NotImplementedError('aroflo', 'sendInvoice');
  }

  // ── Quotes (AroFlo: "Quote Tasks" on a Work Order) ────────────

  /**
   * AF_IMPLEMENTATION_POINT:
   *   AroFlo quotes are "Quote Tasks" attached to a Work Order.
   *   Step 1: Create Work Order (POST /workorders/) with status "Quote"
   *   Step 2: POST /workorders/{id}/quotetasks/
   *   Body: { quotetask: { description, quantity, unitprice, taxrate } }
   */
  async createQuote(quote) {
    throw new NotImplementedError('aroflo', 'createQuote');
  }

  async getQuote(externalId) {
    // AF_IMPLEMENTATION_POINT: GET /workorders/{id}/ (returns the work order with quote tasks)
    throw new NotImplementedError('aroflo', 'getQuote');
  }

  // ── Projects (AroFlo: "Work Orders") ──────────────────────────

  /**
   * AF_IMPLEMENTATION_POINT:
   *   POST /workorders/
   *   Body: { workorder: { clientid, siteid, description, scheduleddate,
   *                        status: 'Quote'|'In Progress'|'Complete' } }
   *   Note: Must create a Client first, optionally a Site (job address)
   */
  async createProject(project) {
    throw new NotImplementedError('aroflo', 'createProject');
  }

  async getProject(externalId) {
    // AF_IMPLEMENTATION_POINT: GET /workorders/{id}/
    throw new NotImplementedError('aroflo', 'getProject');
  }

  // ── Translators ───────────────────────────────────────────────

  _toProviderContact(c) {
    return {
      name:         c.name,
      abn:          c.abn || undefined,
      primaryemail: c.email || undefined,
      primaryphone: c.phone || undefined,
      billingaddress: c.address ? {
        address:  c.address.line1    || '',
        suburb:   c.address.city     || '',
        state:    c.address.state    || '',
        postcode: c.address.postcode || '',
        country:  c.address.country  || 'Australia'
      } : undefined
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId: String(raw.id),
      providerId: 'aroflo',
      name:       raw.name,
      email:      raw.primaryemail || undefined,
      phone:      raw.primaryphone || undefined,
      abn:        raw.abn || undefined,
      type:       'customer'
    };
  }

  _toProviderInvoice(inv) {
    return {
      invoicedate:  inv.date,
      duedate:      inv.dueDate,
      invoicetasks: (inv.lineItems || []).map(li => ({
        description: li.description,
        quantity:    li.quantity,
        unitprice:   centsToAUD(li.unitPriceCents),
        taxrate:     li.taxType === 'GST' ? 10 : 0
      }))
    };
  }
}
