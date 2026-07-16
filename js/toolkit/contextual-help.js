/**
 * Contextual help — "Why this matters" panels for each tool.
 * Injects a collapsible tip card below the privacy notice on tool pages.
 * Self-contained; call init() once the DOM is ready.
 */

const HELP = {
  'variation-notice': {
    icon: '📋',
    title: 'Why variations matter',
    why: 'Undocumented scope changes are the #1 cause of payment disputes in construction. A signed Variation Notice locks in the agreed cost and time impact before work proceeds — protecting both you and the client.',
    tips: [
      'Issue the variation <strong>before</strong> starting the extra work, not after.',
      'Include a clear description of what changed and why — vague variations get disputed.',
      'If the client approves verbally, follow up with this document the same day.',
      'Keep approved variations — they form part of the contract record.',
    ],
    example: 'Client asks to add a garden shed to the scope. Issue a variation before ordering materials: document the new scope, cost ($3,200 incl. GST), and the 3-day time extension. Client signs. Work proceeds.',
  },
  'quote-builder': {
    icon: '💰',
    title: 'Why a written quote protects you',
    why: 'A detailed written quote sets clear expectations before work starts. It defines exactly what\'s included, what\'s excluded, and the price — reducing disputes and making it easier to issue variations later.',
    tips: [
      'Always list <strong>exclusions</strong> — what is not included is as important as what is.',
      'Set a validity period (e.g. 30 days) so you\'re not locked into old prices.',
      'Break the quote into line items — clients accept detailed quotes faster.',
      'Include a signature block so the quote doubles as a simple contract.',
    ],
    example: 'Quote for a bathroom renovation: list each trade separately (tiling, plumbing, electrical), include materials, and clearly exclude council fees and structural work. Client can see exactly what they\'re approving.',
  },
  'scope-of-works': {
    icon: '📝',
    title: 'Why scope documents prevent disputes',
    why: 'Scope disputes — "I thought that was included" — are the most common source of builder-client conflict. A written Scope of Works, issued before work starts, removes ambiguity and gives both parties a clear reference point.',
    tips: [
      'Be specific about materials: specify brand, grade, or standard (e.g. "AS 3740 waterproofing").',
      'List what is explicitly <strong>excluded</strong> from scope.',
      'Issue the scope with or before your quote — not after the contract is signed.',
      'Reference the scope in your contract and in any variations.',
    ],
    example: 'Scope for a new deck: specify decking species and grade, post spacing, bearer/joist sizes, balustrade height, and explicitly exclude landscaping, council application fees, and stump installation.',
  },
  'site-diary': {
    icon: '📅',
    title: 'Why daily records save disputes',
    why: 'Your site diary is your best witness in a dispute. Courts and adjudicators treat contemporary records — written at the time — as more reliable than later recollections. A diary entry about a delay, weather event, or instruction change can be the difference between winning and losing a claim.',
    tips: [
      'Record every day on site, even if nothing unusual happened.',
      'Note weather conditions — they\'re relevant to delay claims and quality defects.',
      'Record any verbal instructions from the client or their representative.',
      'Note workforce numbers and hours — useful for delay and cost claims.',
    ],
    example: 'Tuesday 8 Apr: Heavy rain until 11am, no concrete pour possible. Client called at 2pm and verbally instructed change to bathroom layout — see Variation Notice VN-007 issued same day. 4 workers on site.',
  },
  'defect-report': {
    icon: '🔍',
    title: 'Why documenting defects matters',
    why: 'Whether you\'re the builder finding your own defects before handover, or receiving a defect notice from a client, a formal written record protects you. It shows what was found, when, by whom, and what action was agreed — preventing disputes about what was or wasn\'t fixed.',
    tips: [
      'Use precise location descriptions and photos wherever possible.',
      'Classify severity honestly — "critical" defects block practical completion.',
      'Set a realistic rectification date and stick to it.',
      'Keep copies of all defect reports — they form part of the project record.',
    ],
    example: 'Post-handover inspection: record a cracked tile (location: ensuite, third row from door, left of vanity), severity: minor, cause: substrate movement, action: replace tile and re-grout, date: 14 days.',
  },
  'progress-claim': {
    icon: '🧾',
    title: 'Why progress claims must be formal',
    why: 'Under Queensland\'s Building Industry Fairness (Security of Payment) Act 2017, a correctly issued payment claim triggers statutory response rights and dispute resolution protections. Using the right format and serving it correctly is essential — errors can affect your entitlements.',
    tips: [
      'Serve on the date specified in your contract, or the date prescribed by the BIF Act.',
      'Include the words "payment claim" in the document (required under the BIF Act).',
      'Attach a supporting schedule showing the basis for each amount claimed.',
      'Keep proof of service — email with read receipt, registered mail, or statutory declaration.',
    ],
    example: 'Monthly claim at 30% completion: list each contract item, claimed amount to date, and amount previously certified. Serve by email with read receipt on the scheduled claim date.',
  },
  'toolbox-talk': {
    icon: '🦺',
    title: 'Why toolbox talks are a legal requirement',
    why: 'As a PCBU (person conducting a business or undertaking), you have a duty under the Work Health and Safety Act to consult workers on health and safety matters. Toolbox talks are evidence that you\'ve met this duty. In the event of a workplace incident, a record of safety briefings demonstrates your compliance.',
    tips: [
      'Hold toolbox talks at the start of a new task, after an incident, or when conditions change.',
      'Record attendance — who was present matters as much as what was covered.',
      'Keep records for at least 5 years (WHS legislation requirement).',
      'Use the talk to raise hazards workers have identified — it\'s a two-way conversation.',
    ],
    example: 'Before starting roof work: cover fall hazards, anchor points, PPE requirements, rescue procedures, and weather conditions. Record names of all workers present and any questions raised.',
  },
  'payment-reminder': {
    icon: '💳',
    title: 'Why formal payment reminders work',
    why: 'A professional written reminder is more effective than a phone call — it creates a paper trail, sets clear expectations, and demonstrates that you\'re managing your business professionally. It also starts the clock on any late payment provisions in your contract.',
    tips: [
      'Send the first reminder the day after payment is due — not a week later.',
      'Reference the original invoice number and date in every reminder.',
      'Include your bank details again — payments fail because clients can\'t find them.',
      'Escalate tone progressively: friendly, firm, formal. Document each step.',
    ],
    example: 'Invoice #007 for $22,000 is 7 days overdue. Send a polite reminder with invoice attached, your bank details, and a clear due date. Note you\'ll follow up with a formal demand if unpaid within 7 days.',
  },
  'practical-completion': {
    icon: '🏁',
    title: 'Why practical completion must be in writing',
    why: 'Practical completion triggers major contract events: the defects liability period begins, retention is released (usually half), and the client\'s obligation to pay the final claim is activated. A signed PC certificate is the evidence that this milestone was reached — and when.',
    tips: [
      'Don\'t hand over keys without a signed Practical Completion certificate.',
      'List any agreed outstanding minor items — these don\'t prevent PC but must be tracked.',
      'Note the defects liability period start and end dates on the certificate.',
      'Keep a copy of all PC certificates — they\'re required for insurance claims.',
    ],
    example: 'Project completes 14 Nov. Issue PC certificate noting DLP starts 14 Nov and ends 14 Nov next year. List 3 agreed minor items to be rectified within 14 days. Client signs. Keys handed over.',
  },
  'handover-checklist': {
    icon: '✅',
    title: 'Why handover documentation protects everyone',
    why: 'A systematic handover process protects you from post-handover disputes about what was delivered, and protects the client by ensuring they know how to maintain the property. Disputes about what was "handed over" are common — a signed checklist eliminates ambiguity.',
    tips: [
      'Walk through the property with the client and complete the checklist together.',
      'Include serial numbers and warranty documents for all installed appliances.',
      'Photograph the condition of all surfaces at handover.',
      'Ensure the client acknowledges receipt of all keys, remotes, and access cards.',
    ],
    example: 'Handover of new dwelling: complete checklist with client present, noting all appliances tested, warranties provided, keys handed over (3 sets), smoke alarms tested, and pool safety certificate sighted.',
  },
  'itp': {
    icon: '🔬',
    title: 'Why inspection and test plans prevent defects',
    why: 'An ITP is a proactive quality control tool — it defines what gets inspected, by whom, and when, before defects can be built in. Insurers, certifiers, and clients all value a documented ITP because it demonstrates that your quality process is systematic, not reactive.',
    tips: [
      'Define hold points — work that cannot proceed until an inspection is passed.',
      'Assign responsibility for each inspection: builder, subcontractor, certifier, or client.',
      'Record pass/fail results and dates — the completed ITP is your quality record.',
      'Review the ITP after each project and update it based on what you learned.',
    ],
    example: 'Concrete slab ITP: hold points at sub-grade compaction, steel placement, and concrete pour. Builder inspects, certifier signs off at pour. Record slump test results and delivery docket numbers.',
  },
  'non-conformance-report': {
    icon: '⚠️',
    title: 'Why non-conformances must be recorded',
    why: 'When work doesn\'t meet the specification or standard, a formal NCR creates a clear record of what was found and what corrective action was taken. This protects you if the issue is disputed later, and demonstrates that your quality system identifies and resolves problems — not ignores them.',
    tips: [
      'Issue NCRs even for minor non-conformances — the pattern of what you catch and fix matters.',
      'Identify root cause, not just the symptom — "wrong product used" is more useful than "defective".',
      'Close out every NCR with a verified corrective action before the work proceeds.',
      'Keep NCR records for the duration of the defects liability period.',
    ],
    example: 'Subcontractor installs incorrect waterproofing membrane (brand not approved). Raise NCR, stop work, identify root cause (no procurement check), corrective action: remove and replace with specified product, verify before tiling proceeds.',
  },
  'incident-report': {
    icon: '🚑',
    title: 'Why incident reports are legally required',
    why: 'Under the Work Health and Safety Act, you must notify your state WHS regulator of serious incidents (notifiable incidents) immediately — not after an investigation. You must also preserve the scene until directed otherwise. A formal incident report is part of your legal obligations and protects you in the event of regulatory action.',
    tips: [
      'Notify your WHS regulator immediately for serious injuries, dangerous incidents, or fatalities.',
      'Preserve the incident scene — do not disturb it without regulator approval.',
      'Interview witnesses as soon as possible while recollections are fresh.',
      'Identify contributing factors, not just causes — what could have prevented it?',
    ],
    example: 'Worker falls from scaffold, injures ankle. Stop work. Call 000 if medical emergency. Notify SafeWork QLD immediately (serious incident). Preserve scene. Complete incident report within 24 hours.',
  },
  'eot-claim': {
    icon: '⏱️',
    title: 'Why you must claim EOT in writing',
    why: 'Most contracts require you to notify the client of a delay claim within a specific period — often 14 or 28 days of the delay event occurring. Miss this deadline and you may lose your right to an extension, even if the delay was clearly the client\'s fault. An EOT Claim documents the event, its impact, and your entitlement.',
    tips: [
      'Check your contract\'s notice period for delay claims — clock starts at the delay event.',
      'Quantify the delay in days, not vague language like "a few weeks".',
      'Link the delay to a contract clause — client-caused, weather, variations, etc.',
      'Keep supporting evidence: site diary entries, weather records, correspondence.',
    ],
    example: 'Client-requested variation adds 3 weeks of electrical work. Issue EOT claim within 14 days of the variation approval, claiming a 21-day extension. Attach the variation approval and revised program.',
  },
  'delay-notice': {
    icon: '📢',
    title: 'Why early delay notices protect your position',
    why: 'A delay notice serves notice on the client that a delay event has occurred and may entitle you to an extension of time. Issuing it promptly creates a contemporaneous record and protects your rights — even if you don\'t yet know the full impact of the delay.',
    tips: [
      'Issue a delay notice as soon as you become aware of a delay event.',
      'You don\'t need to know the full time impact yet — notice the event, quantify later.',
      'Reference the specific clause in your contract that entitles you to a delay claim.',
      'Follow up with a formal EOT Claim once the delay impact is known.',
    ],
    example: 'Unexpected rock encountered during excavation. Issue delay notice to client within 24 hours noting the event, that work has stopped pending assessment, and that an EOT claim will follow once the impact is quantified.',
  },
  'inspection-checklist': {
    icon: '📋',
    title: 'Why systematic inspections prevent disputes',
    why: 'A completed inspection checklist is a snapshot of the condition of the work at a specific point in time. Used before handover, at defect inspections, or during progress inspections, it creates an objective record that can\'t be disputed later and demonstrates your quality process.',
    tips: [
      'Complete checklists with the client or their representative wherever possible.',
      'Take photos and attach them — a photo with a checklist is much stronger than either alone.',
      'Sign and date every checklist — both parties should retain a copy.',
      'Use the same checklist format every time so nothing gets missed.',
    ],
    example: 'Pre-handover inspection: work through checklist systematically room by room. Note each item pass/fail, photograph any items requiring attention, and have client acknowledge the current state before final payment.',
  },
};

