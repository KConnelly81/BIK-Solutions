/**
 * Invoice Interface — Canonical DTO
 *
 * Australian GST invoices with line items.
 * GST rate is fixed at 10% (Australian standard).
 * All amounts in AUD cents to avoid floating-point rounding.
 *
 * Note: BIK stores amounts as integer cents internally.
 * Provider translators handle conversion to/from provider formats.
 */

import { ValidationError } from '../core/errors.js';

/**
 * @typedef {Object} InvoiceLineItem
 * @property {string}  description   — Line item description
 * @property {number}  quantity      — Quantity (decimal allowed)
 * @property {number}  unitPriceCents — Unit price in AUD cents (excl. GST)
 * @property {string}  [accountCode] — Chart of accounts code (provider-specific)
 * @property {'GST'|'NONE'} taxType  — GST applies or exempt
 * @property {number}  [lineTotalCents] — Computed: quantity × unitPriceCents
 * @property {number}  [lineTaxCents]   — Computed: GST on line (0 if NONE)
 */

/**
 * @typedef {Object} Invoice
 * @property {string}            [id]           — BIK internal UUID
 * @property {string}            [externalId]   — Provider-assigned invoice ID
 * @property {string}            [providerId]   — Which provider externalId belongs to
 * @property {string}            contactId      — BIK Contact UUID
 * @property {string}            [externalContactId] — Provider contact ID (if synced)
 * @property {string}            [reference]    — Invoice or job reference
 * @property {string}            date           — Issue date ISO 8601 (YYYY-MM-DD)
 * @property {string}            dueDate        — Due date ISO 8601
 * @property {'draft'|'sent'|'approved'|'paid'|'overdue'|'void'} status
 * @property {InvoiceLineItem[]} lineItems
 * @property {number}            subtotalCents  — Sum of lineTotalCents (excl. GST)
 * @property {number}            gstCents       — Sum of lineTaxCents
 * @property {number}            totalCents     — subtotalCents + gstCents
 * @property {string}            [currency]     — ISO 4217, default 'AUD'
 * @property {string}            [notes]        — Notes/memo on invoice
 * @property {string}            [terms]        — Payment terms text
 * @property {string}            [createdAt]    — ISO 8601
 * @property {string}            [updatedAt]    — ISO 8601
 */

export const INVOICE_STATUSES = ['draft', 'sent', 'approved', 'paid', 'overdue', 'void'];
export const TAX_TYPES        = ['GST', 'NONE'];
export const GST_RATE         = 0.1;

/**
 * Validate and compute totals on an invoice.
 * @param {Object} data
 * @throws {ValidationError}
 * @returns {Object} validated invoice with computed totals
 */
export function validateInvoice(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invoice', ['Invoice must be an object']);
  }

  if (!data.contactId) errors.push('contactId is required');
  if (!data.date)      errors.push('date is required');
  if (!data.dueDate)   errors.push('dueDate is required');

  if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) {
    errors.push('lineItems must be a non-empty array');
  }

  if (data.status && !INVOICE_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${INVOICE_STATUSES.join(', ')}`);
  }

  const lineErrors = [];
  (data.lineItems || []).forEach((item, i) => {
    if (!item.description?.trim()) lineErrors.push(`lineItems[${i}].description is required`);
    if (typeof item.quantity !== 'number' || item.quantity <= 0)
      lineErrors.push(`lineItems[${i}].quantity must be a positive number`);
    if (typeof item.unitPriceCents !== 'number' || item.unitPriceCents < 0)
      lineErrors.push(`lineItems[${i}].unitPriceCents must be a non-negative integer`);
    if (item.taxType && !TAX_TYPES.includes(item.taxType))
      lineErrors.push(`lineItems[${i}].taxType must be GST or NONE`);
  });

  errors.push(...lineErrors);
  if (errors.length) throw new ValidationError('Invoice', errors);

  // Compute line totals
  const computedItems = data.lineItems.map(item => {
    const taxType      = item.taxType || 'GST';
    const lineTotal    = Math.round(item.quantity * item.unitPriceCents);
    const lineTax      = taxType === 'GST' ? Math.round(lineTotal * GST_RATE) : 0;
    return { ...item, taxType, lineTotalCents: lineTotal, lineTaxCents: lineTax };
  });

  const subtotalCents = computedItems.reduce((s, l) => s + l.lineTotalCents, 0);
  const gstCents      = computedItems.reduce((s, l) => s + l.lineTaxCents,   0);

  return {
    status:   'draft',
    currency: 'AUD',
    ...data,
    lineItems:     computedItems,
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents
  };
}

/**
 * Build a progress-claim-style invoice from a BIK document form.
 * Maps form field names → canonical Invoice shape.
 */
export function invoiceFromVariationNotice(formData, contactId) {
  const costCents = Math.round((parseFloat(formData.additionalCost) || 0) * 100);
  const hasGST    = formData.gstApplicable === 'yes';

  return validateInvoice({
    contactId,
    reference: formData.variationNumber
      ? `Variation VN-${formData.variationNumber}`
      : formData.projectName,
    date:    formData.dateIssued || new Date().toISOString().slice(0, 10),
    dueDate: formData.dueDate   || new Date().toISOString().slice(0, 10),
    status:  'draft',
    lineItems: [{
      description:    formData.descriptionOfWork || 'Variation works',
      quantity:       1,
      unitPriceCents: costCents,
      taxType:        hasGST ? 'GST' : 'NONE'
    }],
    notes: formData.builderNotes || undefined
  });
}

/** Convert cents to AUD dollar amount (for display / provider APIs). */
export function centsToAUD(cents) {
  return Math.round(cents) / 100;
}

/** Convert AUD dollar amount to cents. */
export function audToCents(dollars) {
  return Math.round(parseFloat(dollars) * 100);
}
