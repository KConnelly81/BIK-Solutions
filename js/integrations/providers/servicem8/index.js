/**
 * ServiceM8 Provider — Stub
 *
 * Implements the BIK provider interface for ServiceM8 (AU field service management).
 * STUB — no live API calls. SM8_IMPLEMENTATION_POINT marks each call.
 *
 * API Reference: https://developer.servicem8.com/docs
 * Auth:          OAuth2 (ServiceM8 OAuth2 server) or API Key
 * Scopes:        read_customers write_customers read_jobs write_jobs read_financial write_financial
 * Rate limits:   120 requests/min
 * Base URL:      https://api.servicem8.com/api_1.0
 *
 * ServiceM8 is a job management / field service platform popular with trade businesses.
 * Core entities: Companies (contacts), Quotes, Jobs (projects), Invoices.
 * Note: ServiceM8 uses UUID strings for all IDs.
 *
 * CAPABILITIES: contacts, invoices, quotes, projects
 */

import { BaseProvider }       from '../base-provider.js';
import { NotImplementedError } from '../../core/errors.js';
import { centsToAUD }         from '../../interfaces/invoice.js';

export const SM8_CONFIG_SCHEMA = {
  clientId:     'string — ServiceM8 OAuth2 app client ID',
  clientSecret: 'string — ServiceM8 OAuth2 app client secret',
  redirectUri:  'string — must match registered redirect URI',
  apiKey:       'string — alternative to OAuth2 (Basic auth with API key as password)'
};

export class ServiceM8Provider extends BaseProvider {

  get id()   { return 'servicem8'; }
  get name() { return 'ServiceM8'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects'];
  }

  get providerInfo() {
    return {
      baseUrl:      'https://api.servicem8.com/api_1.0',
      dateFormat:   'YYYY-MM-DD HH:MM:SS (MySQL datetime)',
      gstType:      'Invoice line "unit_price" is ex-GST; "include_tax" flag adds 10%',
      idFormat:     'UUID strings throughout',
      noteOnJobs:   'ServiceM8 calls projects "Jobs"',
      noteOnAuth:   'API Key auth: Basic auth with email as username, API key as password'
    };
  }

  isAuthenticated() { return false; }

  /**
   * SM8_IMPLEMENTATION_POINT:
   *   OAuth2 PKCE to https://go.servicem8.com/oauth/authorize
   *   Scopes: read_customers write_customers read_jobs write_jobs read_financial write_financial
   *   OR: store API key in config and use Basic auth (simpler for single-company use)
   */
  async authenticate() {
    throw new NotImplementedError('servicem8', 'authenticate');
  }

  // ── Contacts (ServiceM8: "Companies") ─────────────────────────

  /**
   * SM8_IMPLEMENTATION_POINT:
   *   POST /company.json
   *   Body: { name, address, city, state, post_code, country, email, phone }
   *   Note: ServiceM8 uses "company" for all contacts (individuals have a company record too)
   */
  async createContact(contact) {
    throw new NotImplementedError('servicem8', 'createContact');
  }

  async getContact(externalId) {
    // SM8_IMPLEMENTATION_POINT: GET /company/{uuid}.json
    throw new NotImplementedError('servicem8', 'getContact');
  }

  async listContacts(filters = {}) {
    // SM8_IMPLEMENTATION_POINT: GET /company.json?%24filter=active%20eq%201
    throw new NotImplementedError('servicem8', 'listContacts');
  }

  // ── Invoices ──────────────────────────────────────────────────

  /**
   * SM8_IMPLEMENTATION_POINT:
   *   POST /invoice.json
   *   Body: { job_uuid, date, due_date, invoice_number }
   *   Then POST /invoicelineitems.json for each line item:
   *     { invoice_uuid, description, quantity, unit_price, include_tax: 1 }
   *   Note: ServiceM8 invoices must be linked to a Job
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('servicem8', 'createInvoice');
  }

  async getInvoice(externalId) {
    // SM8_IMPLEMENTATION_POINT: GET /invoice/{uuid}.json
    throw new NotImplementedError('servicem8', 'getInvoice');
  }

  async sendInvoice(externalId) {
    // SM8_IMPLEMENTATION_POINT: POST /invoice/{uuid}/email.json
    // Body: { to_email, subject, body }
    throw new NotImplementedError('servicem8', 'sendInvoice');
  }

  // ── Quotes ────────────────────────────────────────────────────

  /**
   * SM8_IMPLEMENTATION_POINT:
   *   POST /quote.json
   *   Body: { job_uuid, date, expiry_date }
   *   Then POST /quotelineitems.json for each line item
   *   Note: Quotes must be linked to a Job
   */
  async createQuote(quote) {
    throw new NotImplementedError('servicem8', 'createQuote');
  }

  async getQuote(externalId) {
    // SM8_IMPLEMENTATION_POINT: GET /quote/{uuid}.json
    throw new NotImplementedError('servicem8', 'getQuote');
  }

  // ── Projects (ServiceM8: "Jobs") ──────────────────────────────

  /**
   * SM8_IMPLEMENTATION_POINT:
   *   POST /job.json
   *   Body: { company_uuid, status: 'Quote'|'Work Order'|'Completed',
   *           job_address, job_city, job_state, job_postcode,
   *           job_description, date }
   *   Note: Must create the Job first before attaching quotes/invoices
   */
  async createProject(project) {
    throw new NotImplementedError('servicem8', 'createProject');
  }

  async getProject(externalId) {
    // SM8_IMPLEMENTATION_POINT: GET /job/{uuid}.json
    throw new NotImplementedError('servicem8', 'getProject');
  }

  // ── Translators ───────────────────────────────────────────────

  _toProviderContact(c) {
    return {
      name:      c.name,
      address:   c.address?.line1 || '',
      city:      c.address?.city  || '',
      state:     c.address?.state || '',
      post_code: c.address?.postcode || '',
      country:   c.address?.country || 'Australia',
      email:     c.email || '',
      phone:     c.phone || ''
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId: raw.uuid,
      providerId: 'servicem8',
      name:       raw.name,
      email:      raw.email || undefined,
      phone:      raw.phone || undefined,
      type:       'customer'
    };
  }

  _toProviderInvoice(inv) {
    return {
      date:     inv.date,
      due_date: inv.dueDate,
      lineItems: (inv.lineItems || []).map(li => ({
        description:  li.description,
        quantity:     li.quantity,
        unit_price:   centsToAUD(li.unitPriceCents),
        include_tax:  li.taxType === 'GST' ? 1 : 0
      }))
    };
  }
}
