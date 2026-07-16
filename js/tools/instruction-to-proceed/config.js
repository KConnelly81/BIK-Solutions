/**
 * Instruction to Proceed — Tool Configuration
 */

import { formatAUD, formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-instruction-to-proceed-counter';

function nextITPNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'ITP-' + String(n).padStart(3, '0');
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

  // ── Recipient Details ───────────────────────────────────────
  {
    id: 'itpNumber',
    label: 'ITP number',
    section: 'Recipient Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextITPNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'ITP number is required'
  },
  {
    id: 'issueDate',
    label: 'Issue date',
    section: 'Recipient Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Issue date is required'
  },
  {
    id: 'recipientName',
    label: 'Recipient name',
    section: 'Recipient Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'Contact person name',
    errorMsg: 'Recipient name is required'
  },
  {
    id: 'recipientCompany',
    label: 'Recipient company',
    section: 'Recipient Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. ABC Electrical Pty Ltd'
  },
  {
    id: 'recipientPhone',
    label: 'Recipient phone',
    section: 'Recipient Details',
    type: 'tel',
    width: 'half',
    required: false,
    placeholder: '0400 000 000'
  },
  {
    id: 'recipientEmail',
    label: 'Recipient email',
    section: 'Recipient Details',
    type: 'email',
    width: 'half',
    required: false,
    placeholder: 'recipient@company.com.au'
  },

  // ── Project Details ─────────────────────────────────────────
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
    id: 'clientName',
    label: 'Client / principal name',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. John & Jane Smith'
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

  // ── Works Authorised ────────────────────────────────────────
  {
    id: 'authorisedWorks',
    label: 'Description of works authorised',
    section: 'Works Authorised',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Describe in detail the works authorised under this instruction. Be specific about scope, standards, and any relevant specifications.',
    errorMsg: 'Works description is required'
  },
  {
    id: 'startDate',
    label: 'Start date',
    section: 'Works Authorised',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'completionDate',
    label: 'Required completion date',
    section: 'Works Authorised',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'specialInstructions',
    label: 'Special instructions',
    section: 'Works Authorised',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any special conditions, site access requirements, safety obligations, or other instructions'
  },

  // ── Commercial Terms ────────────────────────────────────────
  {
    id: 'authorisedAmount',
    label: 'Authorised amount (excl. GST) $',
    section: 'Commercial Terms',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Leave blank if amount is per existing contract'
  },
  {
    id: 'gstApplicable',
    label: 'GST',
    section: 'Commercial Terms',
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
    id: 'budgetRef',
    label: 'Budget / quote reference',
    section: 'Commercial Terms',
    type: 'text',
    width: 'full',
    required: false,
    placeholder: 'e.g. Quote ref QT-2026-042 dated 1 January 2026'
  },

  // ── Approval ────────────────────────────────────────────────
  {
    id: 'builderApprovalName',
    label: 'Authorised by — name',
    section: 'Approval',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'instruction-to-proceed',
  toolName:        'Instruction to Proceed',
  autosaveKey:     'bik-instruction-to-proceed-draft',
  docPrefix:       'ITP',
  aiFields:        ['authorisedWorks', 'specialInstructions'],
  printTitle:      'Instruction to Proceed',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Instruction to Proceed ${state.itpNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.itpNumber || '??';
  }
};

export function generateDocument(data) {
  const hasBuilderContact = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const hasAmount         = !!data.authorisedAmount;
  const hasSpecial        = !!data.specialInstructions?.trim();
  const hasBudgetRef      = !!data.budgetRef?.trim();
  const amount            = parseFloat(data.authorisedAmount) || 0;
  const gst               = data.gstApplicable === 'yes' ? amount * 0.1 : 0;
  const total             = amount + gst;

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Instruction to Proceed</h1>
      <div class="doc-subtitle">${esc(data.itpNumber || '???')}</div>
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
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.recipientName || '—')}</div>
      ${data.recipientCompany ? `<div class="doc-meta-value">${esc(data.recipientCompany)}</div>` : ''}
      ${data.recipientPhone   ? `<div class="doc-meta-value">${esc(data.recipientPhone)}</div>`   : ''}
      ${data.recipientEmail   ? `<div class="doc-meta-value">${esc(data.recipientEmail)}</div>`   : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Reference</div>
      <table class="doc-ref-table">
        <tr><td>ITP no.</td><td>${esc(data.itpNumber || '—')}</td></tr>
        <tr><td>Date issued</td><td>${formatDateLong(data.issueDate) || '—'}</td></tr>
        ${data.contractRef  ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>`  : ''}
        ${data.projectName  ? `<tr><td>Project</td><td>${esc(data.projectName)}</td></tr>`         : ''}
        ${data.clientName   ? `<tr><td>Principal</td><td>${esc(data.clientName)}</td></tr>`        : ''}
        ${data.siteAddress  ? `<tr><td>Site</td><td>${esc(data.siteAddress)}</td></tr>`            : ''}
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  <!-- Authorisation statement -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Authorisation</h2>
    <p>You are hereby formally instructed and authorised to commence or continue the following works in accordance with the contract, applicable Australian Standards, and the requirements set out in this instruction.</p>
  </div>

  <!-- Works description -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Works Authorised</h2>
    <p>${esc(data.authorisedWorks || '—')}</p>
  </div>

  <!-- Dates -->
  ${data.startDate || data.completionDate ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Programme</h2>
    <table class="doc-ref-table">
      ${data.startDate      ? `<tr><td>Start date</td><td>${formatDateLong(data.startDate)}</td></tr>`           : ''}
      ${data.completionDate ? `<tr><td>Required completion</td><td>${formatDateLong(data.completionDate)}</td></tr>` : ''}
    </table>
  </div>` : ''}

  <!-- Commercial Terms -->
  ${hasAmount ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Authorised Amount</h2>
    <table class="doc-cost-table">
      <tbody>
        <tr><td>Amount excl. GST</td><td class="doc-cost-amount">${formatAUD(amount)}</td></tr>
        ${data.gstApplicable === 'yes'
          ? `<tr><td>GST (10%)</td><td class="doc-cost-amount">${formatAUD(gst)}</td></tr>
             <tr class="doc-cost-total"><td>Total incl. GST</td><td class="doc-cost-amount">${formatAUD(total)}</td></tr>`
          : `<tr><td>GST</td><td class="doc-cost-amount">Not applicable</td></tr>
             <tr class="doc-cost-total"><td>Total</td><td class="doc-cost-amount">${formatAUD(amount)}</td></tr>`
        }
      </tbody>
    </table>
    ${hasBudgetRef ? `<p style="margin-top:8px;">Budget / quote reference: <strong>${esc(data.budgetRef)}</strong></p>` : ''}
  </div>` : hasBudgetRef ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Commercial Reference</h2>
    <p>Budget / quote reference: <strong>${esc(data.budgetRef)}</strong></p>
  </div>` : ''}

  ${hasSpecial ? `
  <!-- Special Instructions -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Special Instructions</h2>
    <p>${esc(data.specialInstructions)}</p>
  </div>` : ''}

  <!-- Signature -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Authorised By</h2>

    <div class="sig-grid" style="grid-template-columns: 1fr;">
      <div class="sig-block">
        <div class="sig-role">Builder / Principal Contractor</div>
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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice and does not modify any contractual or statutory obligations. The issuing party remains responsible for ensuring compliance with all applicable laws, regulations, and contract requirements. GST amounts are indicative only and are not tax advice.
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
