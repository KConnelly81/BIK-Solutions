/**
 * Practical Completion Notice — Tool Configuration
 * Formally notifies client that construction works are complete.
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-practical-completion-counter';

function nextNoticeNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `PCN-${String(n).padStart(3, '0')}`;
}

export const SCHEMA = [

  // ── Your Business ────────────────────────────────────────────
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
    placeholder: '0400 000 000'
  },
  {
    id: 'builderEmail',
    label: 'Email',
    section: 'Your Business',
    type: 'email',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'you@yourbusiness.com.au'
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
    hint: 'Saved automatically for future documents'
  },

  // ── Project Details ──────────────────────────────────────────
  {
    id: 'clientName',
    label: 'Client name',
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
    label: 'Contract reference',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. JOB-2026-014'
  },

  // ── Completion Details ───────────────────────────────────────
  {
    id: 'noticeNumber',
    label: 'Notice number',
    section: 'Completion Details',
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
    section: 'Completion Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'completionDate',
    label: 'Date of practical completion',
    section: 'Completion Details',
    type: 'date',
    width: 'half',
    required: true,
    errorMsg: 'Practical completion date is required'
  },
  {
    id: 'outstandingWorks',
    label: 'Outstanding / minor works (if any)',
    section: 'Completion Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List any minor outstanding works excluded from the practical completion claim (e.g. touch-up painting, final cleaning, minor defects to be rectified).'
  },

  // ── Defects Liability Period ─────────────────────────────────
  {
    id: 'defectsLiabilityPeriod',
    label: 'Defects liability period',
    section: 'Defects Liability Period',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: '12 months',
    options: [
      { value: '3 months',   label: '3 months' },
      { value: '6 months',   label: '6 months' },
      { value: '12 months',  label: '12 months' },
      { value: '24 months',  label: '24 months' },
      { value: 'per contract', label: 'As per the contract' }
    ],
    errorMsg: 'Select the defects liability period'
  },
  {
    id: 'defectsLiabilityEnd',
    label: 'Defects liability end date',
    section: 'Defects Liability Period',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Calculated or manually entered'
  },
  {
    id: 'keysHandedOver',
    label: 'Keys handed over',
    section: 'Defects Liability Period',
    type: 'radio',
    required: false,
    defaultValue: 'yes',
    options: [
      { value: 'yes',     label: 'Yes' },
      { value: 'no',      label: 'No' },
      { value: 'partial', label: 'Partial' }
    ]
  },
  {
    id: 'manualProvided',
    label: 'Operation and maintenance manual provided',
    section: 'Defects Liability Period',
    type: 'radio',
    required: false,
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
    section: 'Defects Liability Period',
    type: 'radio',
    required: false,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' }
    ]
  },
  {
    id: 'builderNotes',
    label: 'Builder notes',
    section: 'Defects Liability Period',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional notes, warranty information, or handover instructions.'
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
    label: 'Client acknowledgement — name',
    section: 'Approval',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Pre-fill if known'
  }

];

export const DOC_CONFIG = {
  toolId:          'practical-completion',
  toolName:        'Practical Completion Notice',
  autosaveKey:     'bik-practical-completion-draft',
  docPrefix:       'PCN',
  aiFields:        ['outstandingWorks', 'builderNotes'],
  printTitle:      'Notice of Practical Completion',
  approvalEnabled: true,

  getDocTitle(state) {
    return `Practical Completion Notice ${state.noticeNumber || '??'} — ${state.projectName || state.clientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.noticeNumber || '??';
  }
};

// ── Helpers ──────────────────────────────────────────────────

function checklistItem(label, value) {
  const map = { yes: 'Yes ✓', no: 'No ✗', partial: 'Partial', 'not-applicable': 'N/A' };
  return `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${label}</td><td style="padding:6px 8px;border:1px solid #ddd;font-weight:600;">${map[value] || (value ? esc(value) : '—')}</td></tr>`;
}

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const hasContractRef = !!data.contractRef?.trim();
  const hasOutstanding = !!data.outstandingWorks?.trim();
  const hasNotes       = !!data.builderNotes?.trim();
  const hasDLPEnd      = !!data.defectsLiabilityEnd;

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Notice of Practical Completion</h1>
      <div class="doc-subtitle">${esc(data.noticeNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Builder</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Client</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      ${data.clientEmail ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>` : ''}
      <div class="doc-meta-value">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Notice details</div>
      <table class="doc-ref-table">
        <tr><td>Notice no.</td><td>${esc(data.noticeNumber || '—')}</td></tr>
        <tr><td>Notice date</td><td>${formatDateLong(data.noticeDate) || '—'}</td></tr>
        ${hasContractRef ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
        <tr><td>Completion date</td><td><strong>${formatDateLong(data.completionDate) || '—'}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Declaration of Practical Completion</h2>
    <p>The builder hereby gives notice that <strong>Practical Completion</strong> of the works under the above-referenced contract has been achieved on <strong>${formatDateLong(data.completionDate) || '—'}</strong>.</p>
    <p>The works have been completed in accordance with the contract documents, plans, and specifications, except for any minor outstanding works listed below.</p>
  </div>

  ${hasOutstanding ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Minor Outstanding Works</h2>
    <p>The following minor outstanding works are noted and will be completed within the defects liability period:</p>
    <p>${esc(data.outstandingWorks)}</p>
  </div>` : ''}

  <div class="doc-section">
    <h2 class="doc-section-heading">Defects Liability Period</h2>
    <p>The <strong>Defects Liability Period</strong> of <strong>${esc(data.defectsLiabilityPeriod || '—')}</strong> commences on the date of Practical Completion (${formatDateLong(data.completionDate) || '—'})${hasDLPEnd ? ` and ends on <strong>${formatDateLong(data.defectsLiabilityEnd)}</strong>` : ''}.</p>
    <p>During this period, the builder will rectify any defects that are notified in writing and that arise from the works. The client must report any defects promptly upon discovery.</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Handover Checklist</h2>
    <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;width:120px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${checklistItem('Keys handed over', data.keysHandedOver)}
        ${checklistItem('Operation and maintenance manual provided', data.manualProvided)}
        ${checklistItem('Final clean complete', data.finalCleanComplete)}
      </tbody>
    </table>
  </div>

  ${hasNotes ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Notes</h2>
    <p>${esc(data.builderNotes)}</p>
  </div>` : ''}

  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Acknowledgement</h2>
    <p>Both parties are requested to sign below to acknowledge Practical Completion and the commencement of the Defects Liability Period.</p>

    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Builder</div>
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

  <div class="doc-disclaimer">
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice, is not certified as compliant with any specific contract, and does not modify any contractual or statutory obligations. The builder remains responsible for ensuring compliance with all applicable building, contractual, and regulatory requirements.
  </div>

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
