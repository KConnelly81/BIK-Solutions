/**
 * Handover Checklist — Tool Configuration
 * Consumed by FormEngine (SCHEMA) and DocumentRenderer (generateDocument).
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

// ── Checklist number counter ─────────────────────────────────

const COUNTER_KEY = 'bik-handover-checklist-counter';

function nextChecklistNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'HC-' + String(n).padStart(3, '0');
}

// ── Schema ───────────────────────────────────────────────────

export const SCHEMA = [

  // ── Your Business (profile) ─────────────────────────────────
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
    id: 'checklistNumber',
    label: 'Checklist number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextChecklistNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Checklist number is required'
  },
  {
    id: 'handoverDate',
    label: 'Handover date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Handover date is required'
  },
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
    id: 'clientEmail',
    label: 'Client email',
    section: 'Project Details',
    type: 'email',
    width: 'half',
    required: false,
    placeholder: 'client@email.com',
    hint: 'Used for email workflow',
    autocomplete: 'off'
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

  // ── Defects Liability ───────────────────────────────────────
  {
    id: 'defectsLiabilityPeriod',
    label: 'Defects liability period',
    section: 'Defects Liability',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: '6-months',
    options: [
      { value: '3-months',    label: '3 months' },
      { value: '6-months',    label: '6 months' },
      { value: '12-months',   label: '12 months' },
      { value: '24-months',   label: '24 months' },
      { value: 'per-contract', label: 'As per contract' }
    ],
    errorMsg: 'Defects liability period is required'
  },
  {
    id: 'defectsContactName',
    label: 'Defects contact name',
    section: 'Defects Liability',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Who to call for defects during liability period'
  },
  {
    id: 'defectsContactPhone',
    label: 'Defects contact phone',
    section: 'Defects Liability',
    type: 'tel',
    width: 'half',
    required: false,
    placeholder: '0400 000 000'
  },

  // ── Handover Items ──────────────────────────────────────────
  {
    id: 'keysProvided',
    label: 'Keys provided',
    section: 'Handover Items',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',     label: 'Yes' },
      { value: 'no',      label: 'No' },
      { value: 'partial', label: 'Partial' }
    ]
  },
  {
    id: 'keysCount',
    label: 'Number of key sets',
    section: 'Handover Items',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '2',
    min: 0,
    step: 1,
    inputmode: 'numeric'
  },
  {
    id: 'remoteControls',
    label: 'Remote controls provided',
    section: 'Handover Items',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'not-applicable',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'remoteCount',
    label: 'Number of remotes',
    section: 'Handover Items',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '2',
    min: 0,
    step: 1,
    inputmode: 'numeric'
  },
  {
    id: 'securityCodes',
    label: 'Security codes',
    section: 'Handover Items',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'not-applicable',
    options: [
      { value: 'yes-in-writing', label: 'Yes — provided in writing' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },

  // ── Utilities and Services ──────────────────────────────────
  {
    id: 'waterTurnedOn',
    label: 'Water turned on',
    section: 'Utilities and Services',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'electricityTurnedOn',
    label: 'Electricity turned on',
    section: 'Utilities and Services',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'gasConnected',
    label: 'Gas connected',
    section: 'Utilities and Services',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'not-applicable',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'meterReadings',
    label: 'Meter readings at handover',
    section: 'Utilities and Services',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'e.g. Water meter: 12345 kL, Electricity meter: 67890 kWh'
  },

  // ── Documentation Provided ──────────────────────────────────
  {
    id: 'manualProvided',
    label: 'Owners / appliance manuals provided',
    section: 'Documentation Provided',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'warrantyDocsProvided',
    label: 'Warranty documents provided',
    section: 'Documentation Provided',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'complianceCertsProvided',
    label: 'Compliance certificates provided',
    section: 'Documentation Provided',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'occupancyCertProvided',
    label: 'Occupancy / use certificate provided',
    section: 'Documentation Provided',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'not-applicable',
    options: [
      { value: 'yes',            label: 'Yes' },
      { value: 'no',             label: 'No' },
      { value: 'not-applicable', label: 'Not applicable' }
    ]
  },
  {
    id: 'finalCleanComplete',
    label: 'Final clean complete',
    section: 'Documentation Provided',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' }
    ]
  },

  // ── Sign-off ────────────────────────────────────────────────
  {
    id: 'outstandingItems',
    label: 'Outstanding items',
    section: 'Sign-off',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'List any items still to be completed, with agreed completion dates (leave blank if nil outstanding)'
  },
  {
    id: 'builderNotes',
    label: 'Builder notes',
    section: 'Sign-off',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional notes or instructions for the client'
  },
  {
    id: 'builderApprovalName',
    label: 'Builder approval — name',
    section: 'Sign-off',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  },
  {
    id: 'clientApprovalName',
    label: 'Client approval — name',
    section: 'Sign-off',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Pre-fill if known'
  }

];

// ── Tool configuration ────────────────────────────────────────

export const DOC_CONFIG = {
  toolId:          'handover-checklist',
  toolName:        'Handover Checklist',
  autosaveKey:     'bik-handover-checklist-draft',
  docPrefix:       'HC',
  aiFields:        ['outstandingItems', 'builderNotes'],
  printTitle:      'Handover Checklist',
  approvalEnabled: true,

  getDocTitle(state) {
    return `Handover Checklist ${state.checklistNumber || '??'} — ${state.projectName || state.clientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.checklistNumber || '??';
  }
};

// ── Label helpers ─────────────────────────────────────────────

const DLP_LABELS = {
  '3-months':    '3 months',
  '6-months':    '6 months',
  '12-months':   '12 months',
  '24-months':   '24 months',
  'per-contract': 'As per contract'
};

function yesNoNA(val) {
  if (val === 'yes') return 'Yes';
  if (val === 'yes-in-writing') return 'Yes — provided in writing';
  if (val === 'partial') return 'Partial';
  if (val === 'no') return 'No';
  return 'Not applicable';
}

// ── Document template ─────────────────────────────────────────

export function generateDocument(data) {
  const hasBuilderContact = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const hasOutstanding    = !!data.outstandingItems?.trim();
  const hasNotes          = !!data.builderNotes?.trim();
  const hasMeterReadings  = !!data.meterReadings?.trim();
  const dlpLabel          = DLP_LABELS[data.defectsLiabilityPeriod] || data.defectsLiabilityPeriod || '—';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Handover Checklist</h1>
      <div class="doc-subtitle">${esc(data.checklistNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Prepared by</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      ${hasBuilderContact ? `
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
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
      <div class="doc-meta-heading">Checklist details</div>
      <table class="doc-ref-table">
        <tr><td>Checklist no.</td><td>${esc(data.checklistNumber || '—')}</td></tr>
        <tr><td>Handover date</td><td>${formatDateLong(data.handoverDate) || '—'}</td></tr>
        ${data.contractRef ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  <!-- Defects Liability -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Defects Liability Period</h2>
    <p>The defects liability period for this project is <strong>${esc(dlpLabel)}</strong> commencing from the date of handover.</p>
    ${data.defectsContactName || data.defectsContactPhone ? `
    <p>To report a defect during the liability period, contact: <strong>${esc(data.defectsContactName || '—')}</strong>${data.defectsContactPhone ? ` &mdash; ${esc(data.defectsContactPhone)}` : ''}.</p>` : ''}
  </div>

  <!-- Keys and Access -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Keys and Access</h2>
    <table class="doc-cost-table">
      <thead>
        <tr><th>Item</th><th>Status</th><th>Qty</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Keys</td>
          <td>${esc(yesNoNA(data.keysProvided))}</td>
          <td>${data.keysCount ? esc(String(data.keysCount)) : '—'}</td>
        </tr>
        <tr>
          <td>Remote controls</td>
          <td>${esc(yesNoNA(data.remoteControls))}</td>
          <td>${data.remoteCount ? esc(String(data.remoteCount)) : '—'}</td>
        </tr>
        <tr>
          <td>Security codes</td>
          <td colspan="2">${esc(yesNoNA(data.securityCodes))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Utilities -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Utilities and Services</h2>
    <table class="doc-cost-table">
      <thead>
        <tr><th>Service</th><th>Status at Handover</th></tr>
      </thead>
      <tbody>
        <tr><td>Water</td><td>${esc(yesNoNA(data.waterTurnedOn))}</td></tr>
        <tr><td>Electricity</td><td>${esc(yesNoNA(data.electricityTurnedOn))}</td></tr>
        <tr><td>Gas</td><td>${esc(yesNoNA(data.gasConnected))}</td></tr>
      </tbody>
    </table>
    ${hasMeterReadings ? `<div style="margin-top:10px;"><strong>Meter readings:</strong><br>${esc(data.meterReadings)}</div>` : ''}
  </div>

  <!-- Documentation -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Documentation Provided</h2>
    <table class="doc-cost-table">
      <thead>
        <tr><th>Document</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr><td>Owners / appliance manuals</td><td>${esc(yesNoNA(data.manualProvided))}</td></tr>
        <tr><td>Warranty documents</td><td>${esc(yesNoNA(data.warrantyDocsProvided))}</td></tr>
        <tr><td>Compliance certificates</td><td>${esc(yesNoNA(data.complianceCertsProvided))}</td></tr>
        <tr><td>Occupancy / use certificate</td><td>${esc(yesNoNA(data.occupancyCertProvided))}</td></tr>
        <tr><td>Final clean complete</td><td>${esc(yesNoNA(data.finalCleanComplete))}</td></tr>
      </tbody>
    </table>
  </div>

  ${hasOutstanding ? `
  <!-- Outstanding Items -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Outstanding Items</h2>
    <p>${esc(data.outstandingItems)}</p>
  </div>` : ''}

  ${hasNotes ? `
  <!-- Notes -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Notes</h2>
    <p>${esc(data.builderNotes)}</p>
  </div>` : ''}

  <!-- Sign-off -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Handover Sign-off</h2>
    <p class="doc-approval-instruction">By signing below, both parties confirm that the works have been handed over in accordance with the contract, subject to any outstanding items listed above.</p>

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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice and does not modify any contractual or statutory obligations. The builder or relevant licence holder remains responsible for ensuring all contractual and regulatory requirements are met, including compliance with applicable Australian building codes and standards.
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
