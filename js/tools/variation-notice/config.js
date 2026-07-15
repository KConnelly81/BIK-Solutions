/**
 * Variation Notice — Tool Configuration
 * Defines the form schema and document template for this tool.
 *
 * SCHEMA: array of field objects consumed by FormEngine.
 * generateDocument: (data) => htmlString — consumed by DocumentRenderer.
 *
 * Field shape:
 * {
 *   id:           string     — unique key, matches generated document data
 *   label:        string     — display label
 *   section:      string     — groups fields under a heading
 *   type:         'text' | 'number' | 'date' | 'select' | 'textarea'
 *   width:        'half' | 'full'  (default: full)
 *   required:     boolean
 *   defaultValue: any | () => any
 *   placeholder:  string
 *   hint:         string     — small helper text below input
 *   errorMsg:     string     — validation message
 *   rows:         number     — textarea only
 *   options:      [{value, label}]  — select only
 *   min/max/step: number     — number input only
 *   autocomplete: string     — HTML autocomplete attribute
 * }
 */

/** Returns the next variation number from localStorage, then increments. */
function nextVariationNumber() {
  const key = 'bik-variation-counter';
  const n = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, String(n));
  return String(n).padStart(3, '0');
}

/** Today's date as YYYY-MM-DD for the date input default. */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const SCHEMA = [
  // ── Section 1: Project Details ──────────────────────────────
  {
    id: 'clientName',
    label: 'Client name',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    placeholder: 'e.g. John Smith',
    autocomplete: 'off',
    errorMsg: 'Client name is required'
  },
  {
    id: 'projectName',
    label: 'Project name / address',
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
    placeholder: '123 Example Street, Brisbane QLD 4000'
  },
  {
    id: 'variationNumber',
    label: 'Variation number',
    section: 'Project Details',
    type: 'text',
    width: 'half',
    required: true,
    defaultValue: nextVariationNumber,
    hint: 'Auto-incremented. Edit if needed.',
    errorMsg: 'Variation number is required'
  },
  {
    id: 'date',
    label: 'Date',
    section: 'Project Details',
    type: 'date',
    width: 'half',
    required: true,
    defaultValue: todayISO,
    errorMsg: 'Date is required'
  },
  {
    id: 'requestedBy',
    label: 'Variation requested by',
    section: 'Project Details',
    type: 'text',
    width: 'full',
    required: false,
    placeholder: 'e.g. Client, Architect, Builder'
  },

  // ── Section 2: Variation Details ────────────────────────────
  {
    id: 'reasonForVariation',
    label: 'Reason for variation',
    section: 'Variation Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 3,
    placeholder: 'Describe why this variation is required (client request, unforeseen site condition, design change, etc.)',
    errorMsg: 'Reason for variation is required'
  },
  {
    id: 'descriptionOfWork',
    label: 'Description of work',
    section: 'Variation Details',
    type: 'textarea',
    width: 'full',
    required: true,
    rows: 5,
    placeholder: 'Describe in detail the work to be performed under this variation...',
    errorMsg: 'Work description is required'
  },

  // ── Section 3: Resources ────────────────────────────────────
  {
    id: 'materialsRequired',
    label: 'Materials required',
    section: 'Resources',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'List materials, quantities and specifications (leave blank if labour only)'
  },
  {
    id: 'labourRequired',
    label: 'Labour required',
    section: 'Resources',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Describe trades and estimated hours'
  },

  // ── Section 4: Cost & Time ───────────────────────────────────
  {
    id: 'additionalCost',
    label: 'Additional cost (excl. GST) $',
    section: 'Cost & Time',
    type: 'number',
    width: 'half',
    required: true,
    defaultValue: '',
    placeholder: '0.00',
    min: 0,
    step: 0.01,
    errorMsg: 'Enter the additional cost (enter 0 if nil)'
  },
  {
    id: 'gstApplicable',
    label: 'GST applicable?',
    section: 'Cost & Time',
    type: 'select',
    width: 'half',
    required: true,
    defaultValue: 'yes',
    options: [
      { value: 'yes', label: 'Yes — add 10% GST' },
      { value: 'no',  label: 'No — GST-free' }
    ]
  },
  {
    id: 'extensionOfTime',
    label: 'Extension of time (days)',
    section: 'Cost & Time',
    type: 'number',
    width: 'half',
    required: false,
    defaultValue: '0',
    placeholder: '0',
    min: 0,
    step: 1,
    hint: 'Enter 0 if no extension required'
  },

  // ── Section 5: Notes ────────────────────────────────────────
  {
    id: 'builderNotes',
    label: 'Builder notes',
    section: 'Notes',
    type: 'textarea',
    width: 'full',
    required: false,
    rows: 3,
    placeholder: 'Any additional notes, conditions, or exclusions for this variation'
  }
];

// ── Document template ────────────────────────────────────────

/** Format a number as AUD currency string. */
function formatAUD(n) {
  return Number(n || 0).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2
  });
}

