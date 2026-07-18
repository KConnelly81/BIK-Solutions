/**
 * Demo Mode — Seeds localStorage with realistic sample data.
 *
 * Call seedDemoData() once. Idempotent: checks for existing data first.
 * Call clearDemoData() to wipe all seeded keys.
 *
 * DEMO_DATA_STORAGE_POINT — replace localStorage writes with API calls in V2.
 */

const DEMO_FLAG_KEY = 'bik-demo-seeded';

// ── Builder Profile ────────────────────────────────────────────────────────

const DEMO_PROFILE = {
  builderName:        'Harper Building Co.',
  builderABN:         '47 123 456 789',
  builderLicence:     'QBCC 1234567',
  builderPhone:       '07 3456 7890',
  builderEmail:       'tom@harperbuildingco.com.au',
  builderAddress:     '22 Commerce Street, Newstead QLD 4006',
  builderApprovalName:'Tom Harper',
  isSample:           true
};

// ── Projects ───────────────────────────────────────────────────────────────

const now = new Date();
const daysAgo = d => new Date(now - d * 86400000).toISOString();

const DEMO_PROJECTS = [
  {
    id:            'demo-proj-001',
    name:          'Smith Residence — Double Storey Addition',
    status:        'active',
    clientName:    'David & Emma Smith',
    clientEmail:   'david.smith@email.com',
    clientPhone:   '0412 345 678',
    projectName:   'Smith Residence Addition',
    siteAddress:   '14 Banksia Crescent, Ashgrove QLD 4060',
    contractRef:   'JOB-2026-007',
    contractValue: 485000,
    notes:         'Primary contact is David. Emma handles approvals. On-site access available 7am–5pm Mon–Fri.',
    createdAt:     daysAgo(62),
    updatedAt:     daysAgo(1),
    isSample:      true
  },
  {
    id:            'demo-proj-002',
    name:          'Riverside Commercial Fitout',
    status:        'on-hold',
    clientName:    'Apex Property Group',
    clientEmail:   'projects@apexpg.com.au',
    clientPhone:   '07 3222 8800',
    projectName:   'Riverside Commercial Fitout',
    siteAddress:   '310 Coronation Drive, Milton QLD 4064',
    contractRef:   'JOB-2026-011',
    contractValue: 210000,
    notes:         'On hold pending DA approval. Expected to resume August 2026.',
    createdAt:     daysAgo(41),
    updatedAt:     daysAgo(18),
    isSample:      true
  },
  {
    id:            'demo-proj-003',
    name:          'Kenmore New Dwelling',
    status:        'active',
    clientName:    'The Nguyen Family Trust',
    clientEmail:   'michael.nguyen@outlook.com',
    clientPhone:   '0421 987 654',
    projectName:   'Kenmore New Dwelling',
    siteAddress:   '7 Ridge Court, Kenmore QLD 4069',
    contractRef:   'JOB-2026-014',
    contractValue: 780000,
    notes:         '',
    createdAt:     daysAgo(28),
    updatedAt:     daysAgo(1),
    isSample:      true
  }
];

// ── Document History ───────────────────────────────────────────────────────

let _idCounter = 1;
function makeId() {
  return 'demo-doc-' + String(_idCounter++).padStart(4, '0');
}

function doc(toolId, title, reference, projectId, fields, daysOld, approval = null, extraData = null) {
  const project = DEMO_PROJECTS.find(p => p.id === projectId);
  const base = {
    id:        makeId(),
    toolId,
    title,
    reference,
    projectId,
    isSample:  true,
    createdAt: daysAgo(daysOld),
    updatedAt: daysAgo(Math.max(0, daysOld - 1)),
    formData: {
      clientName:  project?.clientName  || '',
      siteAddress: project?.siteAddress || '',
      projectName: project?.projectName || '',
      contractRef: project?.contractRef || '',
      ...fields
    }
  };
  if (approval)  base.approval  = approval;
  if (extraData) base.extraData = extraData;
  return base;
}

// ── Time-saved estimates (minutes per document type) ──────────────────────
// Used by value-metrics calculations. Keep transparent and conservative.
export const TIME_SAVED_MINUTES = {
  'quote-builder':          45,
  'scope-of-works':         35,
  'variation-notice':       25,
  'site-diary':             15,
  'defect-report':          20,
  'progress-claim':         45,
  'toolbox-talk':           20,
  'payment-reminder':       20,
  'practical-completion':   30,
  'handover-checklist':     25,
  'itp':                    40,
  'non-conformance-report': 25,
  'incident-report':        30,
  'eot-claim':              40,
  'delay-notice':           25,
  'inspection-checklist':   20,
  'swms':                   60
};

const DEFAULT_ADMIN_RATE = 75; // $/hr — lower-end office admin rate, construction sector

