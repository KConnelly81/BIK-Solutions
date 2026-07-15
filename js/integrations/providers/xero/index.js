/**
 * Xero Provider — Stub
 *
 * Implements the BIK provider interface for Xero Accounting.
 * This is a STUB — no live API calls are made. All methods declare their
 * intended behaviour via JSDoc; the implementation is marked with
 * XERO_IMPLEMENTATION_POINT comments showing exactly what each call requires.
 *
 * API Reference: https://developer.xero.com/documentation/api/accounting/overview
 * Auth:          OAuth2 PKCE (xero-oauth2-pkce)
 * Scopes needed: accounting.contacts accounting.transactions accounting.attachments openid profile email
 * Rate limits:   60 calls/minute per access token; 5,000/day per organisation
 *
 * CAPABILITIES: contacts, invoices, quotes, projects, attachments
 */

import { BaseProvider }     from '../base-provider.js';
import { HttpClient }       from '../../core/http-client.js';
import { authManager }      from '../../core/auth-manager.js';
import { NotImplementedError } from '../../core/errors.js';
import { centsToAUD }       from '../../interfaces/invoice.js';

export const XERO_CONFIG_SCHEMA = {
  clientId:    'string — Xero OAuth2 app client ID',
  tenantId:    'string — Xero Tenant/Organisation ID (obtained after OAuth)',
  redirectUri: 'string — must match registered redirect URI in Xero Developer portal',
  scopes: [
    'openid', 'profile', 'email',
    'accounting.contacts',
    'accounting.transactions',
    'accounting.attachments',
    'projects'
  ]
};

export class XeroProvider extends BaseProvider {

  constructor(config = {}) {
    super(config);
    this._oauthCfg = {
      clientId:   config.clientId,
      authUrl:    'https://login.xero.com/identity/connect/authorize',
      tokenUrl:   'https://identity.xero.com/connect/token',
      redirectUri: config.redirectUri
    };
  }

  get id()   { return 'xero'; }
  get name() { return 'Xero'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects', 'attachments'];
  }

  get providerInfo() {
    return {
      rateLimits:  '60 calls/min, 5,000/day per org',
      dateFormat:  'ISO 8601 (YYYY-MM-DD)',
      currency:    'Stored in Xero org settings — must match AUD',
      gstAccount:  'Tax type "OUTPUT2" = GST on Income (10%)',
      invoiceType: 'ACCREC (Accounts Receivable)',
      noteOnCents: 'Xero API uses decimal amounts; provider maps from BIK cents'
    };
  }

  // ── Auth ────────────────────────────────────────────────────

  isAuthenticated() {
    // XERO_IMPLEMENTATION_POINT: Check token expiry via authManager.hasToken('xero')
    return false;
  }

  /**
   * Start the Xero OAuth2 PKCE flow.
   * XERO_IMPLEMENTATION_POINT:
   *   const { url, codeVerifier } = await authManager.buildAuthorizationUrl(this._oauthCfg);
   *   sessionStorage.setItem('xero_verifier', codeVerifier);
   *   window.location.href = url;
   */
  async authenticate() {
    throw new NotImplementedError('xero', 'authenticate');
  }

  /**
   * Handle OAuth callback and exchange code for tokens.
   * Call this from the OAuth redirect handler page.
   *
   * XERO_IMPLEMENTATION_POINT:
   *   const code     = new URLSearchParams(location.search).get('code');
   *   const verifier = sessionStorage.getItem('xero_verifier');
   *   await authManager.exchangeCode('xero', this._oauthCfg, code, verifier);
   *   // Then GET https://api.xero.com/connections to get tenantId and store it.
   */
  async handleOAuthCallback(code, codeVerifier) {
    throw new NotImplementedError('xero', 'handleOAuthCallback');
  }

  // ── Contacts ────────────────────────────────────────────────

  /**
   * XERO_IMPLEMENTATION_POINT:
   *   POST /Contacts
   *   Tenant-Id: {tenantId}
   *   Body: { Contacts: [ _toProviderContact(contact) ] }
   *   Returns: { Contacts: [ { ContactID, Name, ... } ] }
   *   Map response back via _fromProviderContact()
   */
  async createContact(contact) {
    throw new NotImplementedError('xero', 'createContact');
  }

  async getContact(externalId) {
    // XERO_IMPLEMENTATION_POINT: GET /Contacts/{ContactID}
    throw new NotImplementedError('xero', 'getContact');
  }

  async listContacts(filters = {}) {
    // XERO_IMPLEMENTATION_POINT: GET /Contacts?where=IsCustomer=true&page=1
    throw new NotImplementedError('xero', 'listContacts');
  }

  async searchContacts(query) {
    // XERO_IMPLEMENTATION_POINT: GET /Contacts?searchTerm={query}
    throw new NotImplementedError('xero', 'searchContacts');
  }

  // ── Invoices ────────────────────────────────────────────────

