/**
 * BIK Health Engine — Deterministic Project Health Analysis
 *
 * Evaluates each project against its document records and produces
 * structured health reports with categorised alerts and a suggested
 * next action.
 *
 * Architecture:
 *   Pure functions, no DOM, no side effects.
 *   All outputs are plain objects that can be serialised to JSON.
 *   Data flows in one direction: projectData → rules → HealthReport.
 *
 * HEALTH_ENGINE_SWAP_POINT
 *   Replace evaluateProject() with an async API call to an AI endpoint.
 *   The HealthReport shape is the contract — the UI consumes it without
 *   caring whether it came from rules or a model.
 *
 * @module health-engine
 */

// ── Types (JSDoc) ───────────────────────────────────────────────────

/**
 * @typedef {Object} Action
 * @property {string}  label
 * @property {string}  href
 * @property {boolean} isPrimary
 */

/**
 * @typedef {Object} Alert
 * @property {string}   id           — stable, deterministic key
 * @property {string}   category     — 'pending-approval' | 'approval-overdue' | 'missing-diary' | 'quote-expiry' | 'no-quote' | 'draft-document' | 'recently-approved' | 'quote-pending'
 * @property {string}   severity     — 'critical' | 'warning' | 'info'
 * @property {string}   headline
 * @property {string}   detail
 * @property {Action[]} actions
 */

/**
 * @typedef {Object} ContractSummary
 * @property {number}  baseAmount
 * @property {number}  variationTotal
 * @property {number}  currentTotal
 * @property {number}  pendingAmount   — pending (unapproved) variation total
 * @property {string|null} baseQuoteId
 * @property {string|null} baseQuoteRef
 */

/**
 * @typedef {Object} HealthReport
 * @property {string}          projectId
 * @property {Object}          project
 * @property {number}          healthScore     — 0–100
 * @property {string}          status          — 'healthy' | 'attention' | 'critical'
 * @property {ContractSummary} contractSummary
 * @property {Alert[]}         alerts          — sorted: critical first
 * @property {Action|null}     suggestedNextAction
 * @property {Object}          metrics         — quick counts for the dashboard
 */

// ── Tool meta (must stay in sync with TOOL_META in UI files) ────────

const TOOLS = {
  'variation-notice':    { name: 'Variation Notice',       url: 'variation-generator.html',  icon: '📋' },
  'quote-builder':       { name: 'Quote Builder',          url: 'quote-builder.html',         icon: '💰' },
  'scope-of-works':      { name: 'Scope of Works',         url: 'scope-of-works.html',        icon: '📝' },
  'site-diary':          { name: 'Site Diary',             url: 'site-diary.html',            icon: '📅' },
  'defect-report':       { name: 'Defect Report',          url: 'defect-report.html',         icon: '🔍' },
  'progress-claim':      { name: 'Progress Claim',         url: 'progress-claim.html',        icon: '🧾' },
  'toolbox-talk':        { name: 'Toolbox Talk',           url: 'toolbox-talk.html',          icon: '🦺' },
  'payment-reminder':    { name: 'Payment Reminder',       url: 'payment-reminder.html',      icon: '💳' },
  'practical-completion':{ name: 'Practical Completion',   url: 'practical-completion.html',  icon: '🏁' },
  'handover-checklist':  { name: 'Handover Checklist',     url: 'handover-checklist.html',    icon: '✅' },
  'itp':                 { name: 'Inspection & Test Plan', url: 'itp.html',                   icon: '🔬' },
  'non-conformance-report':{ name: 'Non-Conformance Report', url: 'ncr.html',                 icon: '⚠️' },
  'incident-report':     { name: 'Incident Report',        url: 'incident-report.html',       icon: '🚑' },
  'eot-claim':           { name: 'EOT Claim',              url: 'eot-claim.html',             icon: '⏱️' },
  'delay-notice':        { name: 'Delay Notice',           url: 'delay-notice.html',          icon: '📢' },
  'inspection-checklist':{ name: 'Inspection Checklist',   url: 'inspection-checklist.html',  icon: '📋' }
};

