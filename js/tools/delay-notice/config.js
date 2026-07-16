/**
 * Delay Notice — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-delay-notice-counter';

function nextNoticeNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'DN-' + String(n).padStart(3, '0');
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
    id: 'noticeNumber',
    label: 'Notice number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextNoticeNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Notice number is required'
  },
  {
    id: 'noticeDate',
    label: 'Notice date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Notice date is required'
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

  // ── Delay Details ───────────────────────────────────────────
  {
    id: 'delayStartDate',
    label: 'Delay commencement date',
    section: 'Delay Details',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'When the delay commenced or is expected to commence'
  },
  {
    id: 'delayCause',
    label: 'Cause of delay',
    section: 'Delay Details',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'client-instruction',
    options: [
      { value: 'client-instruction',      label: 'Client instruction' },
      { value: 'awaiting-design-approval', label: 'Awaiting design approval' },
      { value: 'latent-site-condition',    label: 'Latent site condition' },
      { value: 'inclement-weather',        label: 'Inclement weather' },
      { value: 'material-supply',          label: 'Material supply' },
      { value: 'subcontractor-default',    label: 'Subcontractor default' },
      { value: 'force-majeure',            label: 'Force majeure' },
      { value: 'other',                    label: 'Other' }
    ],
    errorMsg: 'Cause of delay is required'
  },
  {
    id: 'delayCauseDetail',
    label: 'Factual description of delay',
    section: 'Delay Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Provide a factual description of the event or circumstance causing the delay. Include relevant dates, parties involved, and the circumstances.',
    errorMsg: 'Description of delay is required'
  },
  {
    id: 'estimatedDelayDays',
    label: 'Estimated delay (calendar days)',
    section: 'Delay Details',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '14',
    min: 0,
    step: 1,
    inputmode: 'numeric',
    hint: 'Leave blank if not yet determinable'
  },

  // ── Impact ──────────────────────────────────────────────────
  {
    id: 'impactOnProgramme',
    label: 'Impact on programme',
    section: 'Impact',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Describe how this delay will affect the construction programme and completion date.'
  },

  // ── Notice ──────────────────────────────────────────────────
  {
    id: 'noticeType',
    label: 'Notice type',
    section: 'Notice',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'initial',
    options: [
      { value: 'initial', label: 'Initial delay notice' },
      { value: 'updated', label: 'Updated delay notice' },
      { value: 'final',   label: 'Final delay notice' }
    ]
  },
  {
    id: 'eotIntention',
    label: 'EOT intention',
    section: 'Notice',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'will-submit-eot',
    options: [
      { value: 'will-submit-eot', label: 'Will submit EOT claim' },
      { value: 'not-seeking-eot', label: 'Not seeking EOT' },
      { value: 'to-be-determined', label: 'To be determined' }
    ]
  },
  {
    id: 'additionalCostIntention',
    label: 'Additional cost intention',
    section: 'Notice',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'to-be-determined',
    options: [
      { value: 'will-submit-variation', label: 'Will submit variation for delay costs' },
      { value: 'no-additional-cost',    label: 'No additional cost claimed' },
      { value: 'to-be-determined',      label: 'To be determined' }
    ]
  },
  {
    id: 'builderNotes',
    label: 'Additional notes',
    section: 'Notice',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional information relevant to this notice'
  },
  {
    id: 'builderApprovalName',
    label: 'Issued by — name',
    section: 'Notice',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'delay-notice',
  toolName:        'Delay Notice',
  autosaveKey:     'bik-delay-notice-draft',
  docPrefix:       'DN',
  aiFields:        ['delayCauseDetail', 'impactOnProgramme'],
  printTitle:      'Delay Notice',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Delay Notice ${state.noticeNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.noticeNumber || '??';
  }
};

const DELAY_CAUSE_LABELS = {
  'client-instruction':       'Client instruction',
  'awaiting-design-approval': 'Awaiting design approval',
  'latent-site-condition':    'Latent site condition',
  'inclement-weather':        'Inclement weather',
  'material-supply':          'Material supply',
  'subcontractor-default':    'Subcontractor default',
  'force-majeure':            'Force majeure',
  'other':                    'Other'
};

const NOTICE_TYPE_LABELS = {
  'initial': 'Initial delay notice',
  'updated': 'Updated delay notice',
  'final':   'Final delay notice'
};

const EOT_INTENTION_LABELS = {
  'will-submit-eot':  'Will submit EOT claim',
  'not-seeking-eot':  'Not seeking EOT',
  'to-be-determined': 'To be determined'
};

const COST_INTENTION_LABELS = {
  'will-submit-variation': 'Will submit variation for delay costs',
  'no-additional-cost':    'No additional cost claimed',
  'to-be-determined':      'To be determined'
};

export function generateDocument(data) {
  const hasBuilderContact = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const causeLabel        = DELAY_CAUSE_LABELS[data.delayCause] || data.delayCause || '—';
  const noticeTypeLabel   = NOTICE_TYPE_LABELS[data.noticeType]   || '';
  const eotLabel          = EOT_INTENTION_LABELS[data.eotIntention]           || '';
  const costLabel         = COST_INTENTION_LABELS[data.additionalCostIntention] || '';
  const days              = parseInt(data.estimatedDelayDays, 10) || 0;
  const hasImpact         = !!data.impactOnProgramme?.trim();
  const hasNotes          = !!data.builderNotes?.trim();

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Delay Notice</h1>
      <div class="doc-subtitle">${esc(data.noticeNumber || '???')}${noticeTypeLabel ? ' &mdash; ' + esc(noticeTypeLabel) : ''}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Issued by</div>
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
      ${data.clientEmail ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>` : ''}
      <div class="doc-meta-value">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Notice Details</div>
      <table class="doc-ref-table">
        <tr><td>Notice no.</td><td>${esc(data.noticeNumber || '—')}</td></tr>
        <tr><td>Notice date</td><td>${formatDateLong(data.noticeDate) || '—'}</td></tr>
        ${data.contractRef    ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>`                        : ''}
        ${data.delayStartDate ? `<tr><td>Delay commenced</td><td>${formatDateLong(data.delayStartDate)}</td></tr>`        : ''}
        ${days > 0            ? `<tr><td>Estimated delay</td><td><strong>${days} calendar day${days !== 1 ? 's' : ''}</strong></td></tr>` : ''}
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  <!-- Notice statement -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Notice of Delay</h2>
    <p>This notice is served in accordance with the notice requirements of the contract. The builder hereby gives formal notice of a delay to the works as described below.</p>
  </div>

  <!-- Cause -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Nature and Cause of Delay</h2>
    <p><strong>Category:</strong> ${esc(causeLabel)}</p>
    <p style="margin-top:10px;">${esc(data.delayCauseDetail || '—')}</p>
  </div>

  ${hasImpact ? `
  <!-- Impact -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Estimated Impact on Programme</h2>
    <p>${esc(data.impactOnProgramme)}</p>
  </div>` : ''}

  <!-- Intentions -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Builder's Intentions</h2>
    <table class="doc-cost-table">
      <tbody>
        ${eotLabel  ? `<tr><td>Extension of time</td><td>${esc(eotLabel)}</td></tr>`   : ''}
        ${costLabel ? `<tr><td>Additional costs</td><td>${esc(costLabel)}</td></tr>`   : ''}
      </tbody>
    </table>
    <p style="margin-top:10px;font-size:0.85rem;color:#666;">The builder reserves all rights under the contract in relation to this delay event. Submission of this notice does not waive any entitlement to extension of time or additional costs.</p>
  </div>

  ${hasNotes ? `
  <!-- Notes -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Additional Notes</h2>
    <p>${esc(data.builderNotes)}</p>
  </div>` : ''}

  <!-- Signature -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Issued By</h2>
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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice. This notice must be served in strict compliance with the notice requirements of the applicable contract. Failure to comply with contractual notice periods may extinguish entitlements to extension of time and delay costs. Seek legal advice if in doubt.
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
