/**
 * Invoice Service
 *
 * Business-level API for invoice operations. Delegates to the active provider.
 */

import { registry }          from '../core/provider-registry.js';
import { validateInvoice }   from '../interfaces/invoice.js';
import { createLogger }      from '../core/logger.js';
import { CapabilityError }   from '../core/errors.js';

const log = createLogger('invoice-service');

function _provider() {
  const p = registry.getActiveForCapability('invoices');
  if (!p) throw new CapabilityError('invoices');
  return p;
}

/**
 * Create a new invoice in the active provider.
 * @param {Object} data — raw invoice data; will be validated
 * @returns {Promise<import('../interfaces/invoice.js').Invoice>}
 */
export async function createInvoice(data) {
  const invoice = validateInvoice(data);
  log.info('createInvoice', { reference: invoice.reference });
  return _provider().createInvoice(invoice);
}

/**
 * Retrieve an invoice by its provider-assigned ID.
 * @param {string} externalId
 */
export async function getInvoice(externalId) {
  log.debug('getInvoice', { externalId });
  return _provider().getInvoice(externalId);
}

/**
 * List invoices with optional filters.
 * @param {Object} [filters]
 */
export async function listInvoices(filters = {}) {
  log.debug('listInvoices', filters);
  return _provider().listInvoices(filters);
}

/**
 * Update an existing invoice.
 * @param {string} externalId
 * @param {Object} data — partial fields to update
 */
export async function updateInvoice(externalId, data) {
  log.info('updateInvoice', { externalId });
  return _provider().updateInvoice(externalId, data);
}

/**
 * Send an invoice to the client via the provider's email system.
 * @param {string} externalId
 */
export async function sendInvoice(externalId) {
  log.info('sendInvoice', { externalId });
  return _provider().sendInvoice(externalId);
}

/**
 * Void an invoice.
 * @param {string} externalId
 */
export async function voidInvoice(externalId) {
  log.info('voidInvoice', { externalId });
  return _provider().voidInvoice(externalId);
}