export function calcTimeSaved(docs) {
  const totalMin = docs.reduce((sum, d) => sum + (TIME_SAVED_MINUTES[d.toolId] || 20), 0);
  const totalHrs = totalMin / 60;
  const costSaved = Math.round(totalHrs * DEFAULT_ADMIN_RATE);
  return { totalMin, totalHrs: Math.round(totalHrs * 10) / 10, costSaved };
}

// ── Demo Documents ─────────────────────────────────────────────────────────

const DEMO_DOCS = [

  // ── Smith Residence (proj-001) — flagship demo ─────────────────────────
  doc('quote-builder',
    'Quote — Smith Residence Double Storey Addition',
    'QT-001',
    'demo-proj-001',
    { builderName: 'Harper Building Co.', validUntil: daysAgo(-30), quoteTotal: '485000.00' },
    60,
    { status: 'approved', sentAt: daysAgo(58), sentTo: 'david.smith@email.com', approvedAt: daysAgo(55) },
    { subtotal: 485000, gst: 48500, total: 533500 }
  ),

  doc('scope-of-works',
    'Scope of Works — Smith Residence Addition',
    'SW-001',
    'demo-proj-001',
    { description: 'Double storey addition to existing single-storey dwelling. Ground floor: open-plan kitchen/dining extension and double garage. First floor: two bedrooms, main bathroom, ensuite, and study.' },
    58,
    { status: 'sent', sentAt: daysAgo(57), sentTo: 'david.smith@email.com' }
  ),

  doc('variation-notice',
    'Variation VN-001 — Upgraded Kitchen Benchtops',
    'VN-001',
    'demo-proj-001',
    { variationDescription: 'Client has requested upgrade from laminate to 40mm Caesarstone benchtops throughout kitchen and butler\'s pantry. Additional material cost and installation time required.', additionalCost: '4800', timeImpact: 'Nil' },
    30,
    { status: 'approved', sentAt: daysAgo(28), sentTo: 'david.smith@email.com', approvedAt: daysAgo(25) }
  ),

  doc('variation-notice',
    'Variation VN-002 — Additional Earthworks',
    'VN-002',
    'demo-proj-001',
    { variationDescription: 'Unexpected rock shelf encountered at footing depth requiring rock-breaking and additional excavation. Documented by site supervisor on 3 July 2026.', additionalCost: '6200', timeImpact: '3 working days' },
    14,
    { status: 'sent', sentAt: daysAgo(12), sentTo: 'david.smith@email.com' }
  ),

  doc('site-diary',
    'Site Diary — 14 July 2026',
    'SD-009',
    'demo-proj-001',
    { date: daysAgo(2), weather: 'Fine, 22°C', workforce: '4 carpenters, 1 labourer', worksCompleted: 'First-floor framing completed to ridge. Roof trusses delivered and staged on site.' },
    2
  ),

  doc('site-diary',
    'Site Diary — 10 July 2026',
    'SD-008',
    'demo-proj-001',
    { date: daysAgo(6), weather: 'Cloudy, light showers PM', workforce: '3 carpenters, 1 concreter', worksCompleted: 'Ground floor slab poured — 32MPa concrete. Curing compound applied.' },
    6
  ),

  doc('toolbox-talk',
    'Toolbox Talk — Working at Heights',
    'TT-003',
    'demo-proj-001',
    { topic: 'Working at Heights', attendees: 'Tom Harper, Jake Riley, Sam Truro, Mick Dawes, Luke Barrett', keyPoints: 'Fall arrest equipment inspection, exclusion zones, scaffold inspection register, emergency procedures.' },
    7
  ),

  doc('defect-report',
    'Defect Report — First Fix Inspection',
    'DR-001',
    'demo-proj-001',
    { defectDescription: 'Framing notch exceeds allowable depth per AS 1684. Located at northern wall, first floor, third stud from east. Structural engineer to review and advise.' },
    5
  ),

  // ── Riverside Fitout (proj-002) ────────────────────────────────────────
  doc('quote-builder',
    'Quote — Riverside Commercial Fitout',
    'QT-002',
    'demo-proj-002',
    { builderName: 'Harper Building Co.', validUntil: daysAgo(5) },
    39,
    { status: 'sent', sentAt: daysAgo(38), sentTo: 'projects@apexpg.com.au' },
    { subtotal: 210000, gst: 21000, total: 231000 }
  ),

  doc('scope-of-works',
    'Scope of Works — Commercial Fitout',
    'SW-002',
    'demo-proj-002',
    { description: 'Commercial office fitout — 650m² ground floor. New partitioning, suspended ceiling, electrical and data, HVAC connections, and floor finishes throughout.' },
    37
  ),

  doc('delay-notice',
    'Delay Notice — Pending DA Approval',
    'DN-001',
    'demo-proj-002',
    { delayDescription: 'Works cannot commence as Development Approval has not been issued by Brisbane City Council. Builder is not responsible for this delay. Time extension will be claimed upon works recommencing.' },
    17
  ),

  // ── Kenmore New Dwelling (proj-003) ────────────────────────────────────
  doc('quote-builder',
    'Quote — Kenmore New Dwelling',
    'QT-003',
    'demo-proj-003',
    { builderName: 'Harper Building Co.', validUntil: daysAgo(-14) },
    26,
    { status: 'approved', sentAt: daysAgo(24), sentTo: 'michael.nguyen@outlook.com', approvedAt: daysAgo(21) },
    { subtotal: 780000, gst: 78000, total: 858000 }
  ),

  doc('scope-of-works',
    'Scope of Works — New Dwelling',
    'SW-003',
    'demo-proj-003',
    { description: 'New single-storey dwelling — 4 bed, 2 bath, double garage. Rendered masonry construction with Colorbond roof. Includes landscaping, fencing, and driveway.' },
    24
  ),

  doc('toolbox-talk',
    'Toolbox Talk — Excavation & Trenching',
    'TT-001',
    'demo-proj-003',
    { topic: 'Excavation and Trenching Safety', attendees: 'Tom Harper, Marcus Reid, Jonno Wells', keyPoints: 'Call Before You Dig requirements, safe shoring depths, exclusion zones, emergency evacuation from trenches.' },
    10
  ),

  doc('site-diary',
    'Site Diary — 8 July 2026',
    'SD-001',
    'demo-proj-003',
    { date: daysAgo(8), weather: 'Sunny, 18°C', workforce: '2 carpenters, 1 labourer', worksCompleted: 'Slab preparation — compaction and sub-base complete. Formwork set. Reo inspection booked for 10 July.' },
    8
  ),

  doc('inspection-checklist',
    'Slab Inspection Checklist',
    'IC-001',
    'demo-proj-003',
    { stage: 'Pre-slab', inspectedBy: 'Tom Harper', result: 'Pass — minor edge form adjustment required' },
    5
  )
];

