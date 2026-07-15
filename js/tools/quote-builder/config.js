/**
 * Quote Builder — Tool Configuration
 */

import { calcGST, calcTotal, formatAUD, formatDateLong, todayISO, addDays } from '../../toolkit/calculator.js';

// ── Counter ──────────────────────────────────────────────────
const COUNTER_KEY = 'bik-quote-counter';
function nextQuoteNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return String(n).padStart(3, '0');
}

// ── Schema ───────────────────────────────────────────────────
export const SCHEMA = [

  // ── Your Business (profile) ──────────────────────────────────
  {
    id: 'builderName',    label: 'Business / trading name',
    section: 'Your Business', type: 'text', width: 'half',
    required: true, profile: true, placeholder: 'e.g. Smith Building Pty Ltd',
    autocomplete: 'organization', errorMsg: 'Business name is required'
  },
  {
    id: 'builderABN',     label: 'ABN',
    section: 'Your Business', type: 'text', width: 'half',
    required: false, profile: true, placeholder: '12 345 678 901',
    hint: 'Australian Business Number', inputmode: 'numeric'
  },
  {
    id: 'builderLicence', label: 'Licence number (QBCC / BSA)',
    section: 'Your Business', type: 'text', width: 'half',
    required: false, profile: true, placeholder: 'e.g. 1234567'
  },
  {
    id: 'builderPhone',   label: 'Phone',
    section: 'Your Business', type: 'tel', width: 'half',
    required: false, profile: true, placeholder: '0400 000 000', autocomplete: 'tel'
  },
  {
    id: 'builderEmail',   label: 'Email',
    section: 'Your Business', type: 'email', width: 'half',
    required: false, profile: true, placeholder: 'you@yourbusiness.com.au', autocomplete: 'email'
  },
  {
    id: 'builderAddress', label: 'Business address',
    section: 'Your Business', type: 'textarea', width: 'full',
    required: false, profile: true, rows: 2,
    placeholder: '123 Example Street, Brisbane QLD 4000',
    hint: 'Saved for future documents'
  },

  // ── Client ────────────────────────────────────────────────────
  {
    id: 'clientName',    label: 'Client name',
    section: 'Client Details', type: 'text', width: 'half',
    required: true, placeholder: 'e.g. John & Jane Smith', errorMsg: 'Client name is required'
  },
  {
    id: 'clientEmail',   label: 'Client email',
    section: 'Client Details', type: 'email', width: 'half',
    required: false, placeholder: 'client@email.com'
  },
  {
    id: 'clientPhone',   label: 'Client phone',
    section: 'Client Details', type: 'tel', width: 'half',
    required: false, placeholder: '0400 000 000'
  },
  {
    id: 'clientAddress', label: 'Client / project address',
    section: 'Client Details', type: 'textarea', width: 'full',
    required: false, rows: 2, placeholder: '456 Project Street, Brisbane QLD 4000'
  },

  // ── Quote Details ─────────────────────────────────────────────
  {
    id: 'quoteNumber',   label: 'Quote number',
    section: 'Quote Details', type: 'text', width: 'half',
    required: true, defaultValue: nextQuoteNumber,
    hint: 'Auto-incremented. Edit if needed.', errorMsg: 'Quote number is required'
  },
  {
    id: 'projectName',   label: 'Project name',
    section: 'Quote Details', type: 'text', width: 'half',
    required: true, placeholder: 'e.g. Smith Residence Renovation', errorMsg: 'Project name is required'
  },
  {
    id: 'quoteDate',     label: 'Quote date',
    section: 'Quote Details', type: 'date', width: 'half',
    required: true, defaultValue: todayISO, errorMsg: 'Quote date is required'
  },
  {
    id: 'validUntil',    label: 'Valid until',
    section: 'Quote Details', type: 'date', width: 'half',
    required: false, defaultValue: () => addDays(todayISO(), 30),
    hint: 'Quote expires on this date'
  },
  {
    id: 'quoteType',     label: 'Quote type',
    section: 'Quote Details', type: 'radio',
    required: true, defaultValue: 'fixed',
    options: [
      { value: 'fixed',    label: 'Fixed price' },
      { value: 'estimate', label: 'Estimate (subject to final measurement)' },
      { value: 'cost-plus', label: 'Cost plus (time & materials)' }
    ],
    errorMsg: 'Select a quote type'
  },

  // ── Scope of Works ────────────────────────────────────────────
  {
    id: 'scopeOfWorks',  label: 'Scope of works',
    section: 'Scope of Works', type: 'textarea', width: 'full',
    required: true, rows: 6,
    placeholder: 'Describe in detail the work to be performed under this quote. Be specific about what is included.',
    errorMsg: 'Scope of works is required'
  },
  {
    id: 'inclusions',    label: 'Inclusions',
    section: 'Scope of Works', type: 'textarea', width: 'full',
    required: false, rows: 4,
    placeholder: 'List what is specifically included in this quote (e.g. supply and install all materials, council fees, soil tests)'
  },
  {
    id: 'exclusions',    label: 'Exclusions',
    section: 'Scope of Works', type: 'textarea', width: 'full',
    required: false, rows: 4,
    placeholder: 'List what is specifically NOT included (e.g. painting, landscaping, appliances, council application fees)'
  },
  {
    id: 'assumptions',   label: 'Assumptions',
    section: 'Scope of Works', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'List assumptions made when preparing this quote (e.g. existing structure is sound, no asbestos present, site access is available)'
  },

  // ── Optional Items ────────────────────────────────────────────
  {
    id: 'optionalItems', label: 'Optional extras',
    section: 'Optional Items', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'List any optional items the client may add (include pricing for each optional item)'
  },

  // ── Terms ─────────────────────────────────────────────────────
  {
    id: 'depositPercent', label: 'Deposit required',
    section: 'Terms', type: 'select', width: 'half',
    required: false, defaultValue: '10',
    options: [
      { value: '0',   label: 'No deposit' },
      { value: '5',   label: '5%' },
      { value: '10',  label: '10%' },
      { value: '20',  label: '20%' },
      { value: '25',  label: '25%' },
      { value: '50',  label: '50%' }
    ]
  },
  {
    id: 'paymentTerms',  label: 'Payment terms',
    section: 'Terms', type: 'select', width: 'half',
    required: false, defaultValue: '14days-invoice',
    options: [
      { value: '7days-invoice',    label: '7 days from invoice date' },
      { value: '14days-invoice',   label: '14 days from invoice date' },
      { value: '30days-invoice',   label: '30 days from invoice date' },
      { value: 'progress-claims',  label: 'Progress claims per schedule' },
      { value: 'on-completion',    label: 'On practical completion' },
      { value: 'per-contract',     label: 'As per contract schedule' }
    ]
  },
  {
    id: 'additionalTerms', label: 'Additional terms and conditions',
    section: 'Terms', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'Any additional terms, special conditions, or standard inclusions (e.g. variations to be instructed in writing, insurance requirements)'
  },

  // ── Approval ─────────────────────────────────────────────────
  {
    id: 'builderApprovalName', label: 'Builder / authorised representative',
    section: 'Approval', type: 'text', width: 'half',
    required: false, profile: true, placeholder: 'Authorised person name'
  }
];

