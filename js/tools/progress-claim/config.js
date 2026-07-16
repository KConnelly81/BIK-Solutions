/**
 * Progress Claim — Tool Configuration
 * Structured draft progress claim for Australian construction payment claims.
 * Not a compliant or certified payment claim system. Users must verify the
 * applicable state/territory legislation before issuing any payment claim.
 */

import { calcGST, calcTotal, formatAUD, formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-progress-claim-counter';

function nextClaimNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `PC-${String(n).padStart(3, '0')}`;
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
    label: 'Contract / job reference',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. JOB-2026-014'
  },

  // ── Claim Details ────────────────────────────────────────────
  {
    id: 'claimNumber',
    label: 'Claim number',
    section: 'Claim Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextClaimNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Claim number is required'
  },
  {
    id: 'claimDate',
    label: 'Claim date',
    section: 'Claim Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Claim date is required'
  },
  {
    id: 'claimPeriodFrom',
    label: 'Claim period — from',
    section: 'Claim Details',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'claimPeriodTo',
    label: 'Claim period — to',
    section: 'Claim Details',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'contractValue',
    label: 'Contract value (excl. GST) $',
    section: 'Claim Details',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Total contract price',
    errorMsg: 'Contract value is required'
  },
  {
    id: 'previouslyClaimed',
    label: 'Previously claimed (excl. GST) $',
    section: 'Claim Details',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Total of all prior claims',
    errorMsg: 'Enter previous claims (use 0 for first claim)'
  },
  {
    id: 'thisClaimAmount',
    label: 'This claim amount (excl. GST) $',
    section: 'Claim Details',
    type: 'number',
    width: 'half',
    required: true,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Value of work done this period',
    errorMsg: 'Claim amount is required'
  },
  {
    id: 'gstApplicable',
    label: 'GST',
    section: 'Claim Details',
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
    id: 'percentComplete',
    label: 'Percentage of works complete (%)',
    section: 'Claim Details',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0',
    min: 0,
    step: 1,
    inputmode: 'numeric',
    hint: 'Overall percentage complete at claim date'
  },
  {
    id: 'retentionRate',
    label: 'Retention rate',
    section: 'Claim Details',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: '5',
    options: [
      { value: '0',      label: 'No retention (0%)' },
      { value: '2.5',    label: '2.5%' },
      { value: '5',      label: '5% (standard)' },
      { value: '10',     label: '10%' },
      { value: 'custom', label: 'Custom amount' }
    ]
  },
  {
    id: 'retentionCustom',
    label: 'Retention amount (excl. GST) $',
    section: 'Claim Details',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    inputmode: 'decimal',
    hint: 'Only required if "Custom amount" selected above'
  },

  // ── Schedule of Values ───────────────────────────────────────
  {
    id: 'descriptionOfWork',
    label: 'Description of works completed this period',
    section: 'Schedule of Values',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 4,
    placeholder: 'Describe the work completed during this claim period.',
    errorMsg: 'Description of works is required'
  },
  {
    id: 'scheduleOfValues',
    label: 'Schedule of values / line items',
    section: 'Schedule of Values',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 6,
    placeholder: 'List line items, e.g.:\nFoundations — $25,000\nFraming — $18,500\nRoofing — $12,000'
  },

  // ── Supporting Documents ─────────────────────────────────────
  {
    id: 'specialConditions',
    label: 'Special conditions / legislative notes',
    section: 'Supporting Documents',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'e.g. BIF Act 2017 (Qld), Security of Payment Act (NSW/Vic/SA), any special claim conditions'
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
  toolId:          'progress-claim',
  toolName:        'Progress Claim',
  autosaveKey:     'bik-progress-claim-draft',
  docPrefix:       'PC',
  aiFields:        ['descriptionOfWork', 'scheduleOfValues'],
  printTitle:      'Progress Claim',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Progress Claim ${state.claimNumber || '??'} — ${state.projectName || state.clientName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.claimNumber || '??';
  },
  onCalcUpdate(state, engine, $) {
    const calcSummary = $('calc-summary');
    if (!calcSummary) return;
    const amount   = parseFloat(state.thisClaimAmount) || 0;
    const hasGST   = state.gstApplicable === 'yes';
    const gst      = calcGST(amount, hasGST);
    const total    = calcTotal(amount, hasGST);
    const exclEl   = $('calc-excl');
    const gstEl    = $('calc-gst');
    const totalEl  = $('calc-total');
    if (exclEl)   exclEl.textContent   = formatAUD(amount);
    if (gstEl)    gstEl.textContent    = hasGST ? formatAUD(gst) : 'Not applicable';
    if (totalEl)  totalEl.textContent  = formatAUD(total);
    calcSummary.hidden = false;
  }
};

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const contractVal    = parseFloat(data.contractValue)    || 0;
  const prevClaimed    = parseFloat(data.previouslyClaimed) || 0;
  const thisClaim      = parseFloat(data.thisClaimAmount)  || 0;
  const hasGST         = data.gstApplicable === 'yes';

  // Calculate retention
  let retentionAmt = 0;
  if (data.retentionRate === 'custom') {
    retentionAmt = parseFloat(data.retentionCustom) || 0;
  } else {
    const rate = parseFloat(data.retentionRate) || 0;
    retentionAmt = thisClaim * (rate / 100);
  }

  const netPayable     = thisClaim - retentionAmt;
  const gstAmt         = calcGST(netPayable, hasGST);
  const totalPayable   = calcTotal(netPayable, hasGST);

  const hasSchedule    = !!data.scheduleOfValues?.trim();
  const hasSpecial     = !!data.specialConditions?.trim();
  const hasPeriod      = !!(data.claimPeriodFrom || data.claimPeriodTo);
  const hasPercent     = !!(data.percentComplete);
  const hasContractRef = !!data.contractRef?.trim();

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Progress Claim</h1>
      <div class="doc-subtitle">${esc(data.claimNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Claimant</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Respondent</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      ${data.clientEmail ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>` : ''}
      <div class="doc-meta-value">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Claim details</div>
      <table class="doc-ref-table">
        <tr><td>Claim date</td><td>${formatDateLong(data.claimDate) || '—'}</td></tr>
        <tr><td>Claim no.</td><td>${esc(data.claimNumber || '—')}</td></tr>
        ${hasContractRef ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
        ${hasPeriod ? `<tr><td>Period from</td><td>${formatDateLong(data.claimPeriodFrom) || '—'}</td></tr>` : ''}
        ${hasPeriod ? `<tr><td>Period to</td><td>${formatDateLong(data.claimPeriodTo) || '—'}</td></tr>` : ''}
        ${hasPercent ? `<tr><td>% complete</td><td>${esc(data.percentComplete)}%</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Payment Claim — Jurisdiction Notice</h2>
    <p>Security of payment legislation varies by state and territory. The legislation applicable to this claim depends on the location of the work and the contract. The claimant is responsible for confirming the applicable Act before issuing this claim.</p>
    <table class="doc-ref-table" style="margin-top:8px;">
      <tr><td>Queensland</td><td>Building Industry Fairness (Security of Payment) Act 2017 (BIF Act)</td></tr>
      <tr><td>New South Wales</td><td>Building and Construction Industry Security of Payment Act 1999</td></tr>
      <tr><td>Victoria</td><td>Building and Construction Industry Security of Payment Act 2002</td></tr>
      <tr><td>South Australia</td><td>Building and Construction Industry Security of Payment Act 2009</td></tr>
      <tr><td>Western Australia</td><td>Construction Contracts Act 2004</td></tr>
      <tr><td>Tasmania / NT / ACT</td><td>State-specific security of payment legislation applies</td></tr>
    </table>
    <p style="margin-top:8px;font-size:0.85em;color:#555;">In Queensland, subcontractor claims to a head contractor may require a supporting statement under s.77 of the BIF Act 2017. Verify whether a supporting statement is required before issuing this claim. The respondent must respond within the time prescribed under the applicable Act. Failure to provide a payment schedule may result in the claimed amount becoming a debt due and payable — verify the applicable response period with the relevant Act or a construction lawyer.</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Contract Summary</h2>
    <table class="doc-cost-table">
      <tbody>
        <tr>
          <td>Original contract value (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(contractVal)}</td>
        </tr>
        <tr>
          <td>Previously claimed (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(prevClaimed)}</td>
        </tr>
        <tr>
          <td>This claim amount (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(thisClaim)}</td>
        </tr>
        ${retentionAmt > 0 ? `
        <tr>
          <td>Less: Retention</td>
          <td class="doc-cost-amount">(${formatAUD(retentionAmt)})</td>
        </tr>` : ''}
        <tr>
          <td>Net amount claimed (excl. GST)</td>
          <td class="doc-cost-amount">${formatAUD(netPayable)}</td>
        </tr>
        ${hasGST ? `
        <tr>
          <td>GST (10%)</td>
          <td class="doc-cost-amount">${formatAUD(gstAmt)}</td>
        </tr>` : `
        <tr>
          <td>GST</td>
          <td class="doc-cost-amount">Not applicable</td>
        </tr>`}
        <tr class="doc-cost-total">
          <td><strong>Total amount payable</strong></td>
          <td class="doc-cost-amount"><strong>${formatAUD(totalPayable)}</strong></td>
        </tr>
      </tbody>
    </table>
    <p class="doc-cost-note">GST calculations are indicative only — not tax advice. Verify GST obligations with your accountant.</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Description of Works Completed This Period</h2>
    <p>${esc(data.descriptionOfWork || '—')}</p>
  </div>

  ${hasSchedule ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Schedule of Values</h2>
    <p>${esc(data.scheduleOfValues)}</p>
  </div>` : ''}

  <div class="doc-section">
    <h2 class="doc-section-heading">Supporting Documents</h2>
    <p>Supporting documents (time sheets, receipts, photographs, delivery dockets) are available upon request and may be attached to this claim.</p>
    ${hasSpecial ? `<p>${esc(data.specialConditions)}</p>` : ''}
  </div>

  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Authorisation</h2>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Claimant — ${esc(data.builderName || 'Builder')}</div>
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

  <div class="doc-disclaimer">
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice, is not certified as compliant with any specific contract or regulation, and does not modify any contractual or statutory obligations. The builder or relevant licence holder remains responsible for ensuring all contractual, regulatory, and security of payment requirements are met. GST calculations are indicative only and are not tax advice.
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
