/**
 * Attachment Service
 *
 * Business-level API for attaching BIK-generated documents to provider entities.
 * Only Xero currently supports attachments; other providers throw CapabilityError.
 */

import { registry }             from '../core/provider-registry.js';
import { validateAttachment }   from '../interfaces/attachment.js';
import { createLogger }         from '../core/logger.js';
import { CapabilityError }      from '../core/errors.js';

const log = createLogger('attachment-service');

function _provider() {
  const p = registry.getActiveForCapability('attachments');
  if (!p) throw new CapabilityError('attachments');
  return p;
}

/**
 * Attach a document to an entity in the active provider.
 *
 * @param {string} entityType       — 'invoice' | 'contact' | 'quote' | 'project'
 * @param {string} externalEntityId — provider's ID for the entity
 * @param {Object} data             — raw attachment data; will be validated
 * @returns {Promise<import('../interfaces/attachment.js').Attachment>}
 */
export async function attachDocument(entityType, externalEntityId, data) {
  const attachment = validateAttachment({ ...data, entityType, entityId: externalEntityId });
  log.info('attachDocument', { entityType, externalEntityId, filename: attachment.filename });
  return _provider().attachDocument(entityType, externalEntityId, attachment);
}

/**
 * List attachments on a provider entity.
 *
 * @param {string} entityType
 * @param {string} externalEntityId
 */
export async function listAttachments(entityType, externalEntityId) {
  log.debug('listAttachments', { entityType, externalEntityId });
  return _provider().listAttachments(entityType, externalEntityId);
}

/**
 * Delete an attachment from a provider entity.
 *
 * @param {string} entityType
 * @param {string} externalEntityId
 * @param {string} attachmentId     — provider's attachment ID
 */
export async function deleteAttachment(entityType, externalEntityId, attachmentId) {
  log.info('deleteAttachment', { entityType, externalEntityId, attachmentId });
  return _provider().deleteAttachment(entityType, externalEntityId, attachmentId);
}
