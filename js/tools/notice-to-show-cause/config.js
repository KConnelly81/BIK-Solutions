/**
 * Notice to Show Cause — Tool Configuration
 * Formal notice requiring the other party to explain a breach or default.
 *
 * IMPORTANT: This is a legal document. Users must seek independent legal advice
 * before issuing this notice. The generated document is not legal advice.
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-notice-to-show-cause-counter';

function nextNoticeNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `NSC-${String(n).padStart(3, '0')}`;
}

const CONSEQUENCE_LABELS = {
  'suspension':      'Suspension of works',
  'termination':     'Termination of the contract',
  'debt-recovery':   'Debt recovery proceedings',
  'all':             'All of the above — suspension, termination, and/or debt recovery'
};

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
    id: 'recipientName',
    label: 'Recipient name',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. John Smith or ABC Pty Ltd',
    errorMsg: 'Recipient name is required'
  },
  {
    id: 'recipientEmail',
    label: 'Recipient email',
    section: 'Project Details',
    type: 'email',
    width: 'half',
    required: false,
    placeholder: 'recipient@email.com'
  },
  {
    id: 'recipientAddress',
    label: 'Recipient address',
    section: 'Project Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Recipient Street, Brisbane QLD 4000'
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
  {
    id: 'contractDate',
    label: 'Contract date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Date the contract was signed'
  },

  // ── Nature of Breach ─────────────────────────────────────────
  {
    id: 'noticeNumber',
    label: 'Notice number',
    section: 'Nature of Breach',
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
    section: 'Nature of Breach',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'breachDate',
    label: 'Date breach occurred',
    section: 'Nature of Breach',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'natureOfBreach',
    label: 'Nature of breach / obligation breached',
    section: 'Nature of Breach',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 3,
    placeholder: 'Identify the specific clause(s) or obligation(s) that have been breached (e.g. "Clause 12 — failure to pay progress claim within 10 business days").',
    errorMsg: 'Nature of breach is required'
  },
  {
    id: 'breachDetail',
    label: 'Factual description of the breach',
    section: 'Nature of Breach',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 4,
    placeholder: 'Provide a factual, chronological description of the events constituting the breach.',
    errorMsg: 'Description of breach is required'
  },
  {
    id: 'evidenceAvailable',
    label: 'Supporting evidence available',
    section: 'Nature of Breach',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: 'e.g. Site photographs, written communications, payment records, inspection reports'
  },

  // ── Response Required ────────────────────────────────────────
  {
    id: 'remedyRequired',
    label: 'Remedy required',
    section: 'Response Required',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 3,
    placeholder: 'State clearly what the recipient must do to remedy the breach (e.g. "Pay all outstanding progress claims", "Remove unauthorised personnel from site immediately").',
    errorMsg: 'Remedy required is required'
  },
  {
    id: 'responseDeadline',
    label: 'Response deadline',
    section: 'Response Required',
    type: 'date',
    width: 'half',
    required: true,
    hint: 'Typically 5–10 business days from notice date',
    errorMsg: 'Response deadline is required'
  },
  {
    id: 'consequenceIfNoResponse',
    label: 'Consequence if no response or remedy',
    section: 'Response Required',
    type: 'select',
    width: 'full',
    required: true,
    defaultValue: 'all',
    options: [
      { value: 'suspension',    label: 'Suspension of works' },
      { value: 'termination',   label: 'Termination of the contract' },
      { value: 'debt-recovery', label: 'Debt recovery proceedings' },
      { value: 'all',           label: 'All of the above' }
    ],
    errorMsg: 'Select a consequence'
  },
  {
    id: 'builderApprovalName',
    label: 'Authorised by — name',
    section: 'Response Required',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'notice-to-show-cause',
  toolName:        'Notice to Show Cause',
  autosaveKey:     'bik-notice-to-show-cause-draft',
  docPrefix:       'NSC',
  aiFields:        ['natureOfBreach', 'breachDetail', 'remedyRequired'],
  printTitle:      'Notice to Show Cause',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Notice to Show Cause ${state.noticeNumber || '??'} — ${state.projectName || state.recipientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.noticeNumber || '??';
  }
};

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const hasContractRef = !!data.contractRef?.trim();
  const hasContractDate = !!data.contractDate;
  const hasBreachDate  = !!data.breachDate;
  const hasEvidence    = !!data.evidenceAvailable?.trim();
  const hasRecipientAddr = !!data.recipientAddress?.trim();
  const consequence    = CONSEQUENCE_LABELS[data.consequenceIfNoResponse] || esc(data.consequenceIfNoResponse || '—');

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Notice to Show Cause</h1>
      <div class="doc-subtitle">${esc(data.noticeNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div style="background:#fff3cd;border:2px solid #e6a817;border-radius:4px;padding:12px 16px;margin-bottom:20px;font-size:0.85rem;">
    <strong>⚠ Important Legal Notice:</strong> This is a formal legal document. You are strongly advised to seek independent legal advice before issuing this notice. Incorrectly issuing a Notice to Show Cause may expose you to liability or constitute a breach of contract. This document does not constitute legal advice.
  </div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Issuing party</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Issued to</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.recipientName || '—')}</div>
      ${data.recipientEmail ? `<div class="doc-meta-value">${esc(data.recipientEmail)}</div>` : ''}
      ${hasRecipientAddr    ? `<div class="doc-meta-value">${esc(data.recipientAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Notice details</div>
      <table class="doc-ref-table">
        <tr><td>Notice no.</td><td>${esc(data.noticeNumber || '—')}</td></tr>
        <tr><td>Date issued</td><td>${formatDateLong(data.noticeDate) || '—'}</td></tr>
        <tr><td>Project</td><td>${esc(data.projectName || '—')}</td></tr>
        ${hasContractRef  ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
        ${hasContractDate ? `<tr><td>Contract date</td><td>${formatDateLong(data.contractDate)}</td></tr>` : ''}
        ${hasBreachDate   ? `<tr><td>Breach date</td><td>${formatDateLong(data.breachDate)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">1. Nature of Breach</h2>
    <p>${esc(data.natureOfBreach || '—')}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">2. Description of the Breach</h2>
    <p>${esc(data.breachDetail || '—')}</p>
  </div>

  ${hasEvidence ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">3. Supporting Evidence</h2>
    <p>${esc(data.evidenceAvailable)}</p>
  </div>` : ''}

  <div class="doc-section">
    <h2 class="doc-section-heading">${hasEvidence ? '4' : '3'}. Remedy Required</h2>
    <p>You are hereby required to show cause and/or remedy the breach as follows:</p>
    <p>${esc(data.remedyRequired || '—')}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">${hasEvidence ? '5' : '4'}. Response Deadline</h2>
    <p>You must respond to this notice and/or remedy the breach by <strong>${formatDateLong(data.responseDeadline) || '—'}</strong>.</p>
    <p>Your response must be made in writing and directed to the issuing party at the contact details above.</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">${hasEvidence ? '6' : '5'}. Consequence of Non-Compliance</h2>
    <p>If you fail to respond to this notice or remedy the breach by the deadline specified above, the issuing party reserves the right to take the following action without further notice:</p>
    <p><strong>${consequence}</strong></p>
    <p>Any costs incurred as a result of your breach, including legal fees and costs of recovery, may be claimed from you.</p>
  </div>

  <div class="doc-section">
    <p>Yours faithfully,</p>
    <br>
    <div class="sig-line" style="width:200px;border-bottom:1px solid #333;margin-bottom:4px;height:40px;"></div>
    <p><strong>${esc(data.builderApprovalName || data.builderName || '—')}</strong><br>
    ${esc(data.builderName || '')}<br>
    ${formatDateLong(data.noticeDate) || ''}</p>
  </div>

  <div class="doc-disclaimer">
    <strong>Legal Disclaimer:</strong> This document was generated from information supplied by the user and does not constitute legal advice. It is not a substitute for independent legal advice from a qualified construction lawyer. The issuing party is responsible for ensuring this notice is appropriate in the circumstances, correctly served, and compliant with the applicable contract and legislation. BIK Solutions accepts no liability for any consequence arising from the issue of this notice.
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