// ── Tool configuration ────────────────────────────────────────

export const DOC_CONFIG = {
  toolId:      'quote-builder',
  toolName:    'Quote',
  autosaveKey: 'bik-quote-draft',
  docPrefix:   'Q',
  aiFields:    ['scopeOfWorks', 'inclusions', 'exclusions', 'assumptions'],
  printTitle:  'Quote',

  getDocTitle(state) {
    return `Quote Q-${state.quoteNumber || '??'} — ${state.projectName || state.clientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return `Q-${state.quoteNumber || '??'}`;
  }
};

// ── Document template ─────────────────────────────────────────

const QUOTE_TYPE_LABELS = {
  fixed:    'Fixed price',
  estimate: 'Estimate — subject to final measurement',
  'cost-plus': 'Cost plus — time and materials'
};

const PAYMENT_LABELS = {
  '7days-invoice':   '7 days from invoice date',
  '14days-invoice':  '14 days from invoice date',
  '30days-invoice':  '30 days from invoice date',
  'progress-claims': 'Progress claims per agreed schedule',
  'on-completion':   'On practical completion',
  'per-contract':    'As per contract schedule'
};

export function generateDocument(data) {
  const extra      = data._extra || {};
  const lineItems  = extra.lineItems || [];
  const subtotal   = extra.subtotal  || 0;
  const gstAmt     = extra.gst       || 0;
  const total      = extra.total     || 0;
  const hasItems   = lineItems.some(it => it.description?.trim());

  const depositPct = parseInt(data.depositPercent, 10) || 0;
  const depositAmt = depositPct > 0 ? (total * depositPct / 100) : 0;

  const hasContact  = !!(data.builderPhone || data.builderEmail);
  const hasExcl     = !!data.exclusions?.trim();
  const hasAssump   = !!data.assumptions?.trim();
  const hasIncl     = !!data.inclusions?.trim();
  const hasOptional = !!data.optionalItems?.trim();
  const hasTerms    = !!data.additionalTerms?.trim();
  const quoteLabel  = QUOTE_TYPE_LABELS[data.quoteType] || '';
  const pmtLabel    = PAYMENT_LABELS[data.paymentTerms] || '';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Quote</h1>
      <div class="doc-subtitle">Q&ndash;${esc(data.quoteNumber || '???')}</div>
    </div>
  </div>
  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Prepared by</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      ${data.builderLicence ? `<div class="doc-meta-value">Licence ${esc(data.builderLicence)}</div>` : ''}
      ${hasContact ? `<div class="doc-meta-contact">
        ${data.builderPhone ? `<div>${esc(data.builderPhone)}</div>` : ''}
        ${data.builderEmail ? `<div>${esc(data.builderEmail)}</div>` : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Prepared for</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      ${data.clientPhone ? `<div class="doc-meta-value">${esc(data.clientPhone)}</div>` : ''}
      ${data.clientEmail ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>` : ''}
      ${data.clientAddress ? `<div class="doc-meta-value">${esc(data.clientAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Quote details</div>
      <table class="doc-ref-table">
        <tr><td>Quote no.</td><td>${esc(data.quoteNumber || '—')}</td></tr>
        <tr><td>Project</td><td>${esc(data.projectName || '—')}</td></tr>
        <tr><td>Date issued</td><td>${formatDateLong(data.quoteDate) || '—'}</td></tr>
        ${data.validUntil ? `<tr><td>Valid until</td><td>${formatDateLong(data.validUntil)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <!-- Scope -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Scope of Works</h2>
    <p>${esc(data.scopeOfWorks || '—')}</p>
  </div>

  ${hasIncl ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Inclusions</h2>
    <p>${esc(data.inclusions)}</p>
  </div>` : ''}

  ${hasExcl ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Exclusions</h2>
    <p>${esc(data.exclusions)}</p>
  </div>` : ''}

  ${hasAssump ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Assumptions</h2>
    <p>${esc(data.assumptions)}</p>
  </div>` : ''}

  <!-- Pricing -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Pricing</h2>

    ${hasItems ? `
    <table class="doc-line-items-table">
      <thead>
        <tr>
          <th class="dli-desc">Description</th>
          <th class="dli-qty">Qty</th>
          <th class="dli-unit">Unit</th>
          <th class="dli-price">Unit price</th>
          <th class="dli-gst">GST</th>
          <th class="dli-total">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.filter(it => it.description?.trim()).map(it => `
        <tr>
          <td class="dli-desc">${esc(it.description)}</td>
          <td class="dli-qty">${it.qty}</td>
          <td class="dli-unit">${esc(it.unit || 'item')}</td>
          <td class="dli-price">${formatAUD(it.unitPrice)}</td>
          <td class="dli-gst">${it.gst ? '10%' : '—'}</td>
          <td class="dli-total">${formatAUD(it.lineTotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}

    <table class="doc-cost-table">
      <tbody>
        <tr><td>Subtotal (excl. GST)</td><td class="doc-cost-amount">${formatAUD(subtotal)}</td></tr>
        <tr><td>GST (10%)</td><td class="doc-cost-amount">${formatAUD(gstAmt)}</td></tr>
        <tr class="doc-cost-total"><td>Total (incl. GST)</td><td class="doc-cost-amount">${formatAUD(total)}</td></tr>
        ${depositPct > 0 ? `<tr><td>Deposit required (${depositPct}%)</td><td class="doc-cost-amount">${formatAUD(depositAmt)}</td></tr>` : ''}
      </tbody>
    </table>

    <div class="doc-cost-type">Quote type: <strong>${quoteLabel}</strong></div>
    ${pmtLabel ? `<div class="doc-cost-terms">Payment terms: ${pmtLabel}</div>` : ''}
  </div>

  ${hasOptional ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Optional Extras</h2>
    <p>${esc(data.optionalItems)}</p>
  </div>` : ''}

  ${hasTerms ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Terms and Conditions</h2>
    <p>${esc(data.additionalTerms)}</p>
  </div>` : ''}

  <!-- Acceptance -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Acceptance</h2>
    <p class="doc-approval-instruction">
      By signing below, the client accepts this quote and authorises the builder to proceed with the works
      as described. This quote is valid until ${data.validUntil ? formatDateLong(data.validUntil) : '30 days from the date of issue'}.
    </p>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Builder / Contractor</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.builderApprovalName || 'Authorised Representative')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row"><div class="sig-date-label">Date</div><div class="sig-date-line"></div></div>
      </div>
      <div class="sig-block">
        <div class="sig-role">Client</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.clientName || 'Client Signature')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row"><div class="sig-date-label">Date</div><div class="sig-date-line"></div></div>
      </div>
    </div>
  </div>

  <div class="doc-disclaimer">
    <strong>Important:</strong> This quote is prepared based on information available at the time of issue.
    The builder reserves the right to adjust pricing if site conditions differ materially from those assumed,
    or if the client requests changes to the scope of works. This document does not constitute a contract
    until signed by both parties. GST calculations are indicative only and are not tax advice.
  </div>

  <div class="doc-footer">
    Generated with BIK Business Toolkit &mdash; biksolutions.com.au &nbsp;|&nbsp; Generated ${formatDateLong(todayISO())}
  </div>

</div>`.trim();
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}
