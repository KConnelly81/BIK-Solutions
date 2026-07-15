/**
 * MYOB Provider — Stub
 *
 * Implements the BIK provider interface for MYOB AccountRight / Business.
 * STUB — no live API calls. MYOB_IMPLEMENTATION_POINT comments show required calls.
 *
 * API Reference: https://developer.myob.com/api/myob-business-api/
 * Auth:          OAuth2 (MYOB's own identity server)
 * Rate limits:   No published limit — respect Retry-After on 429
 *
 * MYOB has two products:
 *   AccountRight — Desktop/cloud hybrid, REST API at api.myob.com
 *   Business     — Cloud-only, REST API at aapi.myob.com (newer)
 * This stub targets AccountRight (most common with builders).
 *
 * CAPABILITIES: contacts, invoices, quotes, projects
 */

import { BaseProvider }       from '../base-provider.js';
import { NotImplementedError } from '../../core/errors.js';

export const MYOB_CONFIG_SCHEMA = {
  clientId:     'string — MYOB Developer app client ID',
  clientSecret: 'string — MYOB Developer app client secret',
  redirectUri:  'string — must match registered redirect URI',
  companyFileId:'string — MYOB Company File GUID (obtained after auth)',
  companyFileUser:     'string — Company file username',
  companyFilePassword: 'string — Company file password'
};

export class MYOBProvider extends BaseProvider {

  get id()   { return 'myob'; }
  get name() { return 'MYOB'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects'];
  }

  get providerInfo() {
    return {
      baseUrl:     'https://api.myob.com/accountright/{CompanyFileId}',
      dateFormat:  'YYYY-MM-DDThh:mm:ss (ISO 8601)',
      gstType:     'GST tax code maps to MYOB TaxCode UID',
      noteOnAuth:  'MYOB requires both OAuth2 token AND Company File credentials on every request'
    };
  }

  // ── Auth ──────────────────────────────────────────────────────

  isAuthenticated() { return false; }

  /**
   * MYOB_IMPLEMENTATION_POINT:
   *   OAuth2 PKCE flow to https://secure.myob.com/oauth2/account/authorize
   *   After callback: exchange code, then GET /accountright to list company files.
   *   User selects their company file; store companyFileId in config.
   */
  async authenticate() {
    throw new NotImplementedError('myob', 'authenticate');
  }

  // ── Contacts ──────────────────────────────────────────────────

  /**
   * MYOB_IMPLEMENTATION_POINT:
   *   POST /accountright/{cfid}/Contact/Customer
   *   Headers: x-myobapi-key, x-myobapi-cftoken (base64 user:pass)
   *   Body: { CompanyName, FirstName, LastName, IsIndividual, Addresses, EmailAddress, ... }
   */
  async createContact(contact) {
    throw new NotImplementedError('myob', 'createContact');
  }

  async getContact(externalId) {
    // MYOB_IMPLEMENTATION_POINT: GET /Contact/Customer/{UID}
    throw new NotImplementedError('myob', 'getContact');
  }

  async listContacts(filters = {}) {
    // MYOB_IMPLEMENTATION_POINT: GET /Contact/Customer?$filter=IsActive eq true
    throw new NotImplementedError('myob', 'listContacts');
  }

  // ── Invoices ──────────────────────────────────────────────────

  /**
   * MYOB_IMPLEMENTATION_POINT:
   *   POST /Sale/Invoice/Service (for service-based builders)
   *   or   /Sale/Invoice/Professional
   *   Body: { Customer: { UID }, Date, Lines: [ { Description, UnitCount, UnitPrice, TaxCode } ] }
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('myob', 'createInvoice');
  }

  async getInvoice(externalId) {
    // MYOB_IMPLEMENTATION_POINT: GET /Sale/Invoice/Service/{UID}
    throw new NotImplementedError('myob', 'getInvoice');
  }

  async sendInvoice(externalId) {
    // MYOB_IMPLEMENTATION_POINT: POST /Sale/Invoice/Service/{UID}/Email
    throw new NotImplementedError('myob', 'sendInvoice');
  }

  // ── Quotes ────────────────────────────────────────────────────

  /**
   * MYOB_IMPLEMENTATION_POINT:
   *   POST /Sale/Quote/Service
   *   Same shape as Invoice but Quote endpoint
   */
  async createQuote(quote) {
    throw new NotImplementedError('myob', 'createQuote');
  }

  async getQuote(externalId) {
    throw new NotImplementedError('myob', 'getQuote');
  }

  // ── Projects ──────────────────────────────────────────────────

  /**
   * MYOB_IMPLEMENTATION_POINT:
   *   POST /GeneralLedger/Job (MYOB calls Projects "Jobs")
   *   Body: { JobNumber, Name, IsActive, Description }
   */
  async createProject(project) {
    throw new NotImplementedError('myob', 'createProject');
  }

  async getProject(externalId) {
    // MYOB_IMPLEMENTATION_POINT: GET /GeneralLedger/Job/{UID}
    throw new NotImplementedError('myob', 'getProject');
  }

  // ── Translators ───────────────────────────────────────────────

  _toProviderContact(c) {
    return {
      CompanyName:  c.name,
      IsIndividual: !!(c.firstName || c.lastName),
      FirstName:    c.firstName || '',
      LastName:     c.lastName  || '',
      EmailAddress: c.email     || undefined,
      ABN:          c.abn       || undefined,
      Addresses:    c.address ? [{
        Street:   c.address.line1 || '',
        City:     c.address.city  || '',
        State:    c.address.state || '',
        PostCode: c.address.postcode || '',
        Country:  c.address.country || 'Australia'
      }] : []
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId: raw.UID,
      providerId: 'myob',
      name:       raw.CompanyName || `${raw.FirstName} ${raw.LastName}`.trim(),
      email:      raw.EmailAddress || undefined,
      abn:        raw.ABN || undefined,
      type:       'customer'
    };
  }
}
