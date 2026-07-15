/**
 * Attachment Interface — Canonical DTO
 *
 * Represents a file attached to an entity (contact, invoice, quote, project).
 * Provider-specific limits (file size, type, count) are declared in each provider stub.
 */

import { ValidationError } from '../core/errors.js';

/**
 * @typedef {'contact'|'invoice'|'quote'|'project'|'document'} AttachmentEntityType
 */
export const ATTACHMENT_ENTITY_TYPES = ['contact', 'invoice', 'quote', 'project', 'document'];

/**
 * @typedef {Object} Attachment
 * @property {string}   [id]          — BIK internal UUID
 * @property {string}   [externalId]  — Provider-assigned attachment ID
 * @property {string}   [providerId]
 * @property {AttachmentEntityType} entityType  — What kind of record this is attached to
 * @property {string}   entityId      — BIK UUID of the parent entity
 * @property {string}   [externalEntityId] — Provider ID of the parent entity
 * @property {string}   filename      — Original filename (e.g. 'Variation-Notice-001.pdf')
 * @property {string}   mimeType      — MIME type (e.g. 'application/pdf')
 * @property {number}   [sizeBytes]   — File size in bytes
 * @property {string}   [url]         — Signed download URL (may be time-limited)
 * @property {string}   [content]     — Base64-encoded content (for upload)
 * @property {Blob}     [blob]        — Binary content (for upload)
 * @property {string}   [createdAt]
 */

export function validateAttachment(data) {
  const errors = [];

  if (!data?.filename?.trim())  errors.push('filename is required');
  if (!data?.mimeType?.trim())  errors.push('mimeType is required');
  if (!data?.entityType)        errors.push('entityType is required');
  if (!data?.entityId)          errors.push('entityId is required');

  if (data?.entityType && !ATTACHMENT_ENTITY_TYPES.includes(data.entityType)) {
    errors.push(`entityType must be one of: ${ATTACHMENT_ENTITY_TYPES.join(', ')}`);
  }

  if (!data?.content && !data?.blob && !data?.url) {
    errors.push('one of content (base64), blob, or url is required');
  }

  if (errors.length) throw new ValidationError('Attachment', errors);

  return {
    ...data,
    filename: data.filename.trim(),
    mimeType: data.mimeType.trim()
  };
}
