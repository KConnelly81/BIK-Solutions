/**
 * Subcontractor Agreement — Tool Configuration
 * Simple subcontractor agreement / purchase order for trade work.
 */

import { calcGST, calcTotal, formatAUD, formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-subcontractor-agreement-counter';

function nextAgreementNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `SA-${String(n).padStart(3, '0')}`;
}

const PRICING_TYPE_LABELS = {
  'fixed':          'Fixed lump sum',
  'schedule':       'Schedule of rates',
  'cost-plus':      'Cost plus',
  'time-materials': 'Time and materials'
};

const PAYMENT_TERM_LABELS = {
  '7days':      '7 days from invoice',
  '14days':     '14 days from invoice',
  'milestone':  'Milestone-based (as per scope)',
  'per-head':   'Per head contract schedule'
};

export const SCHEMA = [

  // ── Your Business ────────────────────────────────────────────
  {
    id: 'builderName',
    label: 'Principal contractor — business name',
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

  // ── Subcontractor Details ────────────────────────────────────
  {
    id: 'subcontractorName',
    label: 'Subcontractor business name',
    section: 'Subcontractor Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Jones Plumbing Pty Ltd',
    errorMsg: 'Subcontractor name is required'
  },
  {
    id: 'subcontractorABN',
    label: 'Subcontractor ABN',
    section: 'Subcontractor Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: '98 765 432 109',
    inputmode: 'numeric'
  },
  {
    id: 'subcontractorPhone',
    label: 'Subcontractor phone',
    section: 'Subcontractor Details',
    type: 'tel',
    width: 'half',
    required: false,
    placeholder: '0411 111 111'
  },
  {
    id: 'subcontractorEmail',
    label: 'Subcontractor email',
    section: 'Subcontractor Details',
    type: 'email',
    width: 'half',
    required: false,
    placeholder: 'subcontractor@email.com',
    hint: 'Used for email workflow'
  },
  {
    id: 'subcontractorAddress',
    label: 'Subcontractor address',
    section: 'Subcontractor Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '789 Trade Street, Brisbane QLD 4000'
  },
  {
    id: 'subcontractorLicenceNo',
    label: 'Licence number',
    section: 'Subcontractor Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. QBCC Lic. 1234567'
  },
  {
    id: 'subcontractorInsurance',
    label: 'Public liability insurance',
    section: 'Subcontractor Details',
    type: 'text',
    width: 'full',
    required: false,
    placeholder: 'e.g. Public Liability $20M — Policy No. 123456 — Insurer: XYZ Insurance'
  },

  // ── Project Details ──────────────────────────────────────────
  {
    id: 'agreementNumber',
    label: 'Agreement number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextAgreementNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Agreement number is required'
  },
  {
    id: 'agreementDate',
    label: 'Agreement date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
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
    id: 'clientName',
    label: 'End client / owner',
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
    id: 'tradeType',
    label: 'Trade type',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Plumbing, Electrical, Concreting, Tiling',
    errorMsg: 'Trade type is required'
  },

  // ── Scope of Work ────────────────────────────────────────────
  {
    id: 'scopeOfWork',
    label: 'Scope of work',
    section: 'Scope of Work',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 6,
    placeholder: 'Describe in detail the work to be performed by the subcontractor. Be specific — this forms part of the agreement.',
    errorMsg: 'Scope of work is required'
  },
  {
    id: 'exclusions',
    label: 'Exclusions',
    section: 'Scope of Work',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List anything specifically excluded from the subcontractor\'s scope (e.g. "Excludes supply of materials", "Excludes backfilling").'
  },
  {
    id: 'startDate',
    label: 'Commencement date',
    section: 'Scope of Work',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'completionDate',
    label: 'Completion date',
    section: 'Scope of Work',
    type: 'date',
    width: 'half',
    required: false
  },

  // ── Commercial Terms ─────────────────────────────────────────
  {
    id: 'subcontractPrice',
    label: 'Subcontract price (excl. GST) $',
    section: 'Commercial Terms',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    errorMsg: 'Subcontract price is required'
  },
  {
    id: 'gstApplicable',
    label: 'GST',
    section: 'Commercial Terms',
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
    id: 'pricingType',
    label: 'Pricing type',
    section: 'Commercial Terms',
    type: 'radio',
    required: true,
    defaultValue: 'fixed',
    options: [
      { value: 'fixed',          label: 'Fixed lump sum' },
      { value: 'schedule',       label: 'Schedule of rates' },
      { value: 'cost-plus',      label: 'Cost plus' },
      { value: 'time-materials', label: 'Time and materials' }
    ],
    errorMsg: 'Select a pricing type'
  },
  {
    id: 'paymentTerms',
    label: 'Payment terms',
    section: 'Commercial Terms',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: '14days',
    options: [
      { value: '7days',     label: '7 days from invoice' },
      { value: '14days',    label: '14 days from invoice' },
      { value: 'milestone', label: 'Milestone-based' },
      { value: 'per-head',  label: 'Per head contract' }
    ]
  },
  {
    id: 'retentionRate',
    label: 'Retention',
    section: 'Commercial Terms',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: 'none',
    options: [
      { value: 'none', label: 'No retention' },
      { value: '2.5',  label: '2.5%' },
      { value: '5',    label: '5%' }
    ]
  },
  {
    id: 'defectsLiabilityPeriod',
    label: 'Defects liability period',
    section: 'Commercial Terms',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: '12 months',
    options: [
      { value: '3 months',  label: '3 months' },
      { value: '6 months',  label: '6 months' },
      { value: '12 months', label: '12 months' }
    ]
  },

  // ── Special Conditions ───────────────────────────────────────
  {
    id: 'specialConditions',
    label: 'Special conditions',
    section: 'Special Conditions',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Any special conditions, site-specific requirements, or additional obligations.'
  },

  // ── Approval ─────────────────────────────────────────────────
  {
    id: 'builderApprovalName',
    label: 'Principal contractor — authorised signatory',
    section: 'Approval',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  },
  {
    id: 'subcontractorApprovalName',
    label: 'Subcontractor — authorised signatory',
    section: 'Approval',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Pre-fills from subcontractor name'
  }

];

export const DOC_CONFIG = {
  toolId:          'subcontractor-agreement',
  toolName:        'Subcontractor Agreement',
  autosaveKey:     'bik-subcontractor-agreement-draft',
  docPrefix:       'SA',
  aiFields:        ['scopeOfWork', 'exclusions', 'specialConditions'],
  printTitle:      'Subcontractor Agreement',
  approvalEnabled: true,

  getDocTitle(state) {
    return `Subcontractor Agreement ${state.agreementNumber || '??'} — ${state.subcontractorName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.agreementNumber || '??';
  }
};

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const priceExcl     = parseFloat(data.subcontractPrice) || 0;
  const hasGST        = data.gstApplicable === 'yes';
  const gstAmt        = calcGST(priceExcl, hasGST);
  const totalPrice    = calcTotal(priceExcl, hasGST);

  const retentionRate  = data.retentionRate === 'none' ? 0 : (parseFloat(data.retentionRate) || 0);
  const retentionAmt   = retentionRate > 0 ? priceExcl * (retentionRate / 100) : 0;

  const pricingLabel   = PRICING_TYPE_LABELS[data.pricingType] || '';
  const paymentLabel   = PAYMENT_TERM_LABELS[data.paymentTerms] || '';

  const hasExclusions  = !!data.exclusions?.trim();
  const hasSpecial     = !!data.specialConditions?.trim();
  const hasStartDate   = !!data.startDate;
  const hasEndDate     = !!data.completionDate;
  const hasLicence     = !!data.subcontractorLicenceNo?.trim();
  const hasInsurance   = !!data.subcontractorInsurance?.trim();
  const hasClient      = !!data.clientName?.trim();
  const hasSubAddr     = !!data.subcontractorAddress?.trim();

  // Subcontractor approval name defaults to subcontractorName
  const subApprovalName = data.subcontractorApprovalName?.trim() || data.subcontractorName || 'Authorised Representative';

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Subcontractor Agreement</h1>
      <div class="doc-subtitle">${esc(data.agreementNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Principal contractor</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Subcontractor</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.subcontractorName || '—')}</div>
      ${data.subcontractorABN ? `<div class="doc-meta-value">ABN ${esc(data.subcontractorABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.subcontractorPhone ? `<div>${esc(data.subcontractorPhone)}</div>` : ''}
        ${data.subcontractorEmail ? `<div>${esc(data.subcontractorEmail)}</div>` : ''}
        ${hasSubAddr              ? `<div>${esc(data.subcontractorAddress)}</div>` : ''}
      </div>
      ${hasLicence   ? `<div class="doc-meta-value">Licence: ${esc(data.subcontractorLicenceNo)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Agreement details</div>
      <table class="doc-ref-table">
        <tr><td>Agreement no.</td><td>${esc(data.agreementNumber || '—')}</td></tr>
        <tr><td>Date</td><td>${formatDateLong(data.agreementDate) || '—'}</td></tr>
        <tr><td>Trade</td><td>${esc(data.tradeType || '—')}</td></tr>
        <tr><td>Project</td><td>${esc(data.projectName || '—')}</td></tr>
        ${hasClient    ? `<tr><td>Client</td><td>${esc(data.clientName)}</td></tr>` : ''}
        ${hasStartDate ? `<tr><td>Start date</td><td>${formatDateLong(data.startDate)}</td></tr>` : ''}
        ${hasEndDate   ? `<tr><td>Completion</td><td>${formatDateLong(data.completionDate)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Project Location</h2>
    <p>${data.siteAddress ? esc(data.siteAddress) : '—'}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Scope of Work</h2>
    <p>${esc(data.scopeOfWork || '—')}</p>
  </div>

  ${hasExclusions ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Exclusions</h2>
    <p>${esc(data.exclusions)}</p>
  </div>` : ''}

  <div class="doc-section">
    <h2 class="doc-section-heading">Commercial Terms</h2>
    <table class="doc-cost-table">
      <tbody>
        <tr>
          <td>Subcontract price (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(priceExcl)}</td>
        </tr>
        ${hasGST ? `
        <tr>
          <td>GST (10%)</td>
          <td class="doc-cost-amount">${formatAUD(gstAmt)}</td>
        </tr>
        <tr class="doc-cost-total">
          <td><strong>Total subcontract price (incl. GST)</strong></td>
          <td class="doc-cost-amount"><strong>${formatAUD(totalPrice)}</strong></td>
        </tr>` : `
        <tr class="doc-cost-total">
          <td><strong>Total subcontract price (GST-free)</strong></td>
          <td class="doc-cost-amount"><strong>${formatAUD(priceExcl)}</strong></td>
        </tr>`}
        <tr>
          <td>Pricing type</td>
          <td class="doc-cost-amount">${esc(pricingLabel)}</td>
        </tr>
        <tr>
          <td>Payment terms</td>
          <td class="doc-cost-amount">${esc(paymentLabel)}</td>
        </tr>
        ${retentionAmt > 0 ? `
        <tr>
          <td>Retention (${esc(data.retentionRate)}%)</td>
          <td class="doc-cost-amount">${formatAUD(retentionAmt)} (held until end of DLP)</td>
        </tr>` : `
        <tr>
          <td>Retention</td>
          <td class="doc-cost-amount">None</td>
        </tr>`}
        <tr>
          <td>Defects liability period</td>
          <td class="doc-cost-amount">${esc(data.defectsLiabilityPeriod || '—')}</td>
        </tr>
      </tbody>
    </table>
    <p class="doc-cost-note">GST calculations are indicative only — not tax advice. Verify GST obligations with your accountant.</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Insurance and WHS Obligations</h2>
    ${hasInsurance ? `<p><strong>Public liability insurance:</strong> ${esc(data.subcontractorInsurance)}</p>` : ''}
    <p>The subcontractor warrants that they hold and will maintain for the duration of this agreement:</p>
    <ul style="margin-left:20px;margin-top:8px;">
      <li>Public liability insurance — minimum $10,000,000 per occurrence</li>
      <li>Workers' compensation insurance as required by law</li>
      <li>All relevant licences and tickets for the work performed</li>
    </ul>
    <p>The subcontractor must comply with all applicable Work Health and Safety legislation, the principal contractor's site safety requirements, and any SWMS applicable to their work. The subcontractor is responsible for the safety of their own workers and must not allow unlicensed or unqualified persons to perform licensed or regulated work.</p>
  </div>

  ${hasSpecial ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Special Conditions</h2>
    <p>${esc(data.specialConditions)}</p>
  </div>` : ''}

  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Agreement and Signatures</h2>
    <p>By signing below, both parties acknowledge that they have read, understood, and agree to be bound by the terms of this Subcontractor Agreement.</p>

    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Principal Contractor — ${esc(data.builderName || '—')}</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.builderApprovalName || 'Authorised Representative')}</div>
          <div class="sig-name-label">Name and position</div>
        </div>
        <div class="sig-date-row">
          <div class="sig-date-label">Date</div>
          <div class="sig-date-line"></div>
        </div>
      </div>

      <div class="sig-block">
        <div class="sig-role">Subcontractor — ${esc(data.subcontractorName || '—')}</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(subApprovalName)}</div>
          <div class="sig-name-label">Name and position</div>
        </div>
        <div class="sig-date-row">
          <div class="sig-date-label">Date</div>
          <div class="sig-date-line"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="doc-disclaimer">
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. This agreement is a simple commercial document and may not be appropriate for complex or high-value subcontracts. It does not constitute legal advice. For significant subcontract arrangements, seek independent legal advice. Both parties should retain a signed copy. GST calculations are indicative only and are not tax advice.
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
