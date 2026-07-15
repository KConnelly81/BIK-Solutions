/**
 * Project Interface — Canonical DTO
 *
 * A Project (also called Job) represents a construction engagement.
 * Maps to: Xero Project, MYOB Job, Buildxact Project, ServiceM8 Job, SimPRO Job, AroFlo Job.
 */

import { ValidationError } from '../core/errors.js';
import { AU_STATES }       from './contact.js';

/**
 * @typedef {Object} Project
 * @property {string}    [id]               — BIK internal UUID
 * @property {string}    [externalId]       — Provider-assigned job/project ID
 * @property {string}    [providerId]
 * @property {string}    name               — Project name
 * @property {string}    [reference]        — Job or contract number
 * @property {string}    contactId          — BIK Contact (client) UUID
 * @property {string}    [externalContactId]
 * @property {'active'|'inactive'|'completed'|'archived'|'cancelled'} status
 * @property {string}    [startDate]        — YYYY-MM-DD
 * @property {string}    [completionDate]   — Planned practical completion date
 * @property {string}    [actualCompletion] — Actual completion date
 * @property {number}    [contractValueCents] — Original contract value in AUD cents
 * @property {number}    [revisedValueCents]  — Revised value (sum of approved variations)
 * @property {Object}    [siteAddress]      — { line1, city, state, postcode }
 * @property {string}    [contractType]     — 'fixed-price' | 'cost-plus' | 'time-and-materials'
 * @property {string}    [description]
 * @property {string[]}  [tags]             — Free-form labels
 * @property {string}    [createdAt]
 * @property {string}    [updatedAt]
 */

export const PROJECT_STATUSES = ['active', 'inactive', 'completed', 'archived', 'cancelled'];
export const CONTRACT_TYPES   = ['fixed-price', 'cost-plus', 'time-and-materials'];

export function validateProject(data) {
  const errors = [];

  if (!data?.name?.trim()) errors.push('name is required');
  if (!data?.contactId)    errors.push('contactId is required');

  if (data?.status && !PROJECT_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${PROJECT_STATUSES.join(', ')}`);
  }

  if (data?.contractType && !CONTRACT_TYPES.includes(data.contractType)) {
    errors.push(`contractType must be one of: ${CONTRACT_TYPES.join(', ')}`);
  }

  if (data?.siteAddress?.state && !AU_STATES.includes(data.siteAddress.state)) {
    errors.push(`siteAddress.state must be one of: ${AU_STATES.join(', ')}`);
  }

  if (errors.length) throw new ValidationError('Project', errors);

  return {
    status: 'active',
    ...data,
    name: data.name.trim()
  };
}

/**
 * Build a Project from a BIK Variation Notice form (used when creating the job
 * in the accounting/job-management system to which the variation is attached).
 */
export function projectFromVariationFormData(formData, contactId) {
  return validateProject({
    contactId,
    name:      formData.projectName || 'Unnamed Project',
    reference: formData.contractRef  || undefined,
    siteAddress: formData.siteAddress ? {
      line1:   formData.siteAddress,
      country: 'AU'
    } : undefined,
    startDate:       formData.dateIssued || undefined,
    completionDate:  formData.revisedCompletionDate || undefined
  });
}
