/**
 * Variation Notice — Tool Configuration
 * Consumed by FormEngine (SCHEMA) and DocumentRenderer (generateDocument).
 *
 * ADDING A NEW TOOL:
 *   1. Copy this file to js/tools/<tool-name>/config.js
 *   2. Replace SCHEMA fields with your tool's fields
 *   3. Replace generateDocument() with your document template
 *   4. Import into your tool's index.js
 *   That's it. The engine handles the rest.
 */

import { calcGST, calcTotal, formatAUD, formatDateLong, todayISO, addDays } from '../../toolkit/calculator.js';

// ── Variation number counter ─────────────────────────────────

const COUNTER_KEY = 'bik-variation-counter';

function nextVariationNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return String(n).padStart(3, '0');
}

// ── Schema ───────────────────────────────────────────────────

/**
 * SCHEMA — array of field definitions.
 * Fields with `profile: true` are persisted in bik-builder-profile
 * and auto-filled on every tool.
 *
 * Field shape: see engine.js header for full reference.
 */
export const SCHEMA = [

  // ── Your Business (profile — persisted across tools) ────────
  {
    id: 'builderName',
    label: 'Business or trading name',
    section: 'Your Business',
    type: 'text',
    width: 'half',
    required: true,
    profile: true,
    placeholder: 'e.g. Smith Building Pty Ltd',
    autocomplete: 'organization',
    errorMsg: 'Business name is required'
  },
  {
    id: 'builderABN',
    label: 'ABN',
    section: 'Your Business',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: '12 345 678 901',
    hint: 'Australian Business Number',
    inputmode: 'numeric'
  },
  {
    id: 'builderPhone',
    label: 'Phone',
    section: 'Your Business',
    type: 'tel',
    width: 'half',
    required: false,
    profile: true,
    placeholder: '0400 000 000',
    autocomplete: 'tel'
  },
  {
    id: 'builderEmail',
    label: 'Email',
    section: 'Your Business',
    type: 'email',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'you@yourbusiness.com.au',
    autocomplete: 'email'
  },
  {
    id: 'builderAddress',
    label: 'Business address',
    section: 'Your Business',
    type: 'textarea',
    width: 'full',
    required: false,
    profile: true,
    rows: 2,
    placeholder: '123 Example Street, Brisbane QLD 4000',
    autocomplete: 'street-address',
    hint: 'Saved automatically for future documents'
  },

  // ── Project Details ─────────────────────────────────────────
  {
    id: 'clientName',
    label: 'Client name',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. John & Jane Smith',
    autocomplete: 'off',
    errorMsg: 'Client name is required'
  },
  {
    id: 'projectName',
    label: 'Project name',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Smith Residence Renovation',
    errorMsg: 'Project name is required'
  },
  {
    id: 'siteAddress',
    label: 'Site address',
    section: 'Project Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Project Street, Brisbane QLD 4000'
  },
  {
    id: 'contractRef',
    label: 'Contract / job reference',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. JOB-2026-014'
  },
  {
    id: 'variationNumber',
    label: 'Variation number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextVariationNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Variation number is required'
  },
  {
    id: 'dateIssued',
    label: 'Date issued',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'requestedBy',
    label: 'Variation requested by',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Client, Architect, Builder'
  },

  // ── Variation Details ────────────────────────────────────────
  {
    id: 'reasonForVariation',
    label: 'Reason for variation',
    section: 'Variation Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 3,
    placeholder: 'Describe why this variation is required — client request, unforeseen condition, design change, etc.',
    errorMsg: 'Reason for variation is required'
  },
  {
    id: 'descriptionOfWork',
    label: 'Description of changed or additional work',
    section: 'Variation Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Describe in detail the work to be performed under this variation. Be specific — this is the record both parties will rely on.',
    errorMsg: 'Work description is required'
  },
  {
    id: 'exclusionsAssumptions',
    label: 'Exclusions and assumptions',
    section: 'Variation Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List anything specifically excluded from this variation, or assumptions made in pricing (e.g. "Excludes painting. Assumes existing framing is structurally sound.")'
  },

  // ── Resources ───────────────────────────────────────────────
  {
    id: 'materialsRequired',
    label: 'Materials required',
    section: 'Resources',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List key materials, quantities and specifications (leave blank if labour only)'
  },
  {
    id: 'labourRequired',
    label: 'Labour required',
    section: 'Resources',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Describe trades and estimated hours'
  },

  // ── Cost and Time ────────────────────────────────────────────
  {
    id: 'additionalCost',
    label: 'Additional cost (excl. GST) $',
    section: 'Cost and Time',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    errorMsg: 'Enter the additional cost (use 0 for a nil-cost variation)'
  },
  {
    id: 'gstApplicable',
    label: 'GST',
    section: 'Cost and Time',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Add 10% GST' },
      { value: 'no',  label: 'GST-free' }
    ]
  },
  {
    id: 'costType',
    label: 'Cost type',
    section: 'Cost and Time',
    type: 'radio',
    required: true,
    defaultValue: 'fixed',
    options: [
      { value: 'fixed',    label: 'Fixed price' },
      { value: 'estimate', label: 'Estimate (subject to final measurement)' },
      { value: 'provisional', label: 'Provisional sum' }
    ],
    errorMsg: 'Select a cost type'
  },
  {
    id: 'extensionOfTime',
    label: 'Extension of time (calendar days)',
    section: 'Cost and Time',
    type: 'number',
    width: 'half',
    required: false,
    defaultValue: '0',
    placeholder: '0',
    min: 0,
    step: 1,
    inputmode: 'numeric',
    hint: 'Enter 0 if no extension is required'
  },
  {
    id: 'revisedCompletionDate',
    label: 'Revised completion date',
    section: 'Cost and Time',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Leave blank if no change to completion date'
  },
  {
    id: 'paymentTerms',
    label: 'Payment terms',
    section: 'Cost and Time',
    type: 'select',
    width: 'full',
    required: false,
    defaultValue: '14days-approval',
    options: [
      { value: '7days-approval',   label: '7 days from client approval' },
      { value: '14days-approval',  label: '14 days from client approval' },
      { value: '14days-invoice',   label: '14 days from invoice date' },
      { value: '30days-invoice',   label: '30 days from invoice date' },
      { value: 'practical-completion', label: 'On practical completion' },
      { value: 'per-contract',     label: 'As per the original contract' }
    ]
  },

  // ── Notes ───────────────────────────────────────────────────
  {
    id: 'builderNotes',
    label: 'Additional notes',
    section: 'Notes',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional notes, conditions, or special instructions for this variation'
  },

  // ── Approval ─────────────────────────────────────────────────
  {
    id: 'builderApprovalName',
    label: 'Builder approval — name',
    section: 'Approval',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  },
  {
    id: 'clientApprovalName',
    label: 'Client approval — name',
    section: 'Approval',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Pre-fill if known'
  }

];

