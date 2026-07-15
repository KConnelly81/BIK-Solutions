/**
 * SimPRO Provider — Stub
 *
 * Implements the BIK provider interface for SimPRO (AU field service/project management).
 * STUB — no live API calls. SIMPRO_IMPLEMENTATION_POINT marks each call.
 *
 * API Reference: https://developer.simprogroup.com/apidoc/
 * Auth:          OAuth2 (SimPRO Connect identity server)
 * Scopes:        Defined per-resource (e.g. read:customers, write:jobs)
 * Rate limits:   600 requests/min per access token
 * Base URL:      https://{company}.simprocloud.com/api/v1.0
 *
 * SimPRO is an enterprise field service and project management platform.
 * It is popular with electrical, plumbing, HVAC and other trade businesses.
 * Core entities: Companies/Contacts, Quotes, Jobs, Invoices.
 * Note: SimPRO distinguishes between "Service Jobs" and "Project Jobs".
 *
 * CAPABILITIES: contacts, invoices, quotes, projects
 */

import { BaseProvider }       from '../base-provider.js';
import { NotImplementedError } from '../../core/errors.js';
import { centsToAUD }         from '../../interfaces/invoice.js';

export const SIMPRO_CONFIG_SCHEMA = {
  clientId:      'string — SimPRO OAuth2 app client ID',
  clientSecret:  'string — SimPRO OAuth2 app client secret',
  redirectUri:   'string — must match registered redirect URI',
  companySlug:   'string — SimPRO company subdomain (from your SimPRO URL)',
  companyId:     'string — SimPRO company ID (numeric, obtained after auth)'
};

export class SimPROProvider extends BaseProvider {

  constructor(config = {}) {
    super(config);
    this._baseUrl = config.companySlug
      ? `https://${config.companySlug}.simprocloud.com/api/v1.0`
      : 'https://{company}.simprocloud.com/api/v1.0';
  }

  get id()   { return 'simpro'; }
  get name() { return 'SimPRO'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects'];
  }

  get providerInfo() {
    return {
      baseUrl:        this._baseUrl,
      dateFormat:     'YYYY-MM-DD',
      gstType:        'Tax group applied per line item via TaxCode reference',
      idFormat:       'Numeric integers',
      noteOnCompany:  'SimPRO URL is {company}.simprocloud.com — companySlug required in config',
      noteOnProjects: 'SimPRO has both "Service Jobs" (single visit) and "Project Jobs" (multi-stage)'
    };
  }

  isAuthenticated() { return false; }

  /**
   * SIMPRO_IMPLEMENTATION_POINT:
   *   OAuth2 PKCE to https://{company}.simprocloud.com/oauth2/authorize
   *   Scopes: read:customers write:customers read:jobs write:jobs read:invoices write:invoices
   *   After callback: exchange code, GET /company/ to retrieve companyId.
   */
  async authenticate() {
    throw new NotImplementedError('simpro', 'authenticate');
  }

  // ── Contacts ──────────────────────────────────────────────────

  /**
   * SIMPRO_IMPLEMENTATION_POINT:
   *   POST /company/{companyId}/customers/companies/
   *   Body: { Name, Abn, Phone, Email, Address: { Line1, City, State, Postcode, Country } }
   *   For individual contacts (not companies):
   *   POST /company/{companyId}/customers/individuals/
   *   Body: { GivenName, FamilyName, Email, Phone }
   */
  async createContact(contact) {
    throw new NotImplementedError('simpro', 'createContact');
  }

  async getContact(externalId) {
    // SIMPRO_IMPLEMENTATION_POINT: GET /company/{companyId}/customers/companies/{id}/
    throw new NotImplementedError('simpro', 'getContact');
  }

  async listContacts(filters = {}) {
    // SIMPRO_IMPLEMENTATION_POINT: GET /company/{companyId}/customers/companies/?pageSize=50&page=1
    throw new NotImplementedError('simpro', 'listContacts');
  }

  // ── Invoices ──────────────────────────────────────────────────

  /**
   * SIMPRO_IMPLEMENTATION_POINT:
   *   POST /company/{companyId}/invoices/
   *   Body: { Customer: { ID }, OrderNo, InvoiceDate, DueDate,
   *           Sections: [ { LineItems: [ { Name, Quantity, UnitPrice, TaxCode: { ID } } ] } ] }
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('simpro', 'createInvoice');
  }

  async getInvoice(externalId) {
    // SIMPRO_IMPLEMENTATION_POINT: GET /company/{companyId}/invoices/{id}/
    throw new NotImplementedError('simpro', 'getInvoice');
  }

  async sendInvoice(externalId) {
    // SIMPRO_IMPLEMENTATION_POINT: POST /company/{companyId}/invoices/{id}/email/
    throw new NotImplementedError('simpro', 'sendInvoice');
  }

  // ── Quotes ────────────────────────────────────────────────────

  /**
   * SIMPRO_IMPLEMENTATION_POINT:
   *   POST /company/{companyId}/quotes/
   *   Body: { Customer: { ID }, Name, DateIssued, ExpiryDate, Notes,
   *           Sections: [ { Name, LineItems: [ { Name, Quantity, UnitSell, TaxCode: { ID } } ] } ] }
   */
  async createQuote(quote) {
    throw new NotImplementedError('simpro', 'createQuote');
  }

  async getQuote(externalId) {
    // SIMPRO_IMPLEMENTATION_POINT: GET /company/{companyId}/quotes/{id}/
    throw new NotImplementedError('simpro', 'getQuote');
  }

  // ── Projects (SimPRO: "Jobs") ──────────────────────────────────

  /**
   * SIMPRO_IMPLEMENTATION_POINT:
   *   POST /company/{companyId}/jobs/
   *   Body: { Type: 'Project'|'Service', Customer: { ID }, Name, Description,
   *           DateIssued, Stage: { ID } }
   *   Note: Stages must be fetched first via GET /company/{companyId}/stages/
   */
  async createProject(project) {
    throw new NotImplementedError('simpro', 'createProject');
  }

  async getProject(externalId) {
    // SIMPRO_IMPLEMENTATION_POINT: GET /company/{companyId}/jobs/{id}/
    throw new NotImplementedError('simpro', 'getProject');
  }

  // ── Translators ───────────────────────────────────────────────

  _toProviderContact(c) {
    return {
      Name:  c.name,
      Abn:   c.abn || undefined,
      Email: c.email || undefined,
      Phone: c.phone || undefined,
      Address: c.address ? {
        Line1:    c.address.line1    || '',
        City:     c.address.city     || '',
        State:    c.address.state    || '',
        Postcode: c.address.postcode || '',
        Country:  c.address.country  || 'Australia'
      } : undefined
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId: String(raw.ID),
      providerId: 'simpro',
      name:       raw.Name,
      email:      raw.Email || undefined,
      phone:      raw.Phone || undefined,
      abn:        raw.Abn   || undefined,
      type:       'customer'
    };
  }

  _toProviderInvoice(inv) {
    return {
      InvoiceDate: inv.date,
      DueDate:     inv.dueDate,
      Sections: [{
        LineItems: (inv.lineItems || []).map(li => ({
          Name:      li.description,
          Quantity:  li.quantity,
          UnitPrice: centsToAUD(li.unitPriceCents)
        }))
      }]
    };
  }
}