export function init() {
  const toolId = detectToolId();
  if (!toolId || !HELP[toolId]) return;

  const help = HELP[toolId];
  const privacyNotice = document.querySelector('.privacy-notice');
  if (!privacyNotice) return;

  const card = buildCard(help);
  privacyNotice.insertAdjacentElement('afterend', card);
}

function detectToolId() {
  // Try to read from the tool config loaded on the page
  const metaTag = document.querySelector('meta[name="bik-tool-id"]');
  if (metaTag) return metaTag.getAttribute('content');

  // Fall back to URL pattern matching
  const path = location.pathname.split('/').pop().replace('.html', '');
  const URL_MAP = {
    'variation-generator': 'variation-notice',
    'quote-builder': 'quote-builder',
    'scope-of-works': 'scope-of-works',
    'site-diary': 'site-diary',
    'defect-report': 'defect-report',
    'progress-claim': 'progress-claim',
    'toolbox-talk': 'toolbox-talk',
    'payment-reminder': 'payment-reminder',
    'practical-completion': 'practical-completion',
    'handover-checklist': 'handover-checklist',
    'itp': 'itp',
    'ncr': 'non-conformance-report',
    'incident-report': 'incident-report',
    'eot-claim': 'eot-claim',
    'delay-notice': 'delay-notice',
    'inspection-checklist': 'inspection-checklist',
  };
  return URL_MAP[path] || null;
}

