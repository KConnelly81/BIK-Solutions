/**
 * Payment Reminder — Tool Configuration
 * Professional payment reminder letter with three escalation levels.
 */

import { calcGST, calcTotal, formatAUD, formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-payment-reminder-counter';

function nextReminderNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `PR-${String(n).padStart(3, '0')}`;
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

  // ── Client Details ───────────────────────────────────────────
  {
    id: 'clientName',
    label: 'Client name',
    section: 'Client Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. John & Jane Smith',
    errorMsg: 'Client name is required'
  },
  {
    id: 'clientEmail',
    label: 'Client email',
    section: 'Client Details',
    type: 'email',
    width: 'half',
    required: false,
    placeholder: 'client@email.com',
    hint: 'Used for email workflow'
  },
  {
    id: 'clientAddress',
    label: 'Client address',
    section: 'Client Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Client Street, Brisbane QLD 4000'
  },
  {
    id: 'projectName',
    label: 'Project name',
    section: 'Client Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Smith Residence Renovation'
  },
  {
    id: 'siteAddress',
    label: 'Site address',
    section: 'Client Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Project Street, Brisbane QLD 4000'
  },

  // ── Invoice Details ──────────────────────────────────────────
  {
    id: 'reminderNumber',
    label: 'Reminder reference number',
    section: 'Invoice Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextReminderNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Reference number is required'
  },
  {
    id: 'reminderDate',
    label: 'Reminder date',
    section: 'Invoice Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'invoiceRef',
    label: 'Invoice / claim number',
    section: 'Invoice Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. INV-001, PC-003',
    errorMsg: 'Invoice reference is required'
  },
  {
    id: 'invoiceDate',
    label: 'Invoice date',
    section: 'Invoice Details',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Date the original invoice was issued'
  },
  {
    id: 'invoiceAmount',
    label: 'Invoice amount (excl. GST) $',
    section: 'Invoice Details',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    errorMsg: 'Invoice amount is required'
  },
  {
    id: 'gstApplicable',
    label: 'GST',
    section: 'Invoice Details',
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
    id: 'daysPastDue',
    label: 'Days overdue',
    section: 'Invoice Details',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0',
    min: 0,
    step: 1,
    inputmode: 'numeric',
    hint: 'How many days past the due date'
  },

  // ── Reminder Level ───────────────────────────────────────────
  {
    id: 'reminderLevel',
    label: 'Reminder level',
    section: 'Reminder Level',
    type: 'radio',
    required: true,
    defaultValue: 'first',
    options: [
      { value: 'first',  label: 'First reminder — friendly' },
      { value: 'second', label: 'Second reminder — firm' },
      { value: 'final',  label: 'Final notice — legal' }
    ],
    errorMsg: 'Select a reminder level'
  },
  {
    id: 'paymentMethods',
    label: 'Payment methods / banking details',
    section: 'Reminder Level',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'e.g. BSB 062-000 / Account 12345678 / Account name: Smith Building Pty Ltd\nPayID: you@yourbusiness.com.au'
  },
  {
    id: 'contactForQueries',
    label: 'Contact for payment queries',
    section: 'Reminder Level',
    type: 'text',
    width: 'full',
    required: false,
    placeholder: 'e.g. Jane Smith — 0400 000 000 — jane@smithbuilding.com.au'
  },
  {
    id: 'builderApprovalName',
    label: 'Authorised by — name',
    section: 'Reminder Level',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'payment-reminder',
  toolName:        'Payment Reminder',
  autosaveKey:     'bik-payment-reminder-draft',
  docPrefix:       'PR',
  aiFields:        [],
  printTitle:      'Payment Reminder',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Payment Reminder ${state.reminderNumber || '??'} — ${state.clientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.reminderNumber || '??';
  }
};

// ── Reminder level content ───────────────────────────────────

function getLevelLabel(level) {
  switch (level) {
    case 'second': return 'SECOND REMINDER';
    case 'final':  return 'FINAL NOTICE — LEGAL ACTION PENDING';
    default:       return 'PAYMENT REMINDER';
  }
}

function getBodyParagraphs(data, amountExcl, amountTotal, hasGST) {
  const inv    = esc(data.invoiceRef || 'the above invoice');
  const client = esc(data.clientName || 'you');
  const days   = parseInt(data.daysPastDue, 10) || 0;
  const daysStr = days > 0 ? ` This invoice is now <strong>${days} days overdue</strong>.` : '';
  const total  = `<strong>${formatAUD(amountTotal)}</strong>`;
  const project = data.projectName ? ` for ${esc(data.projectName)}` : '';

  switch (data.reminderLevel) {
    case 'second':
      return `
        <p>We refer to the above invoice ${inv}${project} for the amount of ${total} (${hasGST ? 'incl. GST' : 'excl. GST'}), which remains unpaid.${daysStr}</p>
        <p>Despite our previous reminder, payment has not been received. We request that you arrange payment of the outstanding amount within <strong>7 days</strong> of the date of this letter.</p>
        <p>If payment has already been made, please disregard this notice and forward remittance advice to the contact details below. If you have a query regarding this invoice, please contact us immediately so that we may resolve the matter.</p>
        <p>Should payment not be received within 7 days, we reserve the right to take further action to recover the outstanding amount without further notice.</p>`;
    case 'final':
      return `
        <p>We refer to the above invoice ${inv}${project} for the amount of ${total} (${hasGST ? 'incl. GST' : 'excl. GST'}), which remains unpaid.${daysStr}</p>
        <p>Despite repeated reminders, payment has not been received. This is our <strong>final notice</strong> before we commence formal recovery proceedings.</p>
        <p>Unless full payment is received within <strong>7 days</strong> of the date of this notice, we will exercise our rights under the <strong>Building and Construction Industry Payments Act 2004 (Qld) / Security of Payment Act</strong> (as applicable), and/or refer this matter to our solicitors for debt recovery proceedings including an adjudication application.</p>
        <p>You may also be liable for our costs of recovery, including legal fees and adjudication costs, in addition to the outstanding principal amount.</p>
        <p>We urge you to treat this matter as urgent. If you wish to discuss a payment arrangement, contact us immediately at the details below.</p>`;
    default:
      return `
        <p>We write to remind ${client} that the above invoice ${inv}${project} for the amount of ${total} (${hasGST ? 'incl. GST' : 'excl. GST'}) remains outstanding.${daysStr}</p>
        <p>Please arrange payment at your earliest convenience using the payment details provided below. If payment has already been made, please accept our thanks and disregard this notice.</p>
        <p>If you have any queries regarding this invoice, please do not hesitate to contact us.</p>`;
  }
}

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const amountExcl  = parseFloat(data.invoiceAmount) || 0;
  const hasGST      = data.gstApplicable === 'yes';
  const gstAmt      = calcGST(amountExcl, hasGST);
  const amountTotal = calcTotal(amountExcl, hasGST);

  const hasInvoiceDate   = !!data.invoiceDate;
  const hasClientAddr    = !!data.clientAddress?.trim();
  const hasPaymentMethods = !!data.paymentMethods?.trim();
  const hasContact       = !!data.contactForQueries?.trim();
  const hasProject       = !!data.projectName?.trim();
  const hasDays          = !!(parseInt(data.daysPastDue, 10) > 0);
  const levelLabel       = getLevelLabel(data.reminderLevel);
  const isLegal          = data.reminderLevel === 'final';

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">${levelLabel}</h1>
      <div class="doc-subtitle">${esc(data.reminderNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  ${isLegal ? `
  <div style="background:#fff3cd;border:2px solid #e6a817;border-radius:4px;padding:12px 16px;margin-bottom:20px;font-size:0.85rem;">
    <strong>⚠ Legal Notice:</strong> This is a final payment notice. Seek legal advice before issuing if you are unsure of your rights under the applicable Security of Payment legislation.
  </div>` : ''}

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">From</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">To</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      ${data.clientEmail ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>` : ''}
      ${hasClientAddr    ? `<div class="doc-meta-value">${esc(data.clientAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Invoice details</div>
      <table class="doc-ref-table">
        <tr><td>Reminder ref.</td><td>${esc(data.reminderNumber || '—')}</td></tr>
        <tr><td>Date</td><td>${formatDateLong(data.reminderDate) || '—'}</td></tr>
        <tr><td>Invoice no.</td><td>${esc(data.invoiceRef || '—')}</td></tr>
        ${hasInvoiceDate ? `<tr><td>Invoice date</td><td>${formatDateLong(data.invoiceDate)}</td></tr>` : ''}
        ${hasProject     ? `<tr><td>Project</td><td>${esc(data.projectName)}</td></tr>` : ''}
        ${hasDays        ? `<tr><td>Days overdue</td><td>${esc(data.daysPastDue)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Outstanding Amount</h2>
    <table class="doc-cost-table">
      <tbody>
        <tr>
          <td>Invoice amount (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(amountExcl)}</td>
        </tr>
        ${hasGST ? `
        <tr>
          <td>GST (10%)</td>
          <td class="doc-cost-amount">${formatAUD(gstAmt)}</td>
        </tr>` : ''}
        <tr class="doc-cost-total">
          <td><strong>Total amount outstanding</strong></td>
          <td class="doc-cost-amount"><strong>${formatAUD(amountTotal)}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="doc-section">
    ${getBodyParagraphs(data, amountExcl, amountTotal, hasGST)}
  </div>

  ${hasPaymentMethods ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Payment Details</h2>
    <p>${esc(data.paymentMethods)}</p>
  </div>` : ''}

  ${hasContact ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Contact for Payment Queries</h2>
    <p>${esc(data.contactForQueries)}</p>
  </div>` : ''}

  <div class="doc-section">
    <p>Yours faithfully,</p>
    <br>
    <div class="sig-line" style="width:200px;border-bottom:1px solid #333;margin-bottom:4px;height:40px;"></div>
    <p><strong>${esc(data.builderApprovalName || data.builderName || '—')}</strong><br>
    ${esc(data.builderName || '')}<br>
    ${formatDateLong(data.reminderDate) || ''}</p>
  </div>

  <div class="doc-disclaimer">
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice and does not guarantee any specific legal outcome. For significant debt recovery matters, seek independent legal advice. GST calculations are indicative only and are not tax advice.
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
