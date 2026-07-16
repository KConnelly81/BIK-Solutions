/**
 * SWMS — Safe Work Method Statement
 * Structured draft SWMS for high-risk construction work.
 * This tool produces a starting point only. It must be reviewed, completed,
 * and approved by a competent person before use on site. It does not
 * guarantee or assert compliance with any WHS legislation.
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-swms-counter';

function nextSwmsNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `SW-${String(n).padStart(3, '0')}`;
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

  // ── Job Details ──────────────────────────────────────────────
  {
    id: 'swmsNumber',
    label: 'SWMS number',
    section: 'Job Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextSwmsNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'SWMS number is required'
  },
  {
    id: 'dateCreated',
    label: 'Date created',
    section: 'Job Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'reviewDate',
    label: 'Review date',
    section: 'Job Details',
    type: 'date',
    width: 'half',
    required: false,
    hint: 'Date this SWMS is next due for review'
  },
  {
    id: 'projectName',
    label: 'Project name',
    section: 'Job Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Smith Residence Renovation',
    errorMsg: 'Project name is required'
  },
  {
    id: 'siteAddress',
    label: 'Site address',
    section: 'Job Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Project Street, Brisbane QLD 4000'
  },
  {
    id: 'clientName',
    label: 'Client name',
    section: 'Job Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. John & Jane Smith'
  },
  {
    id: 'principalContractor',
    label: 'Principal contractor',
    section: 'Job Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Name of principal contractor (if different)'
  },
  {
    id: 'workDescription',
    label: 'Nature of high-risk construction work',
    section: 'Job Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 3,
    placeholder: 'Describe the high-risk construction work being performed (e.g. work at height, excavation, demolition, confined space).',
    errorMsg: 'Work description is required'
  },

  // ── High-Risk Activities ─────────────────────────────────────
  {
    id: 'highRiskActivities',
    label: 'High-risk activities',
    section: 'High-Risk Activities',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 4,
    placeholder: 'List each high-risk activity, one per line:\nWorking at height (scaffolding above 2m)\nExcavation — trenching for footings\nOperation of mobile plant',
    errorMsg: 'High-risk activities are required'
  },

  // ── Hazard Register ──────────────────────────────────────────
  {
    id: 'hazardsIdentified',
    label: 'Hazards identified',
    section: 'Hazard Register',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'List the hazards for each activity identified above:\n- Falls from height\n- Struck by falling objects\n- Underground services strike\n- Plant/vehicle interaction',
    errorMsg: 'Hazards identified are required'
  },

  // ── Control Measures ─────────────────────────────────────────
  {
    id: 'controlMeasures',
    label: 'Control measures (hierarchy of controls)',
    section: 'Control Measures',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 6,
    placeholder: 'Describe controls using the hierarchy:\nEliminate: Remove the hazard where possible\nSubstitute: Replace with a safer option\nIsolate: Barricade / exclusion zones\nEngineering: Scaffolding, edge protection, trench shoring\nAdministrative: Safe work procedures, inductions, permits\nPPE: Hard hat, safety harness, steel cap boots, hi-vis vest',
    errorMsg: 'Control measures are required'
  },
  {
    id: 'ppeRequired',
    label: 'PPE required',
    section: 'Control Measures',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List all PPE required for this work:\ne.g. Hard hat, safety harness, steel-capped boots, hi-vis vest, safety glasses, gloves'
  },

  // ── Personnel and Training ───────────────────────────────────
  {
    id: 'licencesRequired',
    label: 'Licences / tickets required',
    section: 'Personnel and Training',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'e.g. Construction Induction (White Card), Working at Heights, EWP Licence, Dogging Ticket'
  },
  {
    id: 'supervisorName',
    label: 'Site supervisor / responsible person',
    section: 'Personnel and Training',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Name of supervisor on site'
  },
  {
    id: 'personnelList',
    label: 'Personnel who have read and understood this SWMS',
    section: 'Personnel and Training',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 4,
    placeholder: 'Names of workers (one per line):\nJohn Smith\nSarah Jones\nMike Brown'
  },

  // ── Review and Sign-off ──────────────────────────────────────
  {
    id: 'emergencyProcedures',
    label: 'Emergency procedures',
    section: 'Review and Sign-off',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Describe emergency procedures including evacuation, first aid response, and notification procedures.'
  },
  {
    id: 'nearestHospital',
    label: 'Nearest hospital / medical centre',
    section: 'Review and Sign-off',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'e.g. Royal Brisbane Hospital — 5 min drive'
  },
  {
    id: 'firstAidOfficer',
    label: 'First aid officer on site',
    section: 'Review and Sign-off',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Name and contact number'
  },
  {
    id: 'builderApprovalName',
    label: 'SWMS prepared by — name',
    section: 'Review and Sign-off',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'swms',
  toolName:        'Safe Work Method Statement',
  autosaveKey:     'bik-swms-draft',
  docPrefix:       'SW',
  aiFields:        ['workDescription', 'hazardsIdentified', 'controlMeasures', 'emergencyProcedures'],
  printTitle:      'Safe Work Method Statement',
  approvalEnabled: true,

  getDocTitle(state) {
    return `SWMS ${state.swmsNumber || '??'} — ${state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.swmsNumber || '??';
  }
};

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const hasClient        = !!data.clientName?.trim();
  const hasPrincipal     = !!data.principalContractor?.trim();
  const hasPPE           = !!data.ppeRequired?.trim();
  const hasLicences      = !!data.licencesRequired?.trim();
  const hasSupervisor    = !!data.supervisorName?.trim();
  const hasPersonnel     = !!data.personnelList?.trim();
  const hasEmergency     = !!data.emergencyProcedures?.trim();
  const hasHospital      = !!data.nearestHospital?.trim();
  const hasFirstAid      = !!data.firstAidOfficer?.trim();
  const hasReviewDate    = !!data.reviewDate;

  // Build personnel rows
  const personnelNames = (data.personnelList || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  // Add 3 blank rows for additional signatures
  const totalRows = personnelNames.length + 3;
  const personnelRows = [];
  for (let i = 0; i < totalRows; i++) {
    const name = personnelNames[i] ? esc(personnelNames[i]) : '&nbsp;';
    personnelRows.push(`
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${name}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">&nbsp;</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">&nbsp;</td>
      </tr>`);
  }

  return `
<div class="doc-page">

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Safe Work Method Statement</h1>
      <div class="doc-subtitle">${esc(data.swmsNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Contractor</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone   ? `<div>${esc(data.builderPhone)}</div>`   : ''}
        ${data.builderEmail   ? `<div>${esc(data.builderEmail)}</div>`   : ''}
        ${data.builderAddress ? `<div>${esc(data.builderAddress)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Project</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
      ${hasClient    ? `<div class="doc-meta-value">Client: ${esc(data.clientName)}</div>` : ''}
      ${hasPrincipal ? `<div class="doc-meta-value">Principal: ${esc(data.principalContractor)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">SWMS details</div>
      <table class="doc-ref-table">
        <tr><td>SWMS no.</td><td>${esc(data.swmsNumber || '—')}</td></tr>
        <tr><td>Date created</td><td>${formatDateLong(data.dateCreated) || '—'}</td></tr>
        ${hasReviewDate ? `<tr><td>Review date</td><td>${formatDateLong(data.reviewDate)}</td></tr>` : ''}
        ${hasSupervisor ? `<tr><td>Supervisor</td><td>${esc(data.supervisorName)}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Nature of High-Risk Construction Work</h2>
    <p>${esc(data.workDescription || '—')}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">High-Risk Activities</h2>
    <p>${esc(data.highRiskActivities || '—')}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Hazards Identified</h2>
    <p>${esc(data.hazardsIdentified || '—')}</p>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Control Measures (Hierarchy of Controls)</h2>
    <p>${esc(data.controlMeasures || '—')}</p>
  </div>

  ${hasPPE ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Personal Protective Equipment (PPE) Required</h2>
    <p>${esc(data.ppeRequired)}</p>
  </div>` : ''}

  ${hasLicences ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Licences and Tickets Required</h2>
    <p>${esc(data.licencesRequired)}</p>
  </div>` : ''}

  <div class="doc-section">
    <h2 class="doc-section-heading">Emergency Information</h2>
    ${hasEmergency ? `<p>${esc(data.emergencyProcedures)}</p>` : '<p>Follow site emergency procedures. Call 000 in an emergency.</p>'}
    <table class="doc-ref-table" style="margin-top:8px;">
      <tr><td>Emergency services</td><td><strong>000</strong></td></tr>
      ${hasHospital ? `<tr><td>Nearest hospital</td><td>${esc(data.nearestHospital)}</td></tr>` : ''}
      ${hasFirstAid ? `<tr><td>First aid officer</td><td>${esc(data.firstAidOfficer)}</td></tr>` : ''}
    </table>
  </div>

  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Personnel Sign-off Register</h2>
    <p>All workers must read and understand this SWMS before commencing work. Sign below to confirm you have read, understood, and agree to follow this Safe Work Method Statement.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:0.85rem;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Name</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Signature</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Date</th>
        </tr>
      </thead>
      <tbody>
        ${personnelRows.join('')}
      </tbody>
    </table>
  </div>

  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">SWMS Authorisation</h2>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Prepared by — ${esc(data.builderName || 'Contractor')}</div>
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
    <strong>Important — WHS obligations:</strong> This document is a structured draft prepared from information supplied by the user. It must be reviewed by a competent person with knowledge of the specific worksite before any work commences. It does not constitute legal advice. It does not assert or guarantee compliance with the Work Health and Safety Act 2011, the WHS Regulation, or any other applicable WHS legislation. Compliance requires site-specific hazard identification, genuine worker consultation, appropriate control measures, implementation, and ongoing monitoring — none of which can be provided by a document-generation tool. The PCBU (person conducting a business or undertaking) and each employer remain responsible for all WHS obligations. This document must be kept on site and reviewed whenever conditions change.
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
