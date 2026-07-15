/**
 * Contact Service
 *
 * Business-level API for contact operations. Delegates to the active provider
 * via the registry. Business components import this, never a provider directly.
 */

import { registry }          from '../core/provider-registry.js';
import { validateContact }   from '../interfaces/contact.js';
import { createLogger }      from '../core/logger.js';
import { CapabilityError }   from '../core/errors.js';

const log = createLogger('contact-service');

function _provider() {
  const p = registry.getActiveForCapability('contacts');
  if (!p) throw new CapabilityError('contacts');
  return p;
}

/**
 * Create a new contact in the active provider.
 * @param {Object} data — raw form data; will be validated before sending
 * @returns {Promise<import('../interfaces/contact.js').Contact>}
 */
export async function createCustomer(data) {
  const contact = validateContact(data);
  log.info('createCustomer', { name: contact.name });
  return _provider().createContact(contact);
}

/**
 * Retrieve a contact by its provider-assigned ID.
 * @param {string} externalId
 */
export async function getContact(externalId) {
  log.debug('getContact', { externalId });
  return _provider().getContact(externalId);
}

/**
 * List contacts with optional filters.
 * @param {Object} [filters] — provider-specific filter keys
 */
export async function listContacts(filters = {}) {
  log.debug('listContacts', filters);
  return _provider().listContacts(filters);
}

/**
 * Search contacts by name/email query string.
 * @param {string} query
 */
export async function searchContacts(query) {
  log.debug('searchContacts', { query });
  return _provider().searchContacts(query);
}

/**
 * Update a contact's details.
 * @param {string} externalId
 * @param {Object} data — partial contact fields to update
 */
export async function updateContact(externalId, data) {
  log.info('updateContact', { externalId });
  return _provider().updateContact(externalId, data);
}
