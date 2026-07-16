/**
 * Contract Termination Notice — Tool Configuration
 * Formal notice of contract termination.
 *
 * CRITICAL: This is a serious legal document. Users MUST seek legal advice
 * before issuing a termination notice. Wrongful termination may expose the
 * issuing party to significant liability.
 */

import { calcGST, calcTotal, formatAUD, formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-contract-termination-counter';

function nextNoticeNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `CTN-${String(n).padStart(3, '0')}`;
}

const GROUNDS_LABELS = {
  'repudiation':          'Repudiation of contract by the client',
  'non-payment':          'Persistent non-payment of progress claims',
  'insolvency':           'Insolvency or bankruptcy of the client',
  'client-suspension':    'Client-directed suspension of works exceeding the contractual threshold',
  'material-breach':      'Material breach of contract following Notice to Show Cause'
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

  // ── Contract Details ─────────────────────────────────────────
  {
    id: 'recipientName',
    label: 'Recipient name',
    section: 'Contract Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. John Smith or ABC Pty Ltd',
    errorMsg: 'Recipient name is required'
  },
  {
    id: 'recipientEmail',
    label: 'Recipient email',
    section: 'Contract Details',
    type: 'email',
    width: 'half',
    required: false,
    placeholder: 'recipient@email.com'
  },
  {
    id: 'recipientAddress',
    label: 'Recipient address',
    section: 'Contract Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Recipient Street, Brisbane QLD 4000'
  },
  {
    id: 'projectName',
    label: 'Project name',
    section: 'Contract Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Smith Residence Renovation',
    errorMsg: 'Project name is required'
  },
  {
    id: 'siteAddress',
    label: 'Site address',
    section: 'Contract Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Project Street, Brisbane QLD 4000'
  },
  {
    id: 'contractRef',
    label: 'Contract reference',
    section: 'Contract Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. JOB-2026-014'
  },
  {
    id: 'contractDate',
    label: 'Contract date',
    section: 'Contract Details',
    type: 'date',
    width: 'half',
    required: false
  },

  // ── Grounds for Termination ──────────────────────────────────
  {
    id: 'noticeNumber',
    label: 'Notice number',
    section: 'Grounds for Termination',
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
    section: 'Grounds for Termination',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'groundsForTermination',
    label: 'Primary grounds for termination',
    section: 'Grounds for Termination',
    type: 'select',
    width: 'full',
    required: true,
    defaultValue: 'material-breach',
    options: [
      { value: 'repudiation',       label: 'Repudiation of contract by the client' },
      { value: 'non-payment',       label: 'Persistent non-payment of progress claims' },
      { value: 'insolvency',        label: 'Insolvency or bankruptcy of the client' },
      { value: 'client-suspension', label: 'Client-directed suspension exceeding contractual threshold' },
      { value: 'material-breach',   label: 'Material breach after Notice to Show Cause' }
    ],
    errorMsg: 'Select grounds for termination'
  },
  {
    id: 'groundsDetail',
    label: 'Detailed grounds and history',
    section: 'Grounds for Termination',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Provide a detailed, chronological account of the events leading to termination including prior attempts to resolve the matter.',
    errorMsg: 'Grounds detail is required'
  },
  {
    id: 'priorNoticeRef',
    label: 'Prior Notice to Show Cause reference (if any)',
    section: 'Grounds for Termination',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. NSC-001 dated 1 July 2026'
  },

  // ── Final Settlement ─────────────────────────────────────────
  {
    id: 'workValueCompleted',
    label: 'Value of work completed (excl. GST) $',
    section: 'Final Settlement',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Value of works completed as at termination date'
  },
  {
    id: 'amountOwing',
    label: 'Total amount outstanding (excl. GST) $',
    section: 'Final Settlement',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Unpaid claims including retention, loss and expense'
  },
  {
    id: 'gstApplicable',
    label: 'GST',
    section: 'Final Settlement',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Add 10% GST' },
      { value: 'no',  label: 'GST-free' }
    ]
  },
  {
    id: 'demandPaymentBy',
    label: 'Payment demanded by',
    section: 'Final Settlement',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Date by which final payment must be received'
  },
  {
    id: 'siteVacationDate',
    label: 'Site vacation date',
    section: 'Final Settlement',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Date builder will remove equipment and materials from site'
  },
  {
    id: 'builderApprovalName',
    label: 'Authorised by — name',
    section: 'Final Settlement',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'contract-termination',
  toolName:        'Contract Termination Notice',
  autosaveKey:     'bik-contract-termination-draft',
  docPrefix:       'CTN',
  aiFields:        ['groundsDetail'],
  printTitle:      'Contract Termination Notice',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Contract Termination Notice ${state.noticeNumber || '??'} — ${state.projectName || state.recipientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.noticeNumber || '??';
  }
};

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const hasGST         = data.gstApplicable === 'yes';
  const amountOwing    = parseFloat(data.amountOwing) || 0;
  const workValue      = parseFloat(data.workValueCompleted) || 0;
  const gstAmt         = calcGST(amountOwing, hasGST);
  const totalOwing     = calcTotal(amountOwing, hasGST);
  const hasFinancials  = amountOwing > 0 || workValue > 0;
  const hasContractRef = !!data.contractRef?.trim();
  const hasContractDate = !!data.contractDate;
  const hasPriorNotice = !!data.priorNoticeRef?.trim();
  const hasDemandDate  = !!data.demandPaymentBy;
  const hasVacDate     = !!data.siteVacationDate;
  const hasRecipientAddr = !!data.recipientAddress?.trim();
  const groundsLabel   = GROUNDS_LABELS[data.groundsForTermination] || esc(data.groundsForTermination || '—');

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Contract Termination Notice</h1>
      <div class="doc-subtitle">${esc(data.noticeNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div style="background:#fde8e8;border:2px solid #c0392b;border-radius:4px;padding:14px 16px;margin-bottom:20px;font-size:0.85rem;">
    <strong>⚠ CRITICAL LEGAL NOTICE — SEEK LEGAL ADVICE IMMEDIATELY</strong><br>
    Issuing a contract termination notice is a serious legal step. If you terminate a contract without proper grounds, you may be in breach of contract yourself and exposed to significant damages. Do not issue this notice without first obtaining independent legal advice from a qualified construction solicitor.
  </div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Terminating party</div>
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
        ${hasPriorNotice  ? `<tr><td>Prior notice</td><td>${esc(data.priorNoticeRef)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Notice of Termination</h2>
    <p>Take notice that <strong>${esc(data.builderName || '—')}</strong> hereby terminates the construction contract referenced above with <strong>immediate effect</strong> from the date of this notice.</p>
    <p><strong>Grounds for termination:</strong> ${groundsLabel}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Background and Grounds</h2>
    <p>${esc(data.groundsDetail || '—')}</p>
  </div>

  ${hasFinancials ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Financial Settlement Required</h2>
    <table class="doc-cost-table">
      <tbody>
        ${workValue > 0 ? `
        <tr>
          <td>Value of works completed (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(workValue)}</td>
        </tr>` : ''}
        ${amountOwing > 0 ? `
        <tr>
          <td>Total amount outstanding (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(amountOwing)}</td>
        </tr>
        ${hasGST ? `
        <tr>
          <td>GST (10%)</td>
          <td class="doc-cost-amount">${formatAUD(gstAmt)}</td>
        </tr>` : ''}
        <tr class="doc-cost-total">
          <td><strong>Total amount due and payable</strong></td>
          <td class="doc-cost-amount"><strong>${formatAUD(totalOwing)}</strong></td>
        </tr>` : ''}
      </tbody>
    </table>
    <p class="doc-cost-note">GST calculations are indicative only — not tax advice. Verify GST obligations with your accountant.</p>
    ${hasDemandDate ? `<p>Full payment of all outstanding amounts is required by <strong>${formatDateLong(data.demandPaymentBy)}</strong>.</p>` : ''}
  </div>` : ''}

  <div class="doc-section">
    <h2 class="doc-section-heading">Site and Materials</h2>
    ${hasVacDate ? `<p>The builder will arrange to remove all plant, equipment, and materials from the site by <strong>${formatDateLong(data.siteVacationDate)}</strong>.</p>` : '<p>The builder will make arrangements to remove all plant, equipment, and materials from the site at a mutually agreed time.</p>'}
    <p>All materials incorporated into the works and for which the builder has been paid remain the property of the client. All materials not yet incorporated and not yet paid for remain the property of the builder.</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Rights Reserved</h2>
    <p>The builder expressly reserves all rights and remedies available under the contract, at law, and in equity, including but not limited to claims for damages, loss of profit, and all costs incurred to the date of termination. Nothing in this notice is to be construed as a waiver of any such rights.</p>
    <p>If payment is not received as demanded, the builder will pursue all available remedies including proceedings under the applicable Security of Payment legislation and/or legal action for debt recovery.</p>
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
    <strong>Critical Legal Disclaimer:</strong> This document was generated from information supplied by the user and does not constitute legal advice. Terminating a construction contract without proper legal grounds may expose you to significant liability including damages for wrongful termination. BIK Solutions accepts no responsibility for any loss arising from the use of this document. Always obtain independent legal advice from a qualified construction solicitor before issuing a termination notice. GST calculations are indicative only and are not tax advice.
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