// ── Payment terms label lookup ───────────────────────────────

const PAYMENT_TERM_LABELS = {
  '7days-approval':        '7 days from client approval',
  '14days-approval':       '14 days from client approval',
  '14days-invoice':        '14 days from invoice date',
  '30days-invoice':        '30 days from invoice date',
  'practical-completion':  'On practical completion',
  'per-contract':          'As per the original contract'
};

const COST_TYPE_LABELS = {
  fixed:       'Fixed price',
  estimate:    'Estimate — subject to final measurement',
  provisional: 'Provisional sum'
};

// ── Document template ────────────────────────────────────────

/**
 * Generate the Variation Notice HTML.
 * Pure function — no DOM access, no side effects.
 *
 * AI_INTEGRATION_POINT: Replace this function with an async API call.
 * The returned HTML must contain a single root .doc-page element.
 *
 * @param {Object} data — FormEngine.getState()
 * @returns {string}
 */
export function generateDocument(data) {
  const costExcl  = parseFloat(data.additionalCost) || 0;
  const gstAmt    = calcGST(costExcl, data.gstApplicable === 'yes');
  const total     = calcTotal(costExcl, data.gstApplicable === 'yes');
  const eot       = parseInt(data.extensionOfTime, 10) || 0;
  const costLabel = COST_TYPE_LABELS[data.costType] || '';
  const pmtLabel  = PAYMENT_TERM_LABELS[data.paymentTerms] || '';

  const hasResources       = !!(data.materialsRequired?.trim() || data.labourRequired?.trim());
  const hasExclusions      = !!data.exclusionsAssumptions?.trim();
  const hasEOT             = eot > 0;
  const hasRevisedDate     = !!data.revisedCompletionDate;
  const hasNotes           = !!data.builderNotes?.trim();
  const hasBuilderContact  = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const hasContractRef     = !!data.contractRef?.trim();
  const hasRequestedBy     = !!data.requestedBy?.trim();

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name">
        <strong>B</strong>IK Solutions
      </div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Variation Notice</h1>
      <div class="doc-subtitle">VN&ndash;${esc(data.variationNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <!-- Business + Project meta -->
  <div class="doc-meta-grid">

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Prepared by</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      ${hasBuilderContact ? `
      <div class="doc-meta-contact">
        ${data.builderPhone  ? `<div>${esc(data.builderPhone)}</div>`  : ''}
        ${data.builderEmail  ? `<div>${esc(data.builderEmail)}</div>`  : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>` : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Issued to</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      <div class="doc-meta-value">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Variation details</div>
      <table class="doc-ref-table">
        <tr><td>Date issued</td><td>${formatDateLong(data.dateIssued) || '—'}</td></tr>
        <tr><td>Variation no.</td><td>${esc(data.variationNumber || '—')}</td></tr>
        ${hasContractRef ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
        ${hasRequestedBy ? `<tr><td>Requested by</td><td>${esc(data.requestedBy)}</td></tr>` : ''}
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  <!-- Reason -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Reason for Variation</h2>
    <p>${esc(data.reasonForVariation || '—')}</p>
  </div>

  <!-- Description -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Description of Changed or Additional Work</h2>
    <p>${esc(data.descriptionOfWork || '—')}</p>
  </div>

  ${hasExclusions ? `
  <!-- Exclusions -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Exclusions and Assumptions</h2>
    <p>${esc(data.exclusionsAssumptions)}</p>
  </div>` : ''}

  ${hasResources ? `
  <!-- Resources -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Scope of Resources</h2>
    ${data.materialsRequired?.trim() ? `
    <div class="doc-resource-row">
      <div class="doc-resource-label">Materials</div>
      <div class="doc-resource-value">${esc(data.materialsRequired)}</div>
    </div>` : ''}
    ${data.labourRequired?.trim() ? `
    <div class="doc-resource-row">
      <div class="doc-resource-label">Labour</div>
      <div class="doc-resource-value">${esc(data.labourRequired)}</div>
    </div>` : ''}
  </div>` : ''}

  <!-- Cost -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Cost Summary</h2>
    <table class="doc-cost-table">
      <tbody>
        <tr>
          <td>Additional cost (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(costExcl)}</td>
        </tr>
        ${data.gstApplicable === 'yes' ? `
        <tr>
          <td>GST (10%)</td>
          <td class="doc-cost-amount">${formatAUD(gstAmt)}</td>
        </tr>` : `
        <tr>
          <td>GST</td>
          <td class="doc-cost-amount">Not applicable</td>
        </tr>`}
        <tr class="doc-cost-total">
          <td>Total variation amount</td>
          <td class="doc-cost-amount">${formatAUD(total)}</td>
        </tr>
      </tbody>
    </table>
    <div class="doc-cost-type">Cost type: <strong>${costLabel}</strong></div>
    ${pmtLabel ? `<div class="doc-cost-terms">Payment terms: ${pmtLabel}</div>` : ''}
    <p class="doc-cost-note">GST calculations are indicative. The builder is responsible for verifying their own GST obligations.</p>
  </div>

  ${hasEOT || hasRevisedDate ? `
  <!-- Time impact -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Time Impact</h2>
    ${hasEOT ? `<p>This variation requires an extension of <strong>${eot} calendar day${eot !== 1 ? 's' : ''}</strong> to the practical completion date.</p>` : ''}
    ${hasRevisedDate ? `<p>Revised practical completion date: <strong>${formatDateLong(data.revisedCompletionDate)}</strong></p>` : ''}
  </div>` : ''}

  ${hasNotes ? `
  <!-- Notes -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Notes</h2>
    <p>${esc(data.builderNotes)}</p>
  </div>` : ''}

  <!-- Approval -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Approval</h2>
    <p class="doc-approval-instruction">Both parties must sign this Variation Notice before work commences. An unsigned variation does not form part of the contract.</p>

    <div class="sig-grid">

      <div class="sig-block">
        <div class="sig-role">Builder / Contractor</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.builderApprovalName || 'Authorised Representative')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row">
          <div class="sig-date-label">Date</div>
          <div class="sig-date-line"></div>
        </div>
      </div>

      <div class="sig-block">
        <div class="sig-role">Client</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.clientApprovalName || data.clientName || 'Client Signature')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row">
          <div class="sig-date-label">Date</div>
          <div class="sig-date-line"></div>
        </div>
      </div>

    </div>
  </div>

  <!-- Disclaimer -->
  <div class="doc-disclaimer">
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice, is not certified as compliant with any specific contract or regulation, and does not modify any contractual or statutory obligations. The builder or relevant licence holder remains responsible for ensuring all contractual and regulatory requirements are met. GST calculations are indicative only and are not tax advice.
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    Generated with BIK Business Toolkit &mdash; biksolutions.com.au &nbsp;|&nbsp; Generated ${formatDateLong(todayISO())}
  </div>

</div>`.trim();
}

/** Minimal HTML entity escaping. Prevents XSS in generated documents. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/\n/g, '<br>');
}