const AUTOSAVE_KEYS = {
  'variation-notice':    'bik-variation-draft',
  'quote-builder':       'bik-quote-draft',
  'scope-of-works':      'bik-scope-draft',
  'site-diary':          'bik-diary-draft',
  'defect-report':       'bik-defect-draft',
  'progress-claim':      'bik-progress-claim-draft',
  'toolbox-talk':        'bik-toolbox-talk-draft',
  'payment-reminder':    'bik-payment-reminder-draft',
  'practical-completion':'bik-practical-completion-draft',
  'handover-checklist':  'bik-handover-checklist-draft',
  'itp':                 'bik-itp-draft',
  'non-conformance-report':'bik-non-conformance-report-draft',
  'incident-report':     'bik-incident-report-draft',
  'eot-claim':           'bik-eot-claim-draft',
  'delay-notice':        'bik-delay-notice-draft',
  'inspection-checklist':'bik-inspection-checklist-draft'
};

// ── Utility ─────────────────────────────────────────────────────────

function daysSince(isoTs) {
  if (!isoTs) return Infinity;
  return (Date.now() - new Date(isoTs).getTime()) / 86400000;
}

function formatAUD(n) {
  return '$' + Number(n || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(isoTs) {
  if (!isoTs) return '—';
  return new Date(isoTs).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function floorDays(n) {
  return Math.floor(n);
}

// ── Contract summary ─────────────────────────────────────────────────

function buildContractSummary(docs) {
  const approvedQuotes = docs.filter(
    d => d.toolId === 'quote-builder' && d.approval?.status === 'approved'
  );
  const approvedVariations = docs.filter(
    d => d.toolId === 'variation-notice' && d.approval?.status === 'approved'
  );
  const pendingVariations = docs.filter(
    d => d.toolId === 'variation-notice' &&
         ['draft', 'sent'].includes(d.approval?.status || 'draft')
  );

  const baseQuote    = approvedQuotes[0] || null;
  const baseAmount   = baseQuote ? (Number(baseQuote.extraData?.subtotal) || 0) : 0;

  const variationTotal = approvedVariations.reduce(
    (s, v) => s + (parseFloat(v.formData?.additionalCost) || 0), 0
  );
  const pendingAmount = pendingVariations.reduce(
    (s, v) => s + (parseFloat(v.formData?.additionalCost) || 0), 0
  );

  const currentTotal = baseAmount + variationTotal;

  return {
    baseAmount,
    variationTotal,
    currentTotal,
    pendingAmount,
    baseQuoteId:  baseQuote?.id   || null,
    baseQuoteRef: baseQuote?.reference || null,
    approvedVariationCount: approvedVariations.length,
    pendingVariationCount:  pendingVariations.length
  };
}

// ── Rule functions — each returns zero or more Alert objects ─────────

function rulePendingApprovals(project, docs) {
  const alerts = [];
  docs.forEach(doc => {
    const a = doc.approval;
    if (!a || a.status !== 'sent' || !a.sentAt) return;
    const meta  = TOOLS[doc.toolId];
    if (!meta) return;
    const days  = daysSince(a.sentAt);
    if (days < 1) return;

    const overdue  = days >= 5;
    const daysStr  = `${floorDays(days)} day${floorDays(days) !== 1 ? 's' : ''}`;
    const subject  = encodeURIComponent(`Follow up: ${doc.reference} — ${project.name}`);
    const body     = encodeURIComponent(buildChaserEmail(project, doc, a, floorDays(days)));
    const mailto   = `mailto:${encodeURIComponent(a.sentTo || '')}?subject=${subject}&body=${body}`;

    alerts.push({
      id:       `pending-${doc.id}`,
      category: overdue ? 'approval-overdue' : 'pending-approval',
      severity: overdue ? 'critical' : 'warning',
      headline: overdue
        ? `${doc.reference} — no response after ${daysStr}`
        : `${doc.reference} awaiting approval (${daysStr})`,
      detail: a.sentTo
        ? `Sent to ${a.sentTo} on ${formatDate(a.sentAt)}`
        : `Sent ${daysStr} ago`,
      actions: [
        { label: 'Open document', href: `${meta.url}?resume=${doc.id}`, isPrimary: false },
        { label: overdue ? 'Send urgent follow-up' : 'Send follow-up', href: mailto, isPrimary: true }
      ]
    });
  });
  return alerts;
}

function ruleMissingDiary(project, docs) {
  if (project.status !== 'active') return [];
  const diaries  = docs.filter(d => d.toolId === 'site-diary');
  if (diaries.length === 0) return [];
  const recent   = diaries.find(d => daysSince(d.createdAt) < 7);
  if (recent) return [];
  const lastDiary = diaries[0];
  return [{
    id:       `missing-diary-${project.id}`,
    category: 'missing-diary',
    severity: 'warning',
    headline: 'No site diary this week',
    detail:   `Last entry: ${formatDate(lastDiary.createdAt)}`,
    actions:  [
      { label: 'Create site diary', href: `site-diary.html?project=${project.id}`, isPrimary: true }
    ]
  }];
}

function ruleQuoteExpiry(project, docs) {
  const alerts = [];
  docs.filter(d => d.toolId === 'quote-builder').forEach(doc => {
    const validUntil = doc.formData?.validUntil;
    const status     = doc.approval?.status || 'draft';
    if (!validUntil || status === 'approved' || status === 'archived') return;
    if (new Date(validUntil) >= new Date()) return;
    const daysExpired = floorDays(daysSince(validUntil));
    alerts.push({
      id:       `quote-expiry-${doc.id}`,
      category: 'quote-expiry',
      severity: 'warning',
      headline: `${doc.reference} may have expired`,
      detail:   `Valid until ${formatDate(validUntil)} — ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago`,
      actions:  [
        { label: 'Review quote', href: `quote-builder.html?resume=${doc.id}`, isPrimary: true }
      ]
    });
  });
  return alerts;
}

function ruleNoQuote(project, docs) {
  if (project.status !== 'active') return [];
  const hasQuote = docs.some(d => d.toolId === 'quote-builder');
  if (hasQuote) return [];
  return [{
    id:       `no-quote-${project.id}`,
    category: 'no-quote',
    severity: 'info',
    headline: 'No quote on file',
    detail:   'Lock in scope and pricing before work begins',
    actions:  [
      { label: 'Create quote', href: `quote-builder.html?project=${project.id}`, isPrimary: true }
    ]
  }];
}

function ruleRecentlyApproved(project, docs) {
  const alerts = [];
  docs.forEach(doc => {
    const a = doc.approval;
    if (!a || a.status !== 'approved' || !a.approvedAt) return;
    if (daysSince(a.approvedAt) > 7) return;
    const meta = TOOLS[doc.toolId];
    if (!meta) return;
    alerts.push({
      id:       `approved-${doc.id}`,
      category: 'recently-approved',
      severity: 'info',
      headline: `${doc.reference} approved`,
      detail:   `Approved ${formatDate(a.approvedAt)}`,
      actions:  [
        { label: 'View document', href: `${meta.url}?resume=${doc.id}`, isPrimary: false },
        { label: 'Open project',  href: `project.html?id=${project.id}`, isPrimary: true }
      ]
    });
  });
  return alerts;
}

function ruleQuotePending(project, docs) {
  const alerts = [];
  docs.filter(d => d.toolId === 'quote-builder').forEach(doc => {
    const a = doc.approval;
    const status = a?.status || 'draft';
    if (status !== 'draft' && status !== 'sent') return;
    const days = daysSince(doc.createdAt);
    if (days < 3) return;
    alerts.push({
      id:       `quote-pending-${doc.id}`,
      category: 'quote-pending',
      severity: 'info',
      headline: `${doc.reference} not yet sent`,
      detail:   `Created ${floorDays(days)} day${floorDays(days) !== 1 ? 's' : ''} ago and not yet sent for approval`,
      actions:  [
        { label: 'Open quote', href: `quote-builder.html?resume=${doc.id}`, isPrimary: true }
      ]
    });
  });
  return alerts;
}

// ── Pre-written chaser email ─────────────────────────────────────────

function buildChaserEmail(project, doc, approval, daysSent) {
  const greeting = approval.sentTo ? `Dear ${approval.sentTo},` : 'Dear Client,';
  return `${greeting}

I am following up on ${doc.reference} sent ${daysSent} day${daysSent !== 1 ? 's' : ''} ago in relation to ${project.name}.

Could you please review and respond at your earliest convenience so we can proceed with the works without delay.

Please don't hesitate to contact me if you have any questions.

Kind regards`;
}

// ── Health score ─────────────────────────────────────────────────────

const SEVERITY_DEDUCTIONS = {
  critical: 30,
  warning:  15,
  info:      3
};

function calcHealthScore(alerts) {
  let score = 100;
  alerts.forEach(a => {
    score -= (SEVERITY_DEDUCTIONS[a.severity] || 0);
  });
  return Math.max(0, Math.min(100, score));
}

function scoreToStatus(score) {
  if (score >= 85) return 'healthy';
  if (score >= 60) return 'attention';
  return 'critical';
}

// ── Suggested next action ─────────────────────────────────────────────

function suggestNextAction(project, docs, alerts) {
  // Highest priority alert's primary action
  const sorted = [...alerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  const top = sorted[0];
  if (top) {
    const primary = top.actions.find(a => a.isPrimary) || top.actions[0];
    if (primary) return { label: primary.label, href: primary.href, reason: top.headline };
  }

  // No alerts — suggest the most natural next step based on project state
  const hasApprovedQuote  = docs.some(d => d.toolId === 'quote-builder' && d.approval?.status === 'approved');
  const hasVariation      = docs.some(d => d.toolId === 'variation-notice');
  const hasDiary          = docs.some(d => d.toolId === 'site-diary');

  if (project.status === 'active') {
    if (!hasApprovedQuote) return { label: 'Create quote', href: `quote-builder.html?project=${project.id}`, reason: 'No quote on file' };
    if (!hasDiary)         return { label: 'Start site diary', href: `site-diary.html?project=${project.id}`, reason: 'No site diary entries' };
    return { label: 'Open project', href: `project.html?id=${project.id}`, reason: 'Project looks healthy' };
  }
  return { label: 'View project', href: `project.html?id=${project.id}`, reason: '' };
}

// ── Main evaluation function ─────────────────────────────────────────

/**
 * Evaluate a single project and return a HealthReport.
 *
 * HEALTH_ENGINE_SWAP_POINT — replace this synchronous function with
 * an async fetch() to an AI recommendations endpoint. The shape of
 * the returned HealthReport must not change; only the data source changes.
 *
 * @param {Object}   project  — Project record from projectStore
 * @param {Object[]} docs     — DocRecords from documentHistory.listByProject()
 * @returns {HealthReport}
 */
export function evaluateProject(project, docs) {
  const allAlerts = [
    ...rulePendingApprovals(project, docs),
    ...ruleMissingDiary(project, docs),
    ...ruleQuoteExpiry(project, docs),
    ...ruleNoQuote(project, docs),
    ...ruleRecentlyApproved(project, docs),
    ...ruleQuotePending(project, docs)
  ];

  // Sort: critical → warning → info, then by recency
  const alerts = allAlerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const healthScore = calcHealthScore(alerts);
  const status      = scoreToStatus(healthScore);
  const contractSummary = buildContractSummary(docs);
  const suggestedNextAction = suggestNextAction(project, docs, alerts);

  const metrics = {
    docCount:       docs.length,
    pendingCount:   alerts.filter(a => a.category === 'pending-approval' || a.category === 'approval-overdue').length,
    alertCount:     alerts.filter(a => a.severity !== 'info').length,
    lastActivityAt: docs[0]?.updatedAt || project.updatedAt
  };

  return { projectId: project.id, project, healthScore, status, contractSummary, alerts, suggestedNextAction, metrics };
}

/**
 * Evaluate all projects.
 * Archived projects are excluded by default.
 *
 * @param {Object[]} projects
 * @param {Function} getDocsFn  — (projectId) => DocRecord[]
 * @returns {HealthReport[]}
 */
export function evaluateAll(projects, getDocsFn) {
  return projects
    .filter(p => p.status !== 'archived')
    .map(p => evaluateProject(p, getDocsFn(p.id)));
}

/**
 * Aggregate metrics across all reports for the dashboard summary bar.
 *
 * @param {HealthReport[]} reports
 * @returns {Object}
 */
export function aggregateMetrics(reports) {
  let totalContractValue = 0;
  let totalAlerts        = 0;
  let criticalProjects   = 0;
  let attentionProjects  = 0;
  let healthyProjects    = 0;

  reports.forEach(r => {
    totalContractValue += r.contractSummary.currentTotal;
    totalAlerts        += r.metrics.alertCount;
    if (r.status === 'critical')  criticalProjects++;
    else if (r.status === 'attention') attentionProjects++;
    else healthyProjects++;
  });

  return {
    totalProjects:     reports.length,
    totalContractValue,
    totalAlerts,
    criticalProjects,
    attentionProjects,
    healthyProjects,
    needsAttention:    criticalProjects + attentionProjects
  };
}
