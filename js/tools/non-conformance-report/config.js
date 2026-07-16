/**
 * Non-Conformance Report — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-non-conformance-report-counter';

function nextNCRNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'NCR-' + String(n).padStart(3, '0');
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
    id: 'ncrNumber',
    label: 'NCR number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextNCRNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'NCR number is required'
  },
  {
    id: 'ncrDate',
    label: 'NCR date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'NCR date is required'
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
    label: 'Client name',
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

  // ── Non-Conformance Details ─────────────────────────────────
  {
    id: 'tradeOrSubcontractor',
    label: 'Trade / subcontractor responsible',
    section: 'Non-Conformance Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. ABC Concreting Pty Ltd'
  },
  {
    id: 'discoveredBy',
    label: 'Discovered by',
    section: 'Non-Conformance Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Name of person who identified the NCR'
  },
  {
    id: 'locationOnSite',
    label: 'Location on site',
    section: 'Non-Conformance Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Ground floor bathroom, northern wall'
  },
  {
    id: 'severity',
    label: 'Severity',
    section: 'Non-Conformance Details',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'minor',
    options: [
      { value: 'minor',    label: 'Minor' },
      { value: 'major',    label: 'Major' },
      { value: 'critical', label: 'Critical' }
    ],
    errorMsg: 'Severity is required'
  },
  {
    id: 'specificationReference',
    label: 'Specification / drawing reference',
    section: 'Non-Conformance Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Drawing A-101 Rev C, Spec Section 3.4.2'
  },
  {
    id: 'photographicEvidence',
    label: 'Photographic evidence taken',
    section: 'Non-Conformance Details',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' }
    ]
  },
  {
    id: 'nonConformanceDescription',
    label: 'Description of non-conformance',
    section: 'Non-Conformance Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Describe what does not conform, how it was identified, and the required standard it should meet.',
    errorMsg: 'Non-conformance description is required'
  },

  // ── Root Cause ──────────────────────────────────────────────
  {
    id: 'rootCause',
    label: 'Root cause analysis',
    section: 'Root Cause',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Why did this non-conformance occur? Consider immediate and underlying causes.'
  },

  // ── Corrective Action ───────────────────────────────────────
  {
    id: 'correctiveActionRequired',
    label: 'Corrective action required',
    section: 'Corrective Action',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 4,
    placeholder: 'Describe in detail what must be done to rectify the non-conformance.',
    errorMsg: 'Corrective action description is required'
  },
  {
    id: 'responsiblePerson',
    label: 'Responsible person',
    section: 'Corrective Action',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Who is responsible for completing the corrective action'
  },
  {
    id: 'targetCompletionDate',
    label: 'Target completion date',
    section: 'Corrective Action',
    type: 'date',
    width: 'half',
    required: false
  },
  {
    id: 'verificationMethod',
    label: 'Verification method',
    section: 'Corrective Action',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'How will it be confirmed that the non-conformance has been rectified? e.g. re-inspection, test result, sign-off by engineer'
  },

  // ── Close-out ───────────────────────────────────────────────
  {
    id: 'closedOutDate',
    label: 'Date closed out',
    section: 'Close-out',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Leave blank if not yet closed out'
  },
  {
    id: 'closedOutBy',
    label: 'Closed out by',
    section: 'Close-out',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Name of person closing out this NCR'
  },
  {
    id: 'builderApprovalName',
    label: 'Issued by — name',
    section: 'Close-out',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'non-conformance-report',
  toolName:        'Non-Conformance Report',
  autosaveKey:     'bik-non-conformance-report-draft',
  docPrefix:       'NCR',
  aiFields:        ['nonConformanceDescription', 'rootCause', 'correctiveActionRequired', 'verificationMethod'],
  printTitle:      'Non-Conformance Report',
  approvalEnabled: false,

  getDocTitle(state) {
    return `NCR ${state.ncrNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.ncrNumber || '??';
  }
};

const SEVERITY_STYLES = {
  minor:    'background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;',
  major:    'background:#fff8e1;color:#e65100;border:1px solid #ffcc02;',
  critical: 'background:#fce4ec;color:#b71c1c;border:1px solid #ef9a9a;'
};

export function generateDocument(data) {
  const hasBuilderContact  = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const severityLabel      = (data.severity || 'minor').charAt(0).toUpperCase() + (data.severity || 'minor').slice(1);
  const severityStyle      = SEVERITY_STYLES[data.severity] || SEVERITY_STYLES.minor;
  const hasRootCause       = !!data.rootCause?.trim();
  const hasVerification    = !!data.verificationMethod?.trim();
  const isClosed           = !!data.closedOutDate;

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Non-Conformance Report</h1>
      <div class="doc-subtitle">${esc(data.ncrNumber || '???')}</div>
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
      <div class="doc-meta-heading">Project</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.projectName || '—')}</div>
      ${data.clientName   ? `<div class="doc-meta-value">${esc(data.clientName)}</div>`   : ''}
      ${data.siteAddress  ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>`  : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">NCR Details</div>
      <table class="doc-ref-table">
        <tr><td>NCR no.</td><td>${esc(data.ncrNumber || '—')}</td></tr>
        <tr><td>Date raised</td><td>${formatDateLong(data.ncrDate) || '—'}</td></tr>
        ${data.contractRef ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>` : ''}
        <tr><td>Severity</td><td><span style="padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.8rem;${severityStyle}">${esc(severityLabel)}</span></td></tr>
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  <!-- NCR Details -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Non-Conformance Details</h2>
    <table class="doc-ref-table" style="margin-bottom:12px;">
      ${data.tradeOrSubcontractor  ? `<tr><td>Trade / subcontractor</td><td>${esc(data.tradeOrSubcontractor)}</td></tr>`  : ''}
      ${data.discoveredBy          ? `<tr><td>Discovered by</td><td>${esc(data.discoveredBy)}</td></tr>`                   : ''}
      ${data.locationOnSite        ? `<tr><td>Location on site</td><td>${esc(data.locationOnSite)}</td></tr>`              : ''}
      ${data.specificationReference ? `<tr><td>Specification reference</td><td>${esc(data.specificationReference)}</td></tr>` : ''}
      <tr><td>Photographic evidence</td><td>${data.photographicEvidence === 'no' ? 'No' : 'Yes'}</td></tr>
    </table>
    <p>${esc(data.nonConformanceDescription || '—')}</p>
  </div>

  ${hasRootCause ? `
  <!-- Root Cause -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Root Cause Analysis</h2>
    <p>${esc(data.rootCause)}</p>
  </div>` : ''}

  <!-- Corrective Action -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Corrective Action Required</h2>
    <p>${esc(data.correctiveActionRequired || '—')}</p>
    <table class="doc-ref-table" style="margin-top:12px;">
      ${data.responsiblePerson     ? `<tr><td>Responsible person</td><td>${esc(data.responsiblePerson)}</td></tr>`         : ''}
      ${data.targetCompletionDate  ? `<tr><td>Target completion</td><td>${formatDateLong(data.targetCompletionDate)}</td></tr>` : ''}
    </table>
    ${hasVerification ? `<div style="margin-top:10px;"><strong>Verification method:</strong><br>${esc(data.verificationMethod)}</div>` : ''}
  </div>

  <!-- Close-out -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Close-out</h2>
    <table class="doc-cost-table">
      <tbody>
        <tr>
          <td>Status</td>
          <td><strong>${isClosed ? 'Closed' : 'Open'}</strong></td>
        </tr>
        ${isClosed ? `
        <tr><td>Closed out date</td><td>${formatDateLong(data.closedOutDate)}</td></tr>
        ${data.closedOutBy ? `<tr><td>Closed out by</td><td>${esc(data.closedOutBy)}</td></tr>` : ''}
        ` : ''}
      </tbody>
    </table>
  </div>

  <!-- Sign-off -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Issued By</h2>
    <div class="sig-grid" style="grid-template-columns: 1fr;">
      <div class="sig-block">
        <div class="sig-role">Builder / Site Supervisor</div>
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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute legal advice and does not modify any contractual or statutory obligations. The builder or relevant licence holder remains responsible for ensuring compliance with all applicable laws, regulations, and standards.
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
