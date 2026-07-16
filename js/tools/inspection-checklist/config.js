/**
 * Inspection Checklist — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-inspection-checklist-counter';

function nextChecklistNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return 'IC-' + String(n).padStart(3, '0');
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
    id: 'checklistNumber',
    label: 'Checklist number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextChecklistNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Checklist number is required'
  },
  {
    id: 'inspectionDate',
    label: 'Inspection date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Inspection date is required'
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

  // ── Inspection Stage ────────────────────────────────────────
  {
    id: 'inspectionStage',
    label: 'Inspection stage',
    section: 'Inspection Stage',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'slab',
    options: [
      { value: 'pre-slab',     label: 'Pre-slab' },
      { value: 'slab',         label: 'Slab' },
      { value: 'frame',        label: 'Frame' },
      { value: 'lockup',       label: 'Lockup' },
      { value: 'fixing',       label: 'Fixing' },
      { value: 'pre-handover', label: 'Pre-handover' },
      { value: 'final',        label: 'Final' }
    ],
    errorMsg: 'Inspection stage is required'
  },
  {
    id: 'inspectorName',
    label: 'Inspector name',
    section: 'Inspection Stage',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'Full name of person conducting inspection',
    errorMsg: 'Inspector name is required'
  },
  {
    id: 'inspectorRole',
    label: 'Inspector role',
    section: 'Inspection Stage',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Site Supervisor, Building Inspector'
  },
  {
    id: 'weatherConditions',
    label: 'Weather conditions',
    section: 'Inspection Stage',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Fine, 22°C'
  },

  // ── Inspection Items ────────────────────────────────────────
  {
    id: 'generalObservations',
    label: 'General observations',
    section: 'Inspection Items',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Overall site condition, access, safety, general observations'
  },
  {
    id: 'itemsInspected',
    label: 'Items inspected',
    section: 'Inspection Items',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 8,
    placeholder: 'List items checked, one per line. e.g.:\nSlab level ✓\nReinforcement placement ✓\nPenetrations formed ✓\nFormwork adequately braced ✓',
    errorMsg: 'Items inspected is required'
  },
  {
    id: 'defectsFound',
    label: 'Defects or non-conformances found',
    section: 'Inspection Items',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'List any defects or non-conformances found during this inspection (leave blank if nil defects)'
  },
  {
    id: 'photosAttached',
    label: 'Photos taken',
    section: 'Inspection Items',
    type: 'select',
    width: 'half',
    required: false,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' }
    ]
  },

  // ── Outcome ─────────────────────────────────────────────────
  {
    id: 'passedForNextStage',
    label: 'Outcome',
    section: 'Outcome',
    type: 'radio',
    width: 'full',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes',         label: 'Passed — approved to proceed to next stage' },
      { value: 'conditional', label: 'Conditional — minor items to rectify before proceeding' },
      { value: 'no',          label: 'Hold point — do not proceed until re-inspection' }
    ],
    errorMsg: 'Outcome is required'
  },
  {
    id: 'rectificationRequired',
    label: 'Rectification required',
    section: 'Outcome',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' }
    ]
  },
  {
    id: 'rectificationDetails',
    label: 'Rectification requirements',
    section: 'Outcome',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Describe what must be rectified before proceeding to the next stage'
  },
  {
    id: 'reinspectionRequired',
    label: 'Re-inspection required',
    section: 'Outcome',
    type: 'radio',
    width: 'full',
    required: false,
    defaultValue: 'no',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no',  label: 'No' }
    ]
  },
  {
    id: 'reinspectionDate',
    label: 'Re-inspection date',
    section: 'Outcome',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Leave blank if not yet scheduled'
  },
  {
    id: 'builderNotes',
    label: 'Additional notes',
    section: 'Outcome',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional notes or comments'
  },
  {
    id: 'builderApprovalName',
    label: 'Inspector signature — name',
    section: 'Outcome',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'inspection-checklist',
  toolName:        'Inspection Checklist',
  autosaveKey:     'bik-inspection-checklist-draft',
  docPrefix:       'IC',
  aiFields:        ['generalObservations', 'itemsInspected', 'defectsFound', 'rectificationDetails'],
  printTitle:      'Inspection Checklist',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Inspection Checklist ${state.checklistNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.checklistNumber || '??';
  }
};

const STAGE_LABELS = {
  'pre-slab':     'Pre-slab',
  'slab':         'Slab',
  'frame':        'Frame',
  'lockup':       'Lockup',
  'fixing':       'Fixing',
  'pre-handover': 'Pre-handover',
  'final':        'Final'
};

const OUTCOME_CONFIG = {
  'yes':         { label: 'PASSED',      style: 'background:#e8f5e9;color:#1b5e20;border:2px solid #4caf50;' },
  'conditional': { label: 'CONDITIONAL', style: 'background:#fff8e1;color:#e65100;border:2px solid #ff9800;' },
  'no':          { label: 'HOLD POINT',  style: 'background:#fce4ec;color:#b71c1c;border:2px solid #f44336;' }
};

export function generateDocument(data) {
  const hasBuilderContact  = !!(data.builderPhone || data.builderEmail || data.builderAddress);
  const stageLabel         = STAGE_LABELS[data.inspectionStage] || data.inspectionStage || '—';
  const outcomeConf        = OUTCOME_CONFIG[data.passedForNextStage] || OUTCOME_CONFIG.yes;
  const hasDefects         = !!data.defectsFound?.trim();
  const hasRectification   = !!data.rectificationDetails?.trim();
  const hasObservations    = !!data.generalObservations?.trim();
  const hasNotes           = !!data.builderNotes?.trim();
  const needsReinspection  = data.reinspectionRequired === 'yes';

  // Format items inspected as a list
  const itemLines = (data.itemsInspected || '').split('\n').filter(l => l.trim());
  const itemsHtml = itemLines.length
    ? '<ul style="margin:8px 0 0 0;padding-left:1.4em;">' + itemLines.map(l => `<li>${esc(l)}</li>`).join('') + '</ul>'
    : '<p>—</p>';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Inspection Checklist</h1>
      <div class="doc-subtitle">${esc(data.checklistNumber || '???')} &mdash; ${esc(stageLabel)} Stage</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Prepared by</div>
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
      ${data.clientName  ? `<div class="doc-meta-value">${esc(data.clientName)}</div>`  : ''}
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>

    <div class="doc-meta-col">
      <div class="doc-meta-heading">Inspection Details</div>
      <table class="doc-ref-table">
        <tr><td>Checklist no.</td><td>${esc(data.checklistNumber || '—')}</td></tr>
        <tr><td>Inspection date</td><td>${formatDateLong(data.inspectionDate) || '—'}</td></tr>
        <tr><td>Stage</td><td><strong>${esc(stageLabel)}</strong></td></tr>
        ${data.contractRef       ? `<tr><td>Contract ref.</td><td>${esc(data.contractRef)}</td></tr>`         : ''}
        ${data.inspectorName     ? `<tr><td>Inspector</td><td>${esc(data.inspectorName)}</td></tr>`           : ''}
        ${data.inspectorRole     ? `<tr><td>Role</td><td>${esc(data.inspectorRole)}</td></tr>`                : ''}
        ${data.weatherConditions ? `<tr><td>Weather</td><td>${esc(data.weatherConditions)}</td></tr>`         : ''}
        ${data.photosAttached    ? `<tr><td>Photos taken</td><td>${data.photosAttached === 'yes' ? 'Yes' : 'No'}</td></tr>` : ''}
      </table>
    </div>

  </div>

  <div class="doc-divider"></div>

  ${hasObservations ? `
  <!-- General Observations -->
  <div class="doc-section">
    <h2 class="doc-section-heading">General Observations</h2>
    <p>${esc(data.generalObservations)}</p>
  </div>` : ''}

  <!-- Items Inspected -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Items Inspected</h2>
    ${itemsHtml}
  </div>

  ${hasDefects ? `
  <!-- Defects Found -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Defects / Non-Conformances Found</h2>
    <p>${esc(data.defectsFound)}</p>
  </div>` : `
  <!-- No Defects -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Defects / Non-Conformances Found</h2>
    <p>Nil defects identified at this inspection.</p>
  </div>`}

  ${hasRectification ? `
  <!-- Rectification -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Rectification Requirements</h2>
    <p>${esc(data.rectificationDetails)}</p>
  </div>` : ''}

  <!-- Outcome Panel -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Inspection Outcome</h2>
    <div style="padding:16px 20px;border-radius:6px;text-align:center;font-size:1.1rem;font-weight:700;letter-spacing:0.04em;${outcomeConf.style}">
      ${outcomeConf.label}
    </div>
    ${needsReinspection ? `
    <div style="margin-top:12px;">
      <strong>Re-inspection required.</strong>${data.reinspectionDate ? ` Scheduled for: ${formatDateLong(data.reinspectionDate)}.` : ' Date to be confirmed.'}
    </div>` : ''}
  </div>

  ${hasNotes ? `
  <!-- Notes -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Notes</h2>
    <p>${esc(data.builderNotes)}</p>
  </div>` : ''}

  <!-- Sign-off -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Inspector Sign-off</h2>
    <div class="sig-grid" style="grid-template-columns: 1fr;">
      <div class="sig-block">
        <div class="sig-role">${esc(data.inspectorRole || 'Inspector')}</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.builderApprovalName || data.inspectorName || 'Inspector')}</div>
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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before issue. It does not constitute a formal building inspection certificate or report under any applicable legislation, and does not replace any mandatory inspections required by a certifier or building surveyor. The builder or relevant licence holder remains responsible for ensuring all works comply with applicable Australian building codes, standards, and regulations.
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
