/**
 * Site Diary — Tool Configuration
 */

import { formatDateLong, todayISO } from '../../toolkit/calculator.js';

// ── Counter ──────────────────────────────────────────────────
const COUNTER_KEY = 'bik-diary-counter';
function nextDiaryNumber() {
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
    id: 'diaryNumber',    label: 'Entry number',
    section: 'Project', type: 'text', width: 'half',
    required: true, defaultValue: nextDiaryNumber,
    hint: 'Auto-incremented. Edit if needed.', errorMsg: 'Entry number is required'
  },
  {
    id: 'entryDate',      label: 'Date',
    section: 'Project', type: 'date', width: 'half',
    required: true, defaultValue: todayISO, errorMsg: 'Date is required'
  },

  // ── Weather ────────────────────────────────────────────────
  {
    id: 'weatherCondition', label: 'Weather conditions',
    section: 'Weather', type: 'select', width: 'half',
    required: false, defaultValue: 'fine',
    options: [
      { value: 'fine',     label: 'Fine / clear' },
      { value: 'cloudy',   label: 'Cloudy' },
      { value: 'overcast', label: 'Overcast' },
      { value: 'showers',  label: 'Showers' },
      { value: 'rain',     label: 'Rain' },
      { value: 'storm',    label: 'Storm / lightning' },
      { value: 'wind',     label: 'Strong winds' },
      { value: 'extreme',  label: 'Extreme heat' }
    ]
  },
  {
    id: 'weatherTemp',    label: 'Temperature (°C)',
    section: 'Weather', type: 'text', width: 'half',
    required: false, placeholder: 'e.g. 28', inputmode: 'numeric'
  },
  {
    id: 'weatherImpact',  label: 'Weather impact on works',
    section: 'Weather', type: 'select', width: 'half',
    required: false, defaultValue: 'none',
    options: [
      { value: 'none',     label: 'No impact' },
      { value: 'minor',    label: 'Minor — minor delays' },
      { value: 'moderate', label: 'Moderate — work stopped temporarily' },
      { value: 'full',     label: 'Full — no work today' }
    ]
  },

  // ── Personnel ──────────────────────────────────────────────
  {
    id: 'workforce',      label: 'Workforce on site',
    section: 'Personnel', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: `List trades and number of workers. For example:
- 2 × carpenters (Smith Building)
- 1 × electrician (Bright Electrical)
- 1 × plumber (FlowRight Plumbing)`
  },
  {
    id: 'visitors',       label: 'Visitors / inspections',
    section: 'Personnel', type: 'textarea', width: 'full',
    required: false, rows: 2,
    placeholder: 'e.g. Council building inspector — frame inspection passed. Client on site 2:00pm — 2:30pm.'
  },

  // ── Works Completed ────────────────────────────────────────
  {
    id: 'worksCompleted', label: 'Works completed today',
    section: 'Works Completed', type: 'textarea', width: 'full',
    required: true, rows: 6,
    placeholder: `Describe all work carried out today. For example:
- Completed framing to south wall — top plate installed and plumbed
- Installed window frames to rooms 1, 2 and 3
- Electrical rough-in commenced — first fix wiring to bedrooms`,
    hint: 'AI Writer can expand rough notes into professional diary language',
    errorMsg: 'Works completed is required'
  },

  // ── Deliveries ─────────────────────────────────────────────
  {
    id: 'deliveries',     label: 'Material deliveries received',
    section: 'Deliveries', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'e.g. Mitre 10 — 50 sheets of 10mm plasterboard, 20 bags of cornice cement. Delivery time 10:30am.'
  },

  // ── Incidents & Delays ─────────────────────────────────────
  {
    id: 'incidents',      label: 'Incidents / safety events',
    section: 'Incidents and Delays', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'Record any safety incidents, near misses, or safety observations. If none, leave blank.'
  },
  {
    id: 'delays',         label: 'Delays and issues',
    section: 'Incidents and Delays', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'Record any delays, disputes, unexpected site conditions, or items requiring client or head contractor instruction.'
  },

  // ── Tomorrow ───────────────────────────────────────────────
  {
    id: 'plannedWorks',   label: 'Works planned for tomorrow',
    section: 'Tomorrow', type: 'textarea', width: 'full',
    required: false, rows: 3,
    placeholder: 'Brief summary of works planned for the next working day'
  },

  // ── Sign off ───────────────────────────────────────────────
  {
    id: 'siteSupervisor', label: 'Site supervisor / foreman',
    section: 'Sign Off', type: 'text', width: 'half',
    required: false, profile: true, placeholder: 'Name of supervisor completing this entry'
  }
];

