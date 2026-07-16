/**
 * Incident Report — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-incident-report-counter';

function nextReportNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'IR-' + String(n).padStart(3, '0');
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

  // ── Incident Details ────────────────────────────────────────
  {
    id: 'reportNumber',
    label: 'Report number',
    section: 'Incident Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextReportNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Report number is required'
  },
  {
    id: 'reportDate',
    label: 'Report date',
    section: 'Incident Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Report date is required'
  },
  {
    id: 'incidentDate',
    label: 'Incident date',
    section: 'Incident Details',
    type: 'date',
    width: 'half',
    required: true,
    errorMsg: 'Incident date is required'
  },
  {
    id: 'incidentTime',
    label: 'Incident time',
    section: 'Incident Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: '2:30 PM'
  },
  {
    id: 'incidentType',
    label: 'Incident type',
    section: 'Incident Details',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'injury',
    options: [
      { value: 'injury',                 label: 'Injury' },
      { value: 'near-miss',              label: 'Near miss' },
      { value: 'dangerous-occurrence',   label: 'Dangerous occurrence' },
      { value: 'property-damage',        label: 'Property damage' },
      { value: 'environmental',          label: 'Environmental' }
    ],
    errorMsg: 'Incident type is required'
  },
  {
    id: 'incidentLocation',
    label: 'Location of incident',
    section: 'Incident Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Ground floor, north scaffold'
  },
  {
    id: 'projectName',
    label: 'Project name',
    section: 'Incident Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Smith Residence Renovation',
    errorMsg: 'Project name is required'
  },
  {
    id: 'siteAddress',
    label: 'Site address',
    section: 'Incident Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Project Street, Brisbane QLD 4000'
  },

  // ── Persons Involved ────────────────────────────────────────
  {
    id: 'injuredPersonName',
    label: 'Injured / involved person name',
    section: 'Persons Involved',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Full name'
  },
  {
    id: 'injuredPersonRole',
    label: 'Role / position',
    section: 'Persons Involved',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Labourer, Subcontractor, Visitor'
  },
  {
    id: 'injuredPersonEmployer',
    label: 'Employer / company',
    section: 'Persons Involved',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. ABC Pty Ltd or self-employed'
  },
  {
    id: 'injuryType',
    label: 'Nature of injury / damage',
    section: 'Persons Involved',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Laceration, strain, fracture, nil injury'
  },
  {
    id: 'bodyPartAffected',
    label: 'Body part affected',
    section: 'Persons Involved',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Left hand, lower back'
  },
  {
    id: 'treatmentProvided',
    label: 'Treatment provided',
    section: 'Persons Involved',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: 'first-aid',
    options: [
      { value: 'first-aid',          label: 'First aid on site' },
      { value: 'medical-centre',     label: 'Sent to medical centre' },
      { value: 'hospitalised',       label: 'Hospitalised' },
      { value: 'no-treatment',       label: 'No treatment required' }
    ]
  },
  {
    id: 'medicalCertificate',
    label: 'Medical certificate',
    section: 'Persons Involved',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: 'no',
    options: [
      { value: 'yes',     label: 'Yes' },
      { value: 'no',      label: 'No' },
      { value: 'pending', label: 'Pending' }
    ]
  },

  // ── Witnesses ───────────────────────────────────────────────
  {
    id: 'witnessNames',
    label: 'Witness names and contact details',
    section: 'Witnesses',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List names and contact details of any witnesses (leave blank if no witnesses)'
  },

  // ── Incident Description ─────────────────────────────────────
  {
    id: 'incidentDescription',
    label: 'Description of incident',
    section: 'Incident Description',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 6,
    placeholder: 'Provide a factual, chronological description of what happened. Include what was being done, what went wrong, and what happened immediately after.',
    errorMsg: 'Incident description is required'
  },

  // ── Investigation ───────────────────────────────────────────
  {
    id: 'rootCause',
    label: 'Immediate and underlying causes',
    section: 'Investigation',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Identify the immediate cause (what directly caused the incident) and underlying causes (why the conditions existed).'
  },
  {
    id: 'regulatoryNotificationRequired',
    label: 'Regulatory notification required',
    section: 'Investigation',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'under-assessment',
    options: [
      { value: 'yes',              label: 'Yes' },
      { value: 'no',               label: 'No' },
      { value: 'under-assessment', label: 'Under assessment' }
    ]
  },
  {
    id: 'regulatoryRef',
    label: 'Regulatory notification reference',
    section: 'Investigation',
    type: 'text',
    width: 'full',
    required: false,
    placeholder: 'e.g. Notified WorkSafe QLD — Ref XXXXX'
  },

  // ── Corrective Action ───────────────────────────────────────
  {
    id: 'correctiveActions',
    label: 'Corrective and preventive actions',
    section: 'Corrective Action',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'List actions taken or planned to prevent recurrence. Include responsible person and target completion date for each action.'
  },
  {
    id: 'builderApprovalName',
    label: 'Report completed by — name',
    section: 'Corrective Action',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'incident-report',
  toolName:        'Incident Report',
  autosaveKey:     'bik-incident-report-draft',
  docPrefix:       'IR',
  aiFields:        ['incidentDescription', 'rootCause', 'correctiveActions'],
  printTitle:      'WHS Incident Report',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Incident Report ${state.reportNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.reportNumber || '??';
  }
};

const INCIDENT_TYPE_LABELS = {
  'injury':               'Injury',
  'near-miss':            'Near Miss',
  'dangerous-occurrence': 'Dangerous Occurrence',
  'property-damage':      'Property Damage',
  'environmental':        'Environmental'
};

const TREATMENT_LABELS = {
  'first-aid':      'First aid on site',
  'medical-centre': 'Sent to medical centre',
  'hospitalised':   'Hospitalised',
  'no-treatment':   'No treatment required'
};

export function generateDocument(data) {
  const hasBuilderContact = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const incidentTypeLabel = INCIDENT_TYPE_LABELS[data.incidentType] || data.incidentType || '—';
  const hasWitnesses      = !!data.witnessNames?.trim();
  const hasRootCause      = !!data.rootCause?.trim();
  const hasCorrectiveActs = !!data.correctiveActions?.trim();
  const hasRegRef         = !!data.regulatoryRef?.trim();
  const hasPerson         = !!(data.injuredPersonName || data.injuredPersonRole);

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">WHS Incident Report</h1>
      <div class="doc-subtitle">${esc(data.reportNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Reported by</div>
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
      <div class="doc-meta-heading">Site / Project</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Report Details</div>
      <table class="doc-ref-table">
        <tr><td>Report no.</td><td>${esc(data.reportNumber || '—')}</td></tr>
        <tr><td>Report date</td><td>${formatDateLong(data.reportDate) || '—'}</td></tr>
        <tr><td>Incident date</td><td>${formatDateLong(data.incidentDate) || '—'}</td></tr>
        ${data.incidentTime ? `<tr><td>Time</td><td>${esc(data.incidentTime)}</td></tr>` : ''}
        <tr><td>Incident type</td><td><strong>${esc(incidentTypeLabel)}</strong></td></tr>
        ${data.incidentLocation ? `<tr><td>Location</td><td>${esc(data.incidentLocation)}</td></tr>` : ''}
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  ${hasPerson ? `
  <!-- Persons Involved -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Person Involved</h2>
    <table class="doc-cost-table">
      <tbody>
        ${data.injuredPersonName     ? `<tr><td>Name</td><td>${esc(data.injuredPersonName)}</td></tr>`      : ''}
        ${data.injuredPersonRole     ? `<tr><td>Role</td><td>${esc(data.injuredPersonRole)}</td></tr>`      : ''}
        ${data.injuredPersonEmployer ? `<tr><td>Employer</td><td>${esc(data.injuredPersonEmployer)}</td></tr>` : ''}
        ${data.injuryType            ? `<tr><td>Nature of injury</td><td>${esc(data.injuryType)}</td></tr>` : ''}
        ${data.bodyPartAffected      ? `<tr><td>Body part affected</td><td>${esc(data.bodyPartAffected)}</td></tr>` : ''}
        ${data.treatmentProvided     ? `<tr><td>Treatment provided</td><td>${esc(TREATMENT_LABELS[data.treatmentProvided] || data.treatmentProvided)}</td></tr>` : ''}
        ${data.medicalCertificate    ? `<tr><td>Medical certificate</td><td>${esc(data.medicalCertificate.charAt(0).toUpperCase() + data.medicalCertificate.slice(1))}</td></tr>` : ''}
      </tbody>
    </table>
  </div>` : ''}

  ${hasWitnesses ? `
  <!-- Witnesses -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Witnesses</h2>
    <p>${esc(data.witnessNames)}</p>
  </div>` : ''}

  <!-- Incident Description -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Description of Incident</h2>
    <p>${esc(data.incidentDescription || '—')}</p>
  </div>

  ${hasRootCause ? `
  <!-- Root Cause -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Immediate and Underlying Causes</h2>
    <p>${esc(data.rootCause)}</p>
  </div>` : ''}

  <!-- Regulatory Notification -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Regulatory Notification</h2>
    <table class="doc-ref-table">
      <tr>
        <td>Notification required</td>
        <td>${data.regulatoryNotificationRequired === 'yes' ? '<strong>Yes</strong>' : data.regulatoryNotificationRequired === 'no' ? 'No' : 'Under assessment'}</td>
      </tr>
      ${hasRegRef ? `<tr><td>Reference</td><td>${esc(data.regulatoryRef)}</td></tr>` : ''}
    </table>
  </div>

  ${hasCorrectiveActs ? `
  <!-- Corrective Actions -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Corrective and Preventive Actions</h2>
    <p>${esc(data.correctiveActions)}</p>
  </div>` : ''}

  <!-- Sign-off -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Report Completed By</h2>
    <div class="sig-grid" style="grid-template-columns: 1fr;">
      <div class="sig-block">
        <div class="sig-role">Person Completing Report</div>
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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before use. It does not constitute legal advice and does not modify any statutory WHS obligations. The person conducting a business or undertaking (PCBU) is responsible for complying with all applicable work health and safety legislation, including mandatory notification requirements to the relevant state or territory regulator. Seek professional legal or WHS advice regarding specific obligations. Retain this record as required by applicable regulations.
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
