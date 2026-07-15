/**
 * Email Helper — BIK Document Toolkit
 *
 * Generates and opens mailto: links with pre-populated professional email bodies.
 * Phase 1: client-side mailto only.
 * EMAIL_SEND_POINT — replace openEmail() with a server-side send API in Phase 2.
 */

/**
 * Open the user's default email client with a pre-populated email.
 *
 * @param {Object} opts
 * @param {string}   opts.to          — recipient email (optional)
 * @param {string}   opts.subject     — email subject
 * @param {string}   opts.body        — plain text email body
 * @param {Function} opts.toastFn     — toast callback for attachment reminder
 */
export function openEmail({ to = '', subject, body, toastFn }) {
  const params = new URLSearchParams();
  if (to) params.set('to', to);
  params.set('subject', subject);
  params.set('body', body);

  // URLSearchParams uses + for spaces; mailto needs %20
  const query = params.toString().replace(/\+/g, '%20');
  const mailto = `mailto:${to}?${query}`;

  // Create a hidden link and click it — more reliable than window.location for mailto
  const a = document.createElement('a');
  a.href = mailto;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  toastFn?.('Email client opened. Attach the PDF before sending.');
}

/**
 * Generate a professional email body for a document.
 *
 * @param {Object} opts
 * @param {string} opts.toolName       — 'Variation Notice' | 'Quote' | etc.
 * @param {string} opts.reference      — 'VN-001' | 'Q-001' | etc.
 * @param {string} opts.clientName     — recipient name
 * @param {string} opts.projectName    — project name
 * @param {string} opts.builderName    — sender business name
 * @param {string} opts.builderPhone   — sender phone
 * @param {string} opts.builderEmail   — sender email
 * @param {string[]} [opts.extraLines] — additional lines before closing
 * @returns {string}
 */
export function generateEmailBody({
  toolName,
  reference,
  clientName,
  projectName,
  builderName,
  builderPhone,
  builderEmail,
  extraLines = []
}) {
  const greeting = clientName ? `Hi ${clientName.split(' ')[0]},` : 'Hi,';
  const ref      = reference ? ` (${reference})` : '';
  const extras   = extraLines.length ? '\n' + extraLines.join('\n') + '\n' : '';

  const sig = [
    `Kind regards,`,
    builderName || '',
    builderPhone || '',
    builderEmail || ''
  ].filter(Boolean).join('\n');

  return [
    greeting,
    '',
    `Please find attached the ${toolName}${ref} for ${projectName || 'your project'}.`,
    '',
    'Please review the attached document at your earliest convenience.',
    extras,
    'If you have any questions or require clarification, please don\'t hesitate to get in touch.',
    '',
    sig
  ].join('\n').trim();
}

/**
 * Generate an email subject line for a document.
 *
 * @param {string} toolName   — 'Variation Notice'
 * @param {string} reference  — 'VN-001'
 * @param {string} projectName
 * @returns {string}
 */
export function generateEmailSubject(toolName, reference, projectName) {
  const parts = [toolName];
  if (reference)   parts.push(reference);
  if (projectName) parts.push(`— ${projectName}`);
  return parts.join(' ');
}
