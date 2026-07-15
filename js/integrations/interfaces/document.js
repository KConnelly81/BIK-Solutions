/**
 * Document Interface — Canonical DTO
 *
 * Represents a BIK-generated document (Variation Notice, Quote, Site Diary, etc.)
 * that can be attached to provider entities (invoices, contacts, projects).
 *
 * This is BIK's internal document record — distinct from an Attachment,
 * which is the result of pushing a document to a provider.
 */

import { ValidationError } from '../core/errors.js';

/**
 * @typedef {Object} BIKDocument
 * @property {string}   [id]           — BIK internal UUID
 * @property {string}   toolId         — 'variation-notice' | 'quote-builder' | 'site-diary' | etc.
 * @property {string}   title          — Human-readable title
 * @property {string}   [reference]    — Document reference (e.g. 'VN-001')
 * @property {string}   [html]         — Generated HTML content
 * @property {string}   [pdfBase64]    — PDF as base64 string
 * @property {Blob}     [pdfBlob]      — PDF as binary Blob
 * @property {Object}   formData       — Original form state that produced this document
 * @property {string}   [contactId]    — BIK Contact UUID (client)
 * @property {string}   [projectId]    — BIK Project UUID
 * @property {string}   [invoiceId]    — BIK Invoice UUID (if this doc created an invoice)
 * @property {string}   generatedAt    — ISO 8601 timestamp
 * @property {string}   [createdAt]
 */

export const TOOL_IDS = [
  'variation-notice',
  'quote-builder',
  'scope-of-works',
  'progress-claim',
  'site-diary',
  'defect-report',
  'toolbox-talk',
  'swms',
  'payment-reminder',
  'site-inspection',
  'handover-report',
  'subcontractor-agreement'
];

export function validateDocument(data) {
  const errors = [];

  if (!data?.toolId)        errors.push('toolId is required');
  if (!data?.title?.trim()) errors.push('title is required');
  if (!data?.formData)      errors.push('formData is required');

  if (data?.toolId && !TOOL_IDS.includes(data.toolId)) {
    errors.push(`toolId must be one of: ${TOOL_IDS.join(', ')}`);
  }

  if (errors.length) throw new ValidationError('BIKDocument', errors);

  return {
    generatedAt: new Date().toISOString(),
    ...data,
    title: data.title.trim()
  };
}

/**
 * Build a BIKDocument record from a Variation Notice generation.
 * Called after generateDocument() produces HTML and the user downloads/saves.
 */
export function documentFromVariationNotice(formData, html) {
  return validateDocument({
    toolId:    'variation-notice',
    title:     `Variation Notice VN-${formData.variationNumber || '???'} — ${formData.projectName || 'Unnamed Project'}`,
    reference: `VN-${formData.variationNumber}`,
    html,
    formData,
    generatedAt: new Date().toISOString()
  });
}
