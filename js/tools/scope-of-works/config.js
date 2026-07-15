/**
 * Scope of Works — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

// ── Counter ──────────────────────────────────────────────────
const COUNTER_KEY = 'bik-scope-counter';
function nextScopeNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return String(n).padStart(3, '0');
}

// ── Schema ───────────────────────────────────────────────────
export const SCHEMA = [

  // ── Your Business ─────────────────────────────────────────
  {
    id: 'builderName',    label: 'Business / trading name',
    section: 'Your Business', type: 'text', width: 'half',
    required: true, profile: true, placeholder: 'e.g. Smith Building Pty Ltd',
    autocomplete: 'organization', errorMsg: 'Business name is required'
  },
  {
    id: 'builderABN',     label: 'ABN',
    section: 'Your Business', type: 'text', width: 'half',
    required: false, profile: true, placeholder: '12 345 678 901'
  },
  {
    id: 'builderLicence', label: 'Licence number (QBCC / BSA)',
    section: 'Your Business', type: 'text', width: 'half',
    required: false, profile: true, placeholder: 'e.g. 1234567'
  },
  {
    id: 'builderPhone',   label: 'Phone',
    section: 'Your Business', type: 'tel', width: 'half',
    required: false, profile: true, placeholder: '0400 000 000'
  },

  // ── Project Details ────────────────────────────────────────
  {
    id: 'projectName',    label: 'Project name',
    section: 'Project Details', type: 'text', width: 'half',
    required: true, placeholder: 'e.g. Smith Residence Extension', errorMsg: 'Project name is required'
  },
  {
    id: 'projectAddress', label: 'Site address',
    section: 'Project Details', type: 'textarea', width: 'full',
    required: false, rows: 2, placeholder: '123 Example Street, Brisbane QLD 4000'
  },
  {
    id: 'clientName',     label: 'Client name',
    section: 'Project Details', type: 'text', width: 'half',
    required: true, placeholder: 'e.g. John & Jane Smith', errorMsg: 'Client name is required'
  },
  {
    id: 'clientEmail',    label: 'Client email',
    section: 'Project Details', type: 'email', width: 'half',
    required: false, placeholder: 'client@email.com'
  },
  {
    id: 'scopeNumber',    label: 'Document number',
    section: 'Project Details', type: 'text', width: 'half',
    required: true, defaultValue: nextScopeNumber,
    hint: 'Auto-incremented. Edit if needed.', errorMsg: 'Document number is required'
  },
  {
    id: 'issueDate',      label: 'Date issued',
    section: 'Project Details', type: 'date', width: 'half',
    required: true, defaultValue: todayISO, errorMsg: 'Date is required'
  },
  {
    id: 'projectType',    label: 'Project type',
    section: 'Project Details', type: 'select', width: 'half',
    required: false, defaultValue: 'residential',
    options: [
      { value: 'residential',  label: 'Residential new build' },
      { value: 'renovation',   label: 'Renovation / extension' },
      { value: 'commercial',   label: 'Commercial construction' },
      { value: 'maintenance',  label: 'Maintenance / repairs' },
      { value: 'fitout',       label: 'Fitout / refurbishment' }
    ]
  },

  // ── Scope Details ──────────────────────────────────────────
  {
    id: 'projectDescription', label: 'Project description',
    section: 'Scope Details', type: 'textarea', width: 'full',
    required: true, rows: 4,
    placeholder: 'Brief overview of the project — what is being built, why, and the general approach.',
    hint: 'AI Writer can expand rough notes into professional language',
    errorMsg: 'Project description is required'
  },
  {
    id: 'scopeItems',     label: 'Scope of works',
    section: 'Scope Details', type: 'textarea', width: 'full',
    required: true, rows: 8,
    placeholder: `List all work to be performed. Be specific. For example:
- Demolition of existing rear boundary fence (approx. 25 lineal metres)
- Supply and install new treated pine paling fence to rear boundary
- Install 2 x hardwood gate (900mm wide) with lockable hardware
- Dispose of all demolition waste off site`,
    hint: 'AI Writer will expand bullet points into professional scope language',
    errorMsg: 'Scope of works is required'
  },
  {
    id: 'inclusions',     label: 'Inclusions',
    section: 'Scope Details', type: 'textarea', width: 'full',
    required: false, rows: 4,
    placeholder: 'List what is specifically included (e.g. supply and install all materials, cleanup, council lodgement)'
  },
  {
    id: 'exclusions',     label: 'Exclusions',
    section: 'Scope Details', type: 'textarea', width: 'full',
    required: false, rows: 4,
    placeholder: 'List what is specifically NOT included (e.g. electrical, plumbing, painting, council fees)'
  },
  {
    id: 'assumptions',    label: 'Assumptions and qualifications',
    section: 'Scope Details', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'State all assumptions made (e.g. existing structure is sound, site access is available 5 days/week, no latent conditions present)'
  },

  // ── Programme ─────────────────────────────────────────────
  {
    id: 'startDate',      label: 'Anticipated start date',
    section: 'Programme', type: 'date', width: 'half',
    required: false
  },
  {
    id: 'duration',       label: 'Estimated duration',
    section: 'Programme', type: 'text', width: 'half',
    required: false, placeholder: 'e.g. 8 weeks'
  },
  {
    id: 'programmeNotes', label: 'Programme notes',
    section: 'Programme', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'Any conditions affecting the programme, staging, or key milestones'
  },

  // ── Approvals ──────────────────────────────────────────────
  {
    id: 'preparedBy',     label: 'Prepared by',
    section: 'Approval', type: 'text', width: 'half',
    required: false, profile: true, placeholder: 'Authorised person name'
  }
];

// ── Tool configuration ────────────────────────────────────────

export const DOC_CONFIG = {
  toolId:      'scope-of-works',
  toolName:    'Scope of Works',
  autosaveKey: 'bik-scope-draft',
  docPrefix:   'SOW',
  aiFields:    ['projectDescription', 'scopeItems', 'inclusions', 'exclusions', 'assumptions'],
  printTitle:  'Scope of Works',

  getDocTitle(state) {
    return `Scope of Works SOW-${state.scopeNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return `SOW-${state.scopeNumber || '??'}`;
  },
  getEmailData(state) {
    return {
      clientEmail: state.clientEmail || '',
      clientName:  state.clientName  || '',
      projectName: state.projectName || '',
      reference:   `SOW-${state.scopeNumber || '???'}`
    };
  }
};

// ── Document template ─────────────────────────────────────────

const PROJECT_TYPE_LABELS = {
  residential: 'Residential New Build',
  renovation:  'Renovation / Extension',
  commercial:  'Commercial Construction',
  maintenance: 'Maintenance / Repairs',
  fitout:      'Fitout / Refurbishment'
};

export function generateDocument(data) {
  const hasExcl    = !!data.exclusions?.trim();
  const hasAssump  = !!data.assumptions?.trim();
  const hasIncl    = !!data.inclusions?.trim();
  const hasProgram = !!(data.startDate || data.duration || data.programmeNotes);
  const typeLabel  = PROJECT_TYPE_LABELS[data.projectType] || '';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Scope of Works</h1>
      <div class="doc-subtitle">SOW&ndash;${esc(data.scopeNumber || '???')}</div>
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
      ${data.builderPhone ? `<div class="doc-meta-value">${esc(data.builderPhone)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Prepared for</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.clientName || '—')}</div>
      ${data.clientEmail ? `<div class="doc-meta-value">${esc(data.clientEmail)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Project details</div>
      <table class="doc-ref-table">
        <tr><td>Document no.</td><td>SOW-${esc(data.scopeNumber || '???')}</td></tr>
        <tr><td>Project</td><td>${esc(data.projectName || '—')}</td></tr>
        ${data.projectAddress ? `<tr><td>Site</td><td>${esc(data.projectAddress)}</td></tr>` : ''}
        <tr><td>Date issued</td><td>${formatDateLong(data.issueDate) || '—'}</td></tr>
        ${typeLabel ? `<tr><td>Type</td><td>${typeLabel}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <!-- Project Description -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Project Description</h2>
    <p>${esc(data.projectDescription || '—')}</p>
  </div>

  <!-- Scope -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Scope of Works</h2>
    <p>${esc(data.scopeItems || '—')}</p>
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
    <h2 class="doc-section-heading">Assumptions and Qualifications</h2>
    <p>${esc(data.assumptions)}</p>
  </div>` : ''}

  ${hasProgram ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Programme</h2>
    <table class="doc-ref-table">
      ${data.startDate ? `<tr><td>Anticipated start</td><td>${formatDateLong(data.startDate)}</td></tr>` : ''}
      ${data.duration  ? `<tr><td>Estimated duration</td><td>${esc(data.duration)}</td></tr>` : ''}
    </table>
    ${data.programmeNotes ? `<p style="margin-top:10px">${esc(data.programmeNotes)}</p>` : ''}
  </div>` : ''}

  <!-- Approval -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Acknowledgement</h2>
    <p class="doc-approval-instruction">
      This Scope of Works document has been prepared to define the extent of work to be performed.
      Any variation to this scope must be agreed in writing prior to commencement of the varied works.
    </p>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Builder / Contractor</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.preparedBy || 'Authorised Representative')}</div>
          <div class="sig-name-label">Name</div>
        </div>
        <div class="sig-date-row"><div class="sig-date-label">Date</div><div class="sig-date-line"></div></div>
      </div>
      <div class="sig-block">
        <div class="sig-role">Client</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.clientName || 'Client')}</div>
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