/** Format ISO date string as "15 July 2026". */
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Generate the Variation Notice document HTML.
 * Called by DocumentRenderer. Keep pure — no DOM access, no side effects.
 *
 * AI_INTEGRATION_POINT: Replace this function with an async API call
 * when the AI backend is available. The returned HTML structure must
 * remain compatible with the .doc-page CSS in toolkit-app.css.
 *
 * @param {Object} data — form state from FormEngine.getState()
 * @returns {string} — HTML string wrapping a .doc-page element
 */
export function generateDocument(data) {
  const cost = parseFloat(data.additionalCost) || 0;
  const gst  = data.gstApplicable === 'yes' ? cost * 0.1 : 0;
  const total = cost + gst;
  const eot   = parseInt(data.extensionOfTime, 10) || 0;

  const materialsSection = data.materialsRequired && data.materialsRequired.trim()
    ? `<div class="doc-section">
        <h3 class="doc-section-heading">Materials Required</h3>
        <p>${escHtml(data.materialsRequired)}</p>
      </div>` : '';

  const labourSection = data.labourRequired && data.labourRequired.trim()
    ? `<div class="doc-section">
        <h3 class="doc-section-heading">Labour Required</h3>
        <p>${escHtml(data.labourRequired)}</p>
      </div>` : '';

  const eotSection = eot > 0
    ? `<div class="doc-section">
        <h3 class="doc-section-heading">Extension of Time</h3>
        <p>This variation requires an extension of <strong>${eot} calendar day${eot !== 1 ? 's' : ''}</strong> to the practical completion date.</p>
      </div>` : '';

  const notesSection = data.builderNotes && data.builderNotes.trim()
    ? `<div class="doc-section">
        <h3 class="doc-section-heading">Notes &amp; Conditions</h3>
        <p>${escHtml(data.builderNotes)}</p>
      </div>` : '';

  const requestedByRow = data.requestedBy && data.requestedBy.trim()
    ? `<tr><td>Requested By</td><td>${escHtml(data.requestedBy)}</td></tr>` : '';

  const siteRow = data.siteAddress && data.siteAddress.trim()
    ? `<tr><td>Site Address</td><td>${escHtml(data.siteAddress)}</td></tr>` : '';

  return `
<div class="doc-page">
  <div class="doc-header">
    <div class="doc-brand">
      <span class="doc-brand-name">B<span style="font-weight:400">IK Solutions</span></span>
      <span class="doc-brand-tag">Beyond Industry Knowledge</span>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">Variation Notice</h1>
      <p class="doc-subtitle">Ref: VN-${escHtml(data.variationNumber || '—')}</p>
    </div>
  </div>

  <div class="doc-accent-bar"></div>

  <table class="doc-meta-table">
    <tbody>
      <tr><td>Client</td><td>${escHtml(data.clientName || '—')}</td></tr>
      <tr><td>Project</td><td>${escHtml(data.projectName || '—')}</td></tr>
      ${siteRow}
      <tr><td>Date Issued</td><td>${formatDate(data.date) || '—'}</td></tr>
      ${requestedByRow}
    </tbody>
  </table>

  <div class="doc-section">
    <h3 class="doc-section-heading">Reason for Variation</h3>
    <p>${escHtml(data.reasonForVariation || '—')}</p>
  </div>

  <div class="doc-section">
    <h3 class="doc-section-heading">Description of Work</h3>
    <p>${escHtml(data.descriptionOfWork || '—')}</p>
  </div>

  ${materialsSection}
  ${labourSection}

  <div class="doc-section">
    <h3 class="doc-section-heading">Cost Summary</h3>
    <table class="doc-cost-table">
      <tbody>
        <tr>
          <td>Additional cost (excl. GST)</td>
          <td>${formatAUD(cost)}</td>
        </tr>
        ${gst > 0 ? `<tr><td>GST (10%)</td><td>${formatAUD(gst)}</td></tr>` : '<tr><td>GST</td><td>Not applicable</td></tr>'}
        <tr class="total">
          <td>Total variation amount</td>
          <td>${formatAUD(total)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${eotSection}
  ${notesSection}

  <div class="sig-grid">
    <div class="sig-block">
      <span class="sig-label">Builder / Contractor</span>
      <div class="sig-line"></div>
      <span class="sig-name">Authorised Signature</span>
      <span class="sig-date-label">Date</span>
      <div class="sig-date-line"></div>
    </div>
    <div class="sig-block">
      <span class="sig-label">Client Acknowledgement</span>
      <div class="sig-line"></div>
      <span class="sig-name">${escHtml(data.clientName || 'Client Signature')}</span>
      <span class="sig-date-label">Date</span>
      <div class="sig-date-line"></div>
    </div>
  </div>

  <div class="doc-footer">
    This Variation Notice forms part of the original contract and must be signed by both parties before work commences.
    Prepared by BIK Solutions — Beyond Industry Knowledge | biksolutions.com.au
  </div>
</div>`.trim();
}

/** Minimal HTML entity escaping to prevent XSS in the generated document. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
