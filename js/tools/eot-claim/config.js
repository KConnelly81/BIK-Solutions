/**
 * Extension of Time Claim — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-eot-claim-counter';

function nextEOTNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'EOT-' + String(n).padStart(3, '0');
}

export const SCHEMA = [

  // ── Your Business ───────────────────────────────────────────
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
    id: 'eotNumber',
    label: 'EOT number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextEOTNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'EOT number is required'
  },
  {
    id: 'eotDate',
    label: 'Date of claim',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'clientName',
    label: 'Client / principal name',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. John & Jane Smith',
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
    hint: 'Used for email workflow'
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

  // ── EOT Details ─────────────────────────────────────────────
  {
    id: 'originalCompletionDate',
    label: 'Original completion date',
    section: 'EOT Details',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'currentCompletionDate',
    label: 'Current completion date',
    section: 'EOT Details',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'May differ from original if previously extended'
  },
  {
    id: 'eotCause',
    label: 'Cause of delay',
    section: 'EOT Details',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'client-directed-variations',
    options: [
      { value: 'client-directed-variations', label: 'Client-directed variations' },
      { value: 'inclement-weather',          label: 'Inclement weather' },
      { value: 'authority-delays',           label: 'Authority delays' },
      { value: 'supply-chain-delays',        label: 'Supply chain delays' },
      { value: 'site-access-denied',         label: 'Site access denied' },
      { value: 'unforeseen-site-conditions', label: 'Unforeseen site conditions' },
      { value: 'force-majeure',              label: 'Force majeure' },
      { value: 'other',                      label: 'Other' }
    ],
    errorMsg: 'Cause of delay is required'
  },
  {
    id: 'daysRequested',
    label: 'Calendar days requested',
    section: 'EOT Details',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '14',
    min: 1,
    step: 1,
    inputmode: 'numeric',
    errorMsg: 'Number of days is required'
  },
  {
    id: 'proposedNewCompletionDate',
    label: 'Proposed new completion date',
    section: 'EOT Details',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'eotCauseDetail',
    label: 'Detailed description of the delaying event',
    section: 'EOT Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Provide a factual and detailed description of the event or circumstance causing the delay. Include relevant dates, parties involved, and how the event was beyond the builder\'s control.',
    errorMsg: 'Description of the delaying event is required'
  },

  // ── Impact Assessment ───────────────────────────────────────
  {
    id: 'impactOnWorks',
    label: 'Impact on works and programme',
    section: 'Impact Assessment',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Describe how the delay has affected or will affect the construction programme, critical path activities, and overall completion.'
  },
  {
    id: 'stepsToMitigate',
    label: 'Steps taken to mitigate the delay',
    section: 'Impact Assessment',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Describe any steps taken or proposed to reduce the impact of the delay.'
  },
  {
    id: 'costImplication',
    label: 'Cost implication',
    section: 'Impact Assessment',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'no-additional-cost',
    options: [
      { value: 'no-additional-cost',       label: 'No additional cost' },
      { value: 'additional-cost-separate', label: 'Additional cost — will be claimed separately' },
      { value: 'included-in-variation',    label: 'Included in variation' }
    ]
  },

  // ── Supporting Evidence ─────────────────────────────────────
  {
    id: 'supportingEvidence',
    label: 'Supporting evidence',
    section: 'Supporting Evidence',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'List the evidence that supports this EOT claim. e.g.:\n• Bureau of Meteorology rainfall records — March 2026\n• Email from client dated 5 February 2026 re design change\n• Delivery docket — structural steel, delayed from 12 to 26 March 2026'
  },
  {
    id: 'builderNotes',
    label: 'Additional notes',
    section: 'Supporting Evidence',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional information relevant to this claim'
  },
  {
    id: 'builderApprovalName',
    label: 'Submitted by — name',
    section: 'Supporting Evidence',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'eot-claim',
  toolName:        'Extension of Time Claim',
  autosaveKey:     'bik-eot-claim-draft',
  docPrefix:       'EOT',
  aiFields:        ['eotCauseDetail', 'impactOnWorks', 'stepsToMitigate'],
  printTitle:      'Extension of Time Claim',
  approvalEnabled: false,

  getDocTitle(state) {
    return `EOT Claim ${state.eotNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.eotNumber || '??';
  }
};

const EOT_CAUSE_LABELS = {
  'client-directed-variations': 'Client-directed variations',
  'inclement-weather':          'Inclement weather',
  'authority-delays':           'Authority delays',
  'supply-chain-delays':        'Supply chain delays',
  'site-access-denied':         'Site access denied',
  'unforeseen-site-conditions': 'Unforeseen site conditions',
  'force-majeure':              'Force majeure',
  'other':                      'Other'
};

const COST_IMPL_LABELS = {
  'no-additional-cost':       'No additional cost',
  'additional-cost-separate': 'Additional cost — will be claimed separately',
  'included-in-variation':    'Included in variation'
};

export function generateDocument(data) {
  const hasBuilderContact = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const causeLabel        = EOT_CAUSE_LABELS[data.eotCause] || data.eotCause || '—';
  const days              = parseInt(data.daysRequested, 10) || 0;
  const hasImpact         = !!data.impactOnWorks?.trim();
  const hasMitigate       = !!data.stepsToMitigate?.trim();
  const hasEvidence       = !!data.supportingEvidence?.trim();
  const hasNotes          = !!data.builderNotes?.trim();
  const costLabel         = COST_IMPL_LABELS[data.costImplication] || '';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Extension of Time Claim</h1>
      <div class="doc-subtitle">${esc(data.eotNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Submitted by</div>
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
      <div class="doc-meta-heading">Submitted to</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      ${data.clientEmail  ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>`  : ''}
      <div class="doc-meta-value">${esc(data.projectName || '—')}</div>
      ${data.siteAddress  ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>`  : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Claim Details</div>
      <table class="doc-ref-table">
        <tr><td>EOT no.</td><td>${esc(data.eotNumber || '—')}</td></tr>
        <tr><td>Date of claim</td><td>${formatDateLong(data.eotDate) || '—'}</td></tr>
        ${data.contractRef ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
        <tr><td>Days requested</td><td><strong>${days} calendar day${days !== 1 ? 's' : ''}</strong></td></tr>
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  <!-- Programme impact -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Programme Dates</h2>
    <table class="doc-cost-table">
      <tbody>
        ${data.originalCompletionDate   ? `<tr><td>Original completion date</td><td>${formatDateLong(data.originalCompletionDate)}</td></tr>`   : ''}
        ${data.currentCompletionDate    ? `<tr><td>Current completion date</td><td>${formatDateLong(data.currentCompletionDate)}</td></tr>`    : ''}
        <tr><td>Extension claimed</td><td><strong>${days} calendar day${days !== 1 ? 's' : ''}</strong></td></tr>
        ${data.proposedNewCompletionDate ? `<tr class="doc-cost-total"><td>Proposed new completion date</td><td>${formatDateLong(data.proposedNewCompletionDate)}</td></tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- Cause -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Cause of Delay</h2>
    <p><strong>Category:</strong> ${esc(causeLabel)}</p>
    <p style="margin-top:10px;">${esc(data.eotCauseDetail || '—')}</p>
  </div>

  ${hasImpact ? `
  <!-- Impact -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Impact on Works and Programme</h2>
    <p>${esc(data.impactOnWorks)}</p>
  </div>` : ''}

  ${hasMitigate ? `
  <!-- Mitigation -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Steps Taken to Mitigate the Delay</h2>
    <p>${esc(data.stepsToMitigate)}</p>
  </div>` : ''}

  ${costLabel ? `
  <!-- Cost -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Cost Implication</h2>
    <p>${esc(costLabel)}</p>
  </div>` : ''}

  ${hasEvidence ? `
  <!-- Evidence -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Supporting Evidence</h2>
    <p>${esc(data.supportingEvidence)}</p>
  </div>` : ''}

  ${hasNotes ? `
  <!-- Notes -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Additional Notes</h2>
    <p>${esc(data.builderNotes)}</p>
  </div>` : ''}

  <!-- Signature -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Submitted By</h2>
    <div class="sig-grid" style="grid-template-columns: 1fr;">
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
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="doc-disclaimer">
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice and does not modify any contractual obligations. The builder is responsible for ensuring that extension of time claims are submitted in strict compliance with the notice requirements of the applicable contract. Failure to comply with contractual notice periods may extinguish entitlements. Seek legal advice if in doubt.
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    Generated with BIK Business Toolkit &mdash; biksolutions.com.au &nbsp;|&nbsp; Generated ${formatDateLong(todayISO())}
  </div>

</div>`.trim();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/\n/g, '<br>');
}