  /**
   * XERO_IMPLEMENTATION_POINT:
   *   POST /Invoices
   *   Body: { Invoices: [ _toProviderInvoice(invoice) ] }
   *
   *   Xero Invoice shape:
   *   {
   *     Type:       'ACCREC',
   *     Contact:    { ContactID: externalContactId },
   *     Date:       'YYYY-MM-DD',
   *     DueDate:    'YYYY-MM-DD',
   *     LineItems:  [ { Description, Quantity, UnitAmount, TaxType: 'OUTPUT2', AccountCode: '200' } ],
   *     Reference:  '...',
   *     Status:     'DRAFT'
   *   }
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('xero', 'createInvoice');
  }

  async getInvoice(externalId) {
    // XERO_IMPLEMENTATION_POINT: GET /Invoices/{InvoiceID}
    throw new NotImplementedError('xero', 'getInvoice');
  }

  async listInvoices(filters = {}) {
    // XERO_IMPLEMENTATION_POINT: GET /Invoices?Statuses=DRAFT,SUBMITTED&page=1
    throw new NotImplementedError('xero', 'listInvoices');
  }

  async sendInvoice(externalId) {
    // XERO_IMPLEMENTATION_POINT: POST /Invoices/{InvoiceID}/Email
    throw new NotImplementedError('xero', 'sendInvoice');
  }

  // ── Quotes ──────────────────────────────────────────────────

  /**
   * XERO_IMPLEMENTATION_POINT:
   *   POST /Quotes
   *   Body: { Quotes: [ { Contact, Date, LineItems, Status: 'DRAFT', ... } ] }
   */
  async createQuote(quote) {
    throw new NotImplementedError('xero', 'createQuote');
  }

  async getQuote(externalId) {
    // XERO_IMPLEMENTATION_POINT: GET /Quotes/{QuoteID}
    throw new NotImplementedError('xero', 'getQuote');
  }

  // ── Projects (Xero Projects API) ────────────────────────────

  /**
   * XERO_IMPLEMENTATION_POINT:
   *   POST https://api.xero.com/projects.xro/2.0/Projects
   *   Body: { contactId, name, deadlineUtc, estimateAmount }
   *   Note: Xero Projects is a separate API (not accounting.xro)
   */
  async createProject(project) {
    throw new NotImplementedError('xero', 'createProject');
  }

  async getProject(externalId) {
    // XERO_IMPLEMENTATION_POINT: GET /projects.xro/2.0/Projects/{projectId}
    throw new NotImplementedError('xero', 'getProject');
  }

  // ── Attachments ─────────────────────────────────────────────

  /**
   * XERO_IMPLEMENTATION_POINT:
   *   POST /Invoices/{InvoiceID}/Attachments/{filename}
   *   Content-Type: {mimeType}
   *   Body: binary file content
   *   Note: multipart not used — Xero accepts raw binary stream
   */
  async attachDocument(entityType, externalEntityId, attachment) {
    throw new NotImplementedError('xero', 'attachDocument');
  }

  async listAttachments(entityType, externalEntityId) {
    // XERO_IMPLEMENTATION_POINT: GET /Invoices/{ID}/Attachments
    throw new NotImplementedError('xero', 'listAttachments');
  }

  // ── Translators ──────────────────────────────────────────────

  _toProviderContact(c) {
    return {
      Name:            c.name,
      EmailAddress:    c.email   || undefined,
      Phones:          c.phone   ? [{ PhoneType: 'DEFAULT', PhoneNumber: c.phone }] : [],
      TaxNumber:       c.abn     || undefined,
      IsCustomer:      c.type === 'customer' || c.type === 'both',
      IsSupplier:      c.type === 'supplier' || c.type === 'both',
      Addresses:       c.address ? [{
        AddressType:  'POBOX',
        AddressLine1: c.address.line1 || '',
        City:         c.address.city  || '',
        Region:       c.address.state || '',
        PostalCode:   c.address.postcode || '',
        Country:      c.address.country || 'AU'
      }] : []
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId:  raw.ContactID,
      providerId:  'xero',
      name:        raw.Name,
      email:       raw.EmailAddress || undefined,
      phone:       raw.Phones?.[0]?.PhoneNumber || undefined,
      abn:         raw.TaxNumber || undefined,
      type:        raw.IsCustomer && raw.IsSupplier ? 'both'
                 : raw.IsCustomer ? 'customer' : 'supplier',
      isActive:    raw.ContactStatus === 'ACTIVE'
    };
  }

  _toProviderInvoice(inv) {
    return {
      Type:      'ACCREC',
      Contact:   { ContactID: inv.externalContactId },
      Date:      inv.date,
      DueDate:   inv.dueDate,
      Reference: inv.reference || undefined,
      Status:    inv.status === 'sent' ? 'SUBMITTED' : 'DRAFT',
      LineItems: (inv.lineItems || []).map(li => ({
        Description: li.description,
        Quantity:    li.quantity,
        UnitAmount:  centsToAUD(li.unitPriceCents),
        TaxType:     li.taxType === 'GST' ? 'OUTPUT2' : 'NONE',
        AccountCode: li.accountCode || '200'
      })),
      LineAmountTypes: 'EXCLUSIVE'
    };
  }

  _fromProviderInvoice(raw) {
    return {
      externalId:  raw.InvoiceID,
      providerId:  'xero',
      reference:   raw.Reference || undefined,
      status:      ({
        DRAFT:     'draft',
        SUBMITTED: 'sent',
        AUTHORISED:'approved',
        PAID:      'paid',
        VOIDED:    'void'
      })[raw.Status] || 'draft'
    };
  }
}