function buildCard(help) {
  const card = document.createElement('details');
  card.className = 'help-card';
  card.open = false;

  const tipsHtml = help.tips
    .map(t => `<li>${t}</li>`)
    .join('');

  card.innerHTML = `
    <summary class="help-card-header" aria-label="Toggle contextual help">
      <span class="help-card-icon" aria-hidden="true">${help.icon}</span>
      <span class="help-card-title">${help.title}</span>
      <span class="help-card-toggle" aria-hidden="true">Show tips ▾</span>
    </summary>
    <div class="help-card-body">
      <p class="help-card-why">${help.why}</p>
      <ul class="help-card-tips">${tipsHtml}</ul>
      ${help.example ? `<div class="help-card-example"><strong>Example:</strong> ${help.example}</div>` : ''}
    </div>
  `;

  card.addEventListener('toggle', () => {
    const toggle = card.querySelector('.help-card-toggle');
    toggle.textContent = card.open ? 'Hide tips ▴' : 'Show tips ▾';
  });

  injectStyles();
  return card;
}

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .help-card {
      background: #f5f0e8;
      border: 1px solid #e2d9cc;
      border-radius: 8px;
      margin: 12px 0 16px;
      overflow: hidden;
    }
    .help-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 11px 14px;
      cursor: pointer;
      list-style: none;
      font-size: 0.82rem;
      font-weight: 600;
      color: #252320;
      user-select: none;
    }
    .help-card-header::-webkit-details-marker { display: none; }
    .help-card-icon { font-size: 0.9rem; flex-shrink: 0; }
    .help-card-title { flex: 1; }
    .help-card-toggle {
      font-size: 0.75rem;
      color: #D85A30;
      font-weight: 600;
      white-space: nowrap;
    }
    .help-card-body {
      padding: 0 14px 14px;
      border-top: 1px solid #e2d9cc;
    }
    .help-card-why {
      font-size: 0.82rem;
      color: #444;
      line-height: 1.65;
      margin: 12px 0 10px;
    }
    .help-card-tips {
      margin: 0 0 10px 16px;
      padding: 0;
    }
    .help-card-tips li {
      font-size: 0.80rem;
      color: #444;
      line-height: 1.6;
      margin-bottom: 5px;
    }
    .help-card-example {
      background: #fff;
      border-left: 3px solid #D85A30;
      border-radius: 3px;
      padding: 9px 12px;
      font-size: 0.78rem;
      color: #555;
      line-height: 1.6;
      margin-top: 10px;
    }
    .help-card-example strong { color: #252320; }
    @media (prefers-color-scheme: dark) {
      .help-card { background: #2a2724; border-color: #3a3530; }
      .help-card-header { color: #e8e4de; }
      .help-card-body { border-top-color: #3a3530; }
      .help-card-why, .help-card-tips li { color: #b8b0a8; }
      .help-card-example { background: #1e1c1a; color: #999; }
      .help-card-example strong { color: #e8e4de; }
    }
  `;
  document.head.appendChild(style);
}
