/**
 * Defect Report — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

// ── Counter ──────────────────────────────────────────────────
const COUNTER_KEY = 'bik-defect-counter';
function nextDefectNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return String(n).padStart(3, '0');
}

// ── Schema ───────────────────────────────────────────────────
export const SCHEMA = [

  // ── Project ────────────────────────────────────────────────
  {
    id: 'builderName',    label: 'Business / trading name',
    section: 'Project', type: 'text', width: 'half',
    required: true, profile: true, placeholder: 'e.g. Smith Building Pty Ltd',
    errorMsg: 'Business name is required'
  },
  {
    id: 'projectName',    label: 'Project name',
    section: 'Project', type: 'text', width: 'half',
    required: true, placeholder: 'e.g. Smith Residence Extension', errorMsg: 'Project name is required'
  },
  {
    id: 'projectAddress', label: 'Site address',
    section: 'Project', type: 'text', width: 'full',
    required: false, placeholder: '123 Example Street, Brisbane QLD 4000'
  },
  {
    id: 'defectNumber',   label: 'Report number',
    section: 'Project', type: 'text', width: 'half',
    required: true, defaultValue: nextDefectNumber,
    hint: 'Auto-incremented. Edit if needed.', errorMsg: 'Report number is required'
  },
  {
    id: 'reportDate',     label: 'Date of report',
    section: 'Project', type: 'date', width: 'half',
    required: true, defaultValue: todayISO, errorMsg: 'Date is required'
  },

  // ── Defect Details ─────────────────────────────────────────
  {
    id: 'defectLocation', label: 'Defect location',
    section: 'Defect Details', type: 'text', width: 'half',
    required: true, placeholder: 'e.g. Master bedroom, north wall, 1.2m from corner',
    errorMsg: 'Location is required'
  },
  {
    id: 'severity',       label: 'Severity',
    section: 'Defect Details', type: 'select', width: 'half',
    required: true, defaultValue: 'moderate',
    options: [
      { value: 'critical',  label: 'Critical — structural or safety risk' },
      { value: 'major',     label: 'Major — significant impact on function' },
      { value: 'moderate',  label: 'Moderate — visible or functional impact' },
      { value: 'minor',     label: 'Minor — cosmetic only' }
    ],
    errorMsg: 'Severity is required'
  },
  {
    id: 'defectType',     label: 'Defect type',
    section: 'Defect Details', type: 'select', width: 'half',
    required: false, defaultValue: 'workmanship',
    options: [
      { value: 'workmanship',  label: 'Workmanship' },
      { value: 'materials',    label: 'Defective materials' },
      { value: 'design',       label: 'Design issue' },
      { value: 'damage',       label: 'Physical damage' },
      { value: 'incomplete',   label: 'Incomplete works' },
      { value: 'compliance',   label: 'Non-compliance' },
      { value: 'other',        label: 'Other' }
    ]
  },
  {
    id: 'dateIdentified', label: 'Date identified',
    section: 'Defect Details', type: 'date', width: 'half',
    required: false, defaultValue: todayISO
  },
  {
    id: 'defectDescription', label: 'Description of defect',
    section: 'Defect Details', type: 'textarea', width: 'full',
    required: true, rows: 5,
    placeholder: 'Describe the defect in detail. Include what was observed, measurements, and how the defect presents.',
    hint: 'AI Writer can expand rough notes into professional defect report language',
    errorMsg: 'Defect description is required'
  },

  // ── Responsibility ─────────────────────────────────────────
  {
    id: 'responsibleParty', label: 'Responsible party',
    section: 'Responsibility', type: 'text', width: 'half',
    required: false, placeholder: 'e.g. Smith Plastering Pty Ltd'
  },
  {
    id: 'responsibleContact', label: 'Contact person',
    section: 'Responsibility', type: 'text', width: 'half',
    required: false, placeholder: 'e.g. John Smith — 0400 000 000'
  },

  // ── Recommended Action ─────────────────────────────────────
  {
    id: 'recommendedAction', label: 'Recommended rectification works',
    section: 'Recommended Action', type: 'textarea', width: 'full',
    required: true, rows: 4,
    placeholder: 'Describe the recommended action to rectify the defect. Be specific about what needs to be done.',
    hint: 'AI Writer can strengthen this for contract protection',
    errorMsg: 'Recommended action is required'
  },
  {
    id: 'targetCompletion', label: 'Target completion date',
    section: 'Recommended Action', type: 'date', width: 'half',
    required: false
  },
  {
    id: 'priority',       label: 'Rectification priority',
    section: 'Recommended Action', type: 'select', width: 'half',
    required: false, defaultValue: 'standard',
    options: [
      { value: 'immediate', label: 'Immediate — within 24 hours' },
      { value: 'urgent',    label: 'Urgent — within 3 days' },
      { value: 'standard',  label: 'Standard — within 14 days' },
      { value: 'planned',   label: 'Planned — schedule mutually agreed' }
    ]
  },
  {
    id: 'additionalNotes', label: 'Additional notes',
    section: 'Recommended Action', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'Any additional information, related defects, or context'
  },

  // ── Reported By ────────────────────────────────────────────
  {
    id: 'reportedBy',     label: 'Reported by',
    section: 'Report', type: 'text', width: 'half',
    required: false, profile: true, placeholder: 'Name of person completing this report'
  },
  {
    id: 'reportedByRole', label: 'Role',
    section: 'Report', type: 'text', width: 'half',
    required: false, placeholder: 'e.g. Site Supervisor, Contract Administrator'
  }
];

// ── Tool configuration ────────────────────────────────────────

export const DOC_CONFIG = {
  toolId:      'defect-report',
  toolName:    'Defect Report',
  autosaveKey: 'bik-defect-draft',
  docPrefix:   'DR',
  aiFields:    ['defectDescription', 'recommendedAction', 'additionalNotes'],
  printTitle:  'Defect Report',

  getDocTitle(state) {
    return `Defect Report DR-${state.defectNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return `DR-${state.defectNumber || '??'}`;
  },
  getEmailData(state) {
    return {
      projectName: state.projectName || '',
      reference:   `DR-${state.defectNumber || '???'}`
    };
  }
};

// ── Document template ─────────────────────────────────────────

const SEVERITY_LABELS = {
  critical: 'Critical — structural or safety risk',
  major:    'Major — significant impact on function',
  moderate: 'Moderate — visible or functional impact',
  minor:    'Minor — cosmetic only'
};

const SEVERITY_CLASSES = {
  critical: 'doc-severity--critical',
  major:    'doc-severity--major',
  moderate: 'doc-severity--moderate',
  minor:    'doc-severity--minor'
};

const DEFECT_TYPE_LABELS = {
  workmanship: 'Workmanship', materials: 'Defective materials', design: 'Design issue',
  damage: 'Physical damage', incomplete: 'Incomplete works', compliance: 'Non-compliance', other: 'Other'
};

const PRIORITY_LABELS = {
  immediate: 'Immediate — within 24 hours', urgent: 'Urgent — within 3 days',
  standard:  'Standard — within 14 days',   planned: 'Planned — schedule to be agreed'
};

export function generateDocument(data) {
  const severityLabel = SEVERITY_LABELS[data.severity] || '';
  const severityClass = SEVERITY_CLASSES[data.severity] || '';
  const defectType    = DEFECT_TYPE_LABELS[data.defectType] || '';
  const priorityLabel = PRIORITY_LABELS[data.priority] || '';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Defect Report</h1>
      <div class="doc-subtitle">DR&ndash;${esc(data.defectNumber || '???')}</div>
    </div>
  </div>
  <div class="doc-accent-bar"></div>

  <!-- Severity badge -->
  <div class="doc-severity-wrap">
    <span class="doc-severity ${severityClass}">${severityLabel}</span>
  </div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Reported by</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.reportedBy ? `<div class="doc-meta-value">${esc(data.reportedBy)}${data.reportedByRole ? ` — ${esc(data.reportedByRole)}` : ''}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Project</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.projectName || '—')}</div>
      ${data.projectAddress ? `<div class="doc-meta-value">${esc(data.projectAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Report details</div>
      <table class="doc-ref-table">
        <tr><td>Report no.</td><td>DR-${esc(data.defectNumber || '???')}</td></tr>
        <tr><td>Date of report</td><td>${formatDateLong(data.reportDate) || '—'}</td></tr>
        ${data.dateIdentified ? `<tr><td>Date identified</td><td>${formatDateLong(data.dateIdentified)}</td></tr>` : ''}
        ${defectType ? `<tr><td>Type</td><td>${defectType}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <!-- Defect Details -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Defect Description</h2>
    <table class="doc-ref-table" style="margin-bottom:12px">
      <tr><td>Location</td><td>${esc(data.defectLocation || '—')}</td></tr>
    </table>
    <p>${esc(data.defectDescription || '—')}</p>
  </div>

  ${(data.responsibleParty || data.responsibleContact) ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Responsible Party</h2>
    <table class="doc-ref-table">
      ${data.responsibleParty ? `<tr><td>Organisation</td><td>${esc(data.responsibleParty)}</td></tr>` : ''}
      ${data.responsibleContact ? `<tr><td>Contact</td><td>${esc(data.responsibleContact)}</td></tr>` : ''}
    </table>
  </div>` : ''}

  <!-- Recommended Action -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Recommended Rectification</h2>
    <p>${esc(data.recommendedAction || '—')}</p>
    <table class="doc-ref-table" style="margin-top:12px">
      ${priorityLabel ? `<tr><td>Priority</td><td>${priorityLabel}</td></tr>` : ''}
      ${data.targetCompletion ? `<tr><td>Target completion</td><td>${formatDateLong(data.targetCompletion)}</td></tr>` : ''}
    </table>
  </div>

  ${data.additionalNotes?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Additional Notes</h2>
    <p>${esc(data.additionalNotes)}</p>
  </div>` : ''}

  <!-- Sign off -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Sign Off</h2>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Reported by</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.reportedBy || 'Authorised Representative')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row"><div class="sig-date-label">Date</div><div class="sig-date-line"></div></div>
      </div>
      <div class="sig-block">
        <div class="sig-role">Responsible Party Acknowledgement</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.responsibleParty || 'Responsible Party')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row"><div class="sig-date-label">Date</div><div class="sig-date-line"></div></div>
      </div>
    </div>
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
