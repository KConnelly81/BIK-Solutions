/**
 * Toolbox Talk — Tool Configuration
 * Toolbox talk record with attendance register.
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

const COUNTER_KEY = 'bik-toolbox-talk-counter';

function nextTalkNumber() {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(n));
  return `TT-${String(n).padStart(3, '0')}`;
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

  // ── Meeting Details ──────────────────────────────────────────
  {
    id: 'talkNumber',
    label: 'Talk number',
    section: 'Meeting Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextTalkNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Talk number is required'
  },
  {
    id: 'talkDate',
    label: 'Date',
    section: 'Meeting Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'talkTime',
    label: 'Time',
    section: 'Meeting Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: '7:00 AM'
  },
  {
    id: 'projectName',
    label: 'Project name',
    section: 'Meeting Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Smith Residence Renovation',
    errorMsg: 'Project name is required'
  },
  {
    id: 'siteAddress',
    label: 'Site address',
    section: 'Meeting Details',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 2,
    placeholder: '456 Project Street, Brisbane QLD 4000'
  },
  {
    id: 'presenter',
    label: 'Presenter / facilitator',
    section: 'Meeting Details',
    type: 'text',
    width: 'half',
    required: false,
    placeholder: 'Who delivered the talk'
  },
  {
    id: 'topic',
    label: 'Main topic',
    section: 'Meeting Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. Working at Heights, Manual Handling, Electrical Safety',
    errorMsg: 'Topic is required'
  },

  // ── Topics Covered ───────────────────────────────────────────
  {
    id: 'safetyTopicsCovered',
    label: 'Topics and content covered',
    section: 'Topics Covered',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Describe in detail the content covered during this toolbox talk.',
    errorMsg: 'Topics covered are required'
  },
  {
    id: 'hazardsDiscussed',
    label: 'Hazards discussed',
    section: 'Topics Covered',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List the specific hazards discussed and the controls identified.'
  },
  {
    id: 'actionsRequired',
    label: 'Actions required / follow-up items',
    section: 'Topics Covered',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List follow-up actions, responsible person, and target date:\ne.g. Install edge protection — John Smith — by 20/07/2026'
  },

  // ── Attendance Register ──────────────────────────────────────
  {
    id: 'attendeeCount',
    label: 'Number of attendees',
    section: 'Attendance Register',
    type: 'number',
    width: 'half',
    required: false,
    placeholder: '0',
    min: 0,
    step: 1,
    inputmode: 'numeric'
  },
  {
    id: 'attendeeNames',
    label: 'Attendee names',
    section: 'Attendance Register',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 6,
    placeholder: 'One name per line:\nJohn Smith\nSarah Jones\nMike Brown'
  },
  {
    id: 'builderApprovalName',
    label: 'Presenter / supervisor name',
    section: 'Attendance Register',
    type: 'text',
    width: 'half',
    required: false,
    profile: true,
    placeholder: 'Authorised person name'
  }

];

export const DOC_CONFIG = {
  toolId:          'toolbox-talk',
  toolName:        'Toolbox Talk',
  autosaveKey:     'bik-toolbox-talk-draft',
  docPrefix:       'TT',
  aiFields:        ['safetyTopicsCovered', 'hazardsDiscussed', 'actionsRequired'],
  printTitle:      'Toolbox Talk Record',
  approvalEnabled: false,

  getDocTitle(state) {
    return `Toolbox Talk ${state.talkNumber || '??'} — ${state.topic || state.projectName || 'Untitled'}`;
  },
  getDocRef(state) {
    return state.talkNumber || '??';
  }
};

// ── Document template ────────────────────────────────────────

export function generateDocument(data) {
  const hasHazards  = !!data.hazardsDiscussed?.trim();
  const hasActions  = !!data.actionsRequired?.trim();
  const hasTime     = !!data.talkTime?.trim();
  const hasPresenter = !!data.presenter?.trim();
  const hasCount    = !!(data.attendeeCount);

  // Build attendance rows
  const names = (data.attendeeNames || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const blankRows = Math.max(3, 10 - names.length);
  const attendeeRows = [];

  names.forEach(name => {
    attendeeRows.push(`
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${esc(name)}</td>
        <td style="padding:8px;border:1px solid #ddd;width:200px;">&nbsp;</td>
      </tr>`);
  });
  for (let i = 0; i < blankRows; i++) {
    attendeeRows.push(`
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">&nbsp;</td>
        <td style="padding:8px;border:1px solid #ddd;width:200px;">&nbsp;</td>
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
      <h1 class="doc-title">Toolbox Talk Record</h1>
      <div class="doc-subtitle">${esc(data.talkNumber || '???')}</div>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Organisation</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.builderABN ? `<div class="doc-meta-value">ABN ${esc(data.builderABN)}</div>` : ''}
      <div class="doc-meta-contact">
        ${data.builderPhone ? `<div>${esc(data.builderPhone)}</div>` : ''}
        ${data.builderEmail ? `<div>${esc(data.builderEmail)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Meeting details</div>
      <table class="doc-ref-table">
        <tr><td>Record no.</td><td>${esc(data.talkNumber || '—')}</td></tr>
        <tr><td>Date</td><td>${formatDateLong(data.talkDate) || '—'}</td></tr>
        ${hasTime      ? `<tr><td>Time</td><td>${esc(data.talkTime)}</td></tr>` : ''}
        ${hasPresenter ? `<tr><td>Presenter</td><td>${esc(data.presenter)}</td></tr>` : ''}
        ${hasCount     ? `<tr><td>Attendees</td><td>${esc(data.attendeeCount)}</td></tr>` : ''}
      </table>
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Site</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.projectName || '—')}</div>
      ${data.siteAddress ? `<div class="doc-meta-value">${esc(data.siteAddress)}</div>` : ''}
    </div>
  </div>

  <div class="doc-divider"></div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Topic: ${esc(data.topic || '—')}</h2>
    <p>${esc(data.safetyTopicsCovered || '—')}</p>
  </div>

  ${hasHazards ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Hazards Discussed</h2>
    <p>${esc(data.hazardsDiscussed)}</p>
  </div>` : ''}

  ${hasActions ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Actions Required / Follow-up Items</h2>
    <p>${esc(data.actionsRequired)}</p>
  </div>` : ''}

  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Attendance Register</h2>
    <p>All attendees must sign below to confirm they attended this toolbox talk and understood the content.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:0.85rem;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Name</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Signature</th>
        </tr>
      </thead>
      <tbody>
        ${attendeeRows.join('')}
      </tbody>
    </table>
  </div>

  <div class="doc-section">
    <h2 class="doc-section-heading">Presenter / Supervisor Sign-off</h2>
    <div class="sig-grid">
      <div class="sig-block">
        <div class="sig-role">Presenter / Supervisor</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.builderApprovalName || data.presenter || 'Supervisor')}</div>
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
    <strong>Important:</strong> This document was generated from information supplied by the user. It must be reviewed for accuracy and completeness before use. This toolbox talk record does not constitute a formal safety management system document. Retain this record for a minimum of 5 years as part of your WHS records.
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
