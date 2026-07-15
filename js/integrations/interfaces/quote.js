/**
 * Quote Interface — Canonical DTO
 *
 * A Quote (also called Estimate or Proposal) is an offer to perform work
 * at a specified price. Once accepted, it typically becomes a job/project.
 *
 * Australian builders use both "Quote" (fixed price) and "Estimate" (indicative).
 * The quoteType field distinguishes these.
 */

import { ValidationError } from '../core/errors.js';
import { TAX_TYPES, GST_RATE } from './invoice.js';

/**
 * @typedef {Object} QuoteLineItem
 * @property {string}  description
 * @property {number}  quantity
 * @property {number}  unitPriceCents
 * @property {'GST'|'NONE'} taxType
 * @property {number}  [lineTotalCents]
 * @property {number}  [lineTaxCents]
 */

/**
 * @typedef {Object} Quote
 * @property {string}          [id]
 * @property {string}          [externalId]
 * @property {string}          [providerId]
 * @property {string}          contactId            — BIK Contact UUID
 * @property {string}          [externalContactId]
 * @property {string}          title                — Short description of the work
 * @property {string}          [reference]          — Quote or job number
 * @property {string}          date                 — Issue date YYYY-MM-DD
 * @property {string}          [expiryDate]         — Quote validity date
 * @property {'quote'|'estimate'|'proposal'} quoteType
 * @property {'draft'|'sent'|'accepted'|'declined'|'expired'|'void'} status
 * @property {QuoteLineItem[]} lineItems
 * @property {number}          subtotalCents
 * @property {number}          gstCents
 * @property {number}          totalCents
 * @property {string}          [currency]           — default 'AUD'
 * @property {string}          [scopeOfWorks]       — Full scope description
 * @property {string}          [exclusions]         — What is excluded
 * @property {string}          [terms]              — Terms and conditions
 * @property {string}          [notes]
 * @property {number}          [validityDays]       — Days until quote expires
 * @property {string}          [createdAt]
 * @property {string}          [updatedAt]
 */

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired', 'void'];
export const QUOTE_TYPES    = ['quote', 'estimate', 'proposal'];

export function validateQuote(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    throw new ValidationError('Quote', ['Quote must be an object']);
  }

  if (!data.contactId) errors.push('contactId is required');
  if (!data.title?.trim()) errors.push('title is required');
  if (!data.date)      errors.push('date is required');

  if (data.quoteType && !QUOTE_TYPES.includes(data.quoteType)) {
    errors.push(`quoteType must be one of: ${QUOTE_TYPES.join(', ')}`);
  }

  if (data.status && !QUOTE_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${QUOTE_STATUSES.join(', ')}`);
  }

  if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) {
    errors.push('lineItems must be a non-empty array');
  }

  (data.lineItems || []).forEach((item, i) => {
    if (!item.description?.trim())
      errors.push(`lineItems[${i}].description is required`);
    if (typeof item.unitPriceCents !== 'number' || item.unitPriceCents < 0)
      errors.push(`lineItems[${i}].unitPriceCents must be a non-negative integer`);
  });

  if (errors.length) throw new ValidationError('Quote', errors);

  const computedItems = data.lineItems.map(item => {
    const taxType   = item.taxType || 'GST';
    const qty       = item.quantity ?? 1;
    const lineTotal = Math.round(qty * item.unitPriceCents);
    const lineTax   = taxType === 'GST' ? Math.round(lineTotal * GST_RATE) : 0;
    return { ...item, quantity: qty, taxType, lineTotalCents: lineTotal, lineTaxCents: lineTax };
  });

  const subtotalCents = computedItems.reduce((s, l) => s + l.lineTotalCents, 0);
  const gstCents      = computedItems.reduce((s, l) => s + l.lineTaxCents,   0);

  return {
    quoteType:    'quote',
    status:       'draft',
    currency:     'AUD',
    validityDays: 30,
    ...data,
    lineItems:     computedItems,
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents
  };
}
