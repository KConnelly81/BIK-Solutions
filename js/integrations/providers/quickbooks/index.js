/**
 * QuickBooks Provider — Stub
 *
 * Implements the BIK provider interface for QuickBooks Online (Australia).
 * STUB — no live API calls. QB_IMPLEMENTATION_POINT marks each call.
 *
 * API Reference: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
 * Auth:          OAuth2 (Intuit's identity platform)
 * Scopes:        com.intuit.quickbooks.accounting
 * Rate limits:   500 requests/min per app, 500/day per realm
 * Base URL:      https://quickbooks.api.intuit.com/v3/company/{realmId}
 *
 * Note: QuickBooks uses "realmId" (equivalent to tenantId/companyId).
 *
 * CAPABILITIES: contacts, invoices, quotes, projects
 */

import { BaseProvider }       from '../base-provider.js';
import { NotImplementedError } from '../../core/errors.js';
import { centsToAUD }         from '../../interfaces/invoice.js';

export const QB_CONFIG_SCHEMA = {
  clientId:     'string — Intuit Developer app client ID',
  clientSecret: 'string — Intuit Developer app client secret',
  redirectUri:  'string — must match Intuit Developer portal',
  realmId:      'string — QuickBooks company/realm ID (from OAuth callback)',
  environment:  '"sandbox" | "production" — default "production"'
};

export class QuickBooksProvider extends BaseProvider {

  get id()   { return 'quickbooks'; }
  get name() { return 'QuickBooks'; }

  get capabilities() {
    return ['contacts', 'invoices', 'quotes', 'projects'];
  }

  get providerInfo() {
    return {
      baseUrl:    'https://quickbooks.api.intuit.com/v3/company/{realmId}',
      dateFormat: 'YYYY-MM-DD',
      gstType:    'TAX code references QuickBooks Tax Code ID (GST = "TAX001" in AU)',
      noteOnName: 'QuickBooks calls Contacts "Customers". Individual fields: GivenName, FamilyName, CompanyName'
    };
  }

  isAuthenticated() { return false; }

  /**
   * QB_IMPLEMENTATION_POINT:
   *   OAuth2 PKCE to https://appcenter.intuit.com/connect/oauth2
   *   Callback extracts realmId from ?realmId= query param.
   */
  async authenticate() {
    throw new NotImplementedError('quickbooks', 'authenticate');
  }

  /**
   * QB_IMPLEMENTATION_POINT:
   *   POST /customer
   *   Body: { DisplayName, PrimaryEmailAddr, PrimaryPhone, GivenName, FamilyName,
   *           CompanyName, BillAddr, TaxIdentifier (ABN) }
   */
  async createContact(contact) {
    throw new NotImplementedError('quickbooks', 'createContact');
  }

  async getContact(externalId) {
    // QB_IMPLEMENTATION_POINT: GET /customer/{id}
    throw new NotImplementedError('quickbooks', 'getContact');
  }

  async listContacts(filters = {}) {
    // QB_IMPLEMENTATION_POINT: GET /query?query=select * from Customer
    throw new NotImplementedError('quickbooks', 'listContacts');
  }

  /**
   * QB_IMPLEMENTATION_POINT:
   *   POST /invoice
   *   Body: { CustomerRef: { value: id }, TxnDate, DueDate,
   *           Line: [ { DetailType: 'SalesItemLineDetail', ... } ] }
   */
  async createInvoice(invoice) {
    throw new NotImplementedError('quickbooks', 'createInvoice');
  }

  async getInvoice(externalId) {
    // QB_IMPLEMENTATION_POINT: GET /invoice/{id}
    throw new NotImplementedError('quickbooks', 'getInvoice');
  }

  async sendInvoice(externalId) {
    // QB_IMPLEMENTATION_POINT: POST /invoice/{id}/send?sendTo={email}
    throw new NotImplementedError('quickbooks', 'sendInvoice');
  }

  /**
   * QB_IMPLEMENTATION_POINT:
   *   POST /estimate (QuickBooks calls quotes "Estimates")
   */
  async createQuote(quote) {
    throw new NotImplementedError('quickbooks', 'createQuote');
  }

  async getQuote(externalId) {
    // QB_IMPLEMENTATION_POINT: GET /estimate/{id}
    throw new NotImplementedError('quickbooks', 'getQuote');
  }

  /**
   * QB_IMPLEMENTATION_POINT:
   *   POST /project (QuickBooks Online has Projects feature on Plus/Advanced)
   *   Body: { ProjectName, CustomerRef, Description }
   */
  async createProject(project) {
    throw new NotImplementedError('quickbooks', 'createProject');
  }

  async getProject(externalId) {
    throw new NotImplementedError('quickbooks', 'getProject');
  }

  _toProviderContact(c) {
    return {
      DisplayName:       c.name,
      CompanyName:       c.name,
      GivenName:         c.firstName || undefined,
      FamilyName:        c.lastName  || undefined,
      PrimaryEmailAddr:  c.email ? { Address: c.email } : undefined,
      PrimaryPhone:      c.phone ? { FreeFormNumber: c.phone } : undefined,
      TaxIdentifier:     c.abn || undefined
    };
  }

  _fromProviderContact(raw) {
    return {
      externalId:  raw.Id,
      providerId:  'quickbooks',
      name:        raw.DisplayName || raw.CompanyName,
      email:       raw.PrimaryEmailAddr?.Address || undefined,
      phone:       raw.PrimaryPhone?.FreeFormNumber || undefined,
      type:        'customer'
    };
  }
}
