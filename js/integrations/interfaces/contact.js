/**
 * Contact Interface — Canonical DTO
 *
 * The canonical shape that all business components use when working with contacts.
 * Providers translate between this shape and their own API models.
 *
 * AUSTRALIAN-SPECIFIC FIELDS:
 *   abn      — Australian Business Number (11 digits, optional)
 *   acn      — Australian Company Number (9 digits, optional)
 *   state    — Two-letter Australian state code (QLD, NSW, VIC, SA, WA, TAS, ACT, NT)
 *   country  — Defaults to 'AU'
 */

import { ValidationError } from '../core/errors.js';

/**
 * @typedef {Object} ContactAddress
 * @property {string}  [line1]    — Street address line 1
 * @property {string}  [line2]    — Street address line 2 / suburb
 * @property {string}  [city]     — City or suburb
 * @property {string}  [state]    — QLD | NSW | VIC | SA | WA | TAS | ACT | NT
 * @property {string}  [postcode] — 4-digit Australian postcode
 * @property {string}  [country]  — ISO 3166-1 alpha-2 (default 'AU')
 */

/**
 * @typedef {Object} Contact
 * @property {string}         [id]          — BIK internal UUID (null for new contacts)
 * @property {string}         [externalId]  — Provider-assigned ID (populated after sync)
 * @property {string}         [providerId]  — Which provider this externalId belongs to
 * @property {'customer'|'supplier'|'both'|'employee'} type
 * @property {string}         name          — Full name or business name
 * @property {string}         [firstName]   — Individual first name
 * @property {string}         [lastName]    — Individual last name
 * @property {string}         [email]       — Primary email
 * @property {string}         [phone]       — Primary phone
 * @property {string}         [mobile]      — Mobile number
 * @property {string}         [abn]         — Australian Business Number (digits only)
 * @property {string}         [acn]         — Australian Company Number (digits only)
 * @property {ContactAddress} [address]     — Postal/registered address
 * @property {ContactAddress} [postalAddress] — If different from registered address
 * @property {string}         [website]
 * @property {string}         [notes]
 * @property {boolean}        [isActive]    — Default true
 * @property {string}         [createdAt]   — ISO 8601
 * @property {string}         [updatedAt]   — ISO 8601
 */

/** Valid Australian states / territories. */
export const AU_STATES = ['QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

export const CONTACT_TYPES = ['customer', 'supplier', 'both', 'employee'];

/**
 * Validate a Contact object.
 * @param {Object} data
 * @throws {ValidationError}
 * @returns {Object} validated and normalised contact
 */
export function validateContact(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    throw new ValidationError('Contact', ['Contact must be an object']);
  }

  if (!data.name?.trim()) {
    errors.push('name is required');
  }

  if (data.type && !CONTACT_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${CONTACT_TYPES.join(', ')}`);
  }

  if (data.email && !isEmail(data.email)) {
    errors.push('email must be a valid email address');
  }

  if (data.abn) {
    const abn = data.abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(abn)) errors.push('abn must be 11 digits');
  }

  if (data.acn) {
    const acn = data.acn.replace(/\s/g, '');
    if (!/^\d{9}$/.test(acn)) errors.push('acn must be 9 digits');
  }

  if (data.address?.state && !AU_STATES.includes(data.address.state)) {
    errors.push(`address.state must be one of: ${AU_STATES.join(', ')}`);
  }

  if (errors.length) throw new ValidationError('Contact', errors);

  return {
    type:    'customer',
    isActive: true,
    ...data,
    name:    data.name.trim(),
    email:   data.email?.toLowerCase().trim() || undefined,
    abn:     data.abn?.replace(/\s/g, '') || undefined,
    acn:     data.acn?.replace(/\s/g, '') || undefined
  };
}

/**
 * Build a minimal Contact from a form data object (e.g. variation notice form state).
 * Maps BIK form field names to the canonical Contact shape.
 */
export function contactFromFormData(formData) {
  return validateContact({
    type:  'customer',
    name:  formData.clientName || formData.name || '',
    email: formData.clientEmail || formData.email,
    phone: formData.clientPhone || formData.phone,
    abn:   formData.clientABN   || formData.abn,
    address: formData.siteAddress ? {
      line1:   formData.siteAddress,
      country: 'AU'
    } : undefined
  });
}

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}
