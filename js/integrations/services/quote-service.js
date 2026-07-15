/**
 * Quote Service
 *
 * Business-level API for quote operations. Delegates to the active provider.
 */

import { registry }        from '../core/provider-registry.js';
import { validateQuote }   from '../interfaces/quote.js';
import { createLogger }    from '../core/logger.js';
import { CapabilityError } from '../core/errors.js';

const log = createLogger('quote-service');

function _provider() {
  const p = registry.getActiveForCapability('quotes');
  if (!p) throw new CapabilityError('quotes');
  return p;
}

/**
 * Create a new quote in the active provider.
 * @param {Object} data — raw quote data; will be validated
 * @returns {Promise<import('../interfaces/quote.js').Quote>}
 */
export async function createQuote(data) {
  const quote = validateQuote(data);
  log.info('createQuote', { title: quote.title });
  return _provider().createQuote(quote);
}

/**
 * Retrieve a quote by its provider-assigned ID.
 * @param {string} externalId
 */
export async function getQuote(externalId) {
  log.debug('getQuote', { externalId });
  return _provider().getQuote(externalId);
}

/**
 * List quotes with optional filters.
 * @param {Object} [filters]
 */
export async function listQuotes(filters = {}) {
  log.debug('listQuotes', filters);
  return _provider().listQuotes(filters);
}

/**
 * Mark a quote as accepted.
 * @param {string} externalId
 */
export async function acceptQuote(externalId) {
  log.info('acceptQuote', { externalId });
  return _provider().acceptQuote(externalId);
}

/**
 * Mark a quote as declined.
 * @param {string} externalId
 */
export async function declineQuote(externalId) {
  log.info('declineQuote', { externalId });
  return _provider().declineQuote(externalId);
}