// ── Tool configuration ────────────────────────────────────────

export const DOC_CONFIG = {
  toolId:      'site-diary',
  toolName:    'Site Diary',
  autosaveKey: 'bik-diary-draft',
  docPrefix:   'SD',
  aiFields:    ['worksCompleted', 'delays', 'incidents', 'plannedWorks'],
  printTitle:  'Site Diary',

  getDocTitle(state) {
    return `Site Diary SD-${state.diaryNumber || '??'} — ${state.projectName || 'Untitled'} — ${formatDateLong(state.entryDate) || ''}`;
  },
  getDocRef(state) {
    return `SD-${state.diaryNumber || '??'}`;
  },
  getEmailData(state) {
    return {
      projectName: state.projectName || '',
      reference:   `SD-${state.diaryNumber || '???'}`
    };
  }
};

// ── Document template ─────────────────────────────────────────

const WEATHER_LABELS = {
  fine: 'Fine / clear', cloudy: 'Cloudy', overcast: 'Overcast',
  showers: 'Showers', rain: 'Rain', storm: 'Storm / lightning',
  wind: 'Strong winds', extreme: 'Extreme heat'
};

const IMPACT_LABELS = {
  none: 'No impact on works', minor: 'Minor delays', moderate: 'Work stopped temporarily', full: 'No work today'
};

export function generateDocument(data) {
  const weather    = WEATHER_LABELS[data.weatherCondition] || '';
  const impact     = IMPACT_LABELS[data.weatherImpact] || '';

  return `
<div class="doc-page">

  <!-- Header -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-brand-name"><strong>B</strong>IK Solutions</div>
      <div class="doc-brand-tag">Beyond Industry Knowledge</div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Site Diary</h1>
      <div class="doc-subtitle">SD&ndash;${esc(data.diaryNumber || '???')}</div>
    </div>
  </div>
  <div class="doc-accent-bar"></div>

  <!-- Meta grid -->
  <div class="doc-meta-grid">
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Builder</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.builderName || '—')}</div>
      ${data.siteSupervisor ? `<div class="doc-meta-value">Supervisor: ${esc(data.siteSupervisor)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Project</div>
      <div class="doc-meta-value doc-meta-value--strong">${esc(data.projectName || '—')}</div>
      ${data.projectAddress ? `<div class="doc-meta-value">${esc(data.projectAddress)}</div>` : ''}
    </div>
    <div class="doc-meta-col">
      <div class="doc-meta-heading">Entry details</div>
      <table class="doc-ref-table">
        <tr><td>Entry no.</td><td>SD-${esc(data.diaryNumber || '???')}</td></tr>
        <tr><td>Date</td><td>${formatDateLong(data.entryDate) || '—'}</td></tr>
        ${weather ? `<tr><td>Weather</td><td>${weather}${data.weatherTemp ? `, ${esc(data.weatherTemp)}°C` : ''}</td></tr>` : ''}
        ${impact ? `<tr><td>Impact</td><td>${impact}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <div class="doc-divider"></div>

  <!-- Works Completed -->
  <div class="doc-section">
    <h2 class="doc-section-heading">Works Completed</h2>
    <p>${esc(data.worksCompleted || '—')}</p>
  </div>

  ${data.workforce?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Workforce on Site</h2>
    <p>${esc(data.workforce)}</p>
  </div>` : ''}

  ${data.visitors?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Visitors / Inspections</h2>
    <p>${esc(data.visitors)}</p>
  </div>` : ''}

  ${data.deliveries?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Material Deliveries</h2>
    <p>${esc(data.deliveries)}</p>
  </div>` : ''}

  ${data.incidents?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Incidents / Safety Events</h2>
    <p>${esc(data.incidents)}</p>
  </div>` : ''}

  ${data.delays?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Delays and Issues</h2>
    <p>${esc(data.delays)}</p>
  </div>` : ''}

  ${data.plannedWorks?.trim() ? `
  <div class="doc-section">
    <h2 class="doc-section-heading">Works Planned for Tomorrow</h2>
    <p>${esc(data.plannedWorks)}</p>
  </div>` : ''}

  <!-- Sign off -->
  <div class="doc-section doc-section--approval">
    <h2 class="doc-section-heading">Sign Off</h2>
    <div class="sig-grid" style="grid-template-columns: 1fr">
      <div class="sig-block">
        <div class="sig-role">Site Supervisor / Foreman</div>
        <div class="sig-line-wrap">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(data.siteSupervisor || 'Supervisor')}</div>
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