// ── Document counters ──────────────────────────────────────────────────────

const DEMO_COUNTERS = {
  'variation-notice':    2,
  'quote-builder':       3,
  'scope-of-works':      3,
  'site-diary':          9,
  'toolbox-talk':        3,
  'defect-report':       1,
  'delay-notice':        1,
  'inspection-checklist':1
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Seed demo data into localStorage.
 * Returns true if data was seeded, false if it was already present.
 */
export function seedDemoData() {
  if (localStorage.getItem(DEMO_FLAG_KEY) === '1') return false;

  localStorage.setItem('bik-builder-profile', JSON.stringify(DEMO_PROFILE));
  localStorage.setItem('bik-projects', JSON.stringify(DEMO_PROJECTS));
  localStorage.setItem('bik-doc-history', JSON.stringify(DEMO_DOCS));
  localStorage.setItem('bik-doc-counters', JSON.stringify(DEMO_COUNTERS));
  localStorage.setItem('bik-onboarding-complete', '1'); // skip onboarding for demo users
  localStorage.setItem(DEMO_FLAG_KEY, '1');

  return true;
}

/**
 * Remove all sample-tagged records from localStorage.
 * Preserves any user-created records in the same keys.
 * Safe to call even if additional sample content types are added later —
 * anything with isSample: true will be removed; everything else is untouched.
 */
export function clearDemoData() {
  // Projects — filter out sample records, preserve real ones
  try {
    const projects = JSON.parse(localStorage.getItem('bik-projects') || '[]');
    const real = projects.filter(p => !p.isSample);
    if (real.length > 0) localStorage.setItem('bik-projects', JSON.stringify(real));
    else localStorage.removeItem('bik-projects');
  } catch { localStorage.removeItem('bik-projects'); }

  // Document history — filter out sample records, preserve real ones
  try {
    const docs = JSON.parse(localStorage.getItem('bik-doc-history') || '[]');
    const real = docs.filter(d => !d.isSample);
    if (real.length > 0) localStorage.setItem('bik-doc-history', JSON.stringify(real));
    else localStorage.removeItem('bik-doc-history');
  } catch { localStorage.removeItem('bik-doc-history'); }

  // Builder profile — remove only if it was seeded (isSample flag present)
  try {
    const profile = JSON.parse(localStorage.getItem('bik-builder-profile') || '{}');
    if (profile.isSample) localStorage.removeItem('bik-builder-profile');
  } catch { /* leave it */ }

  // Clear the sample flag; leave all other keys (onboarding, counters, tokens) untouched
  localStorage.removeItem(DEMO_FLAG_KEY);
}

/**
 * Returns true if demo data is currently seeded.
 */
export function isDemoActive() {
  return localStorage.getItem(DEMO_FLAG_KEY) === '1';
}
