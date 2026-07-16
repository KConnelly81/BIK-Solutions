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
  builderName:        'Hartley Construction Pty Ltd',
  builderABN:         '47 123 456 789',
  builderLicence:     'QBCC 1234567',
  builderPhone:       '07 3456 7890',
  builderEmail:       'info@hartleyconstruction.com.au',
  builderAddress:     '14 Highfield Road, Toowong QLD 4066',
  builderApprovalName:'Ryan Hartley'
};

// ── Projects ───────────────────────────────────────────────────────────────

function makeId() {
  return 'demo-' + Math.random().toString(36).slice(2, 10);
}

const now = new Date();
const daysAgo = d => new Date(now - d * 86400000).toISOString();

const DEMO_PROJECTS = [
  {
    id:            'demo-proj-001',
    name:          'Morrison Residence — Double Storey Addition',
    status:        'active',
    clientName:    'David & Sarah Morrison',
    clientEmail:   'david.morrison@email.com',
    clientPhone:   '0412 345 678',
    projectName:   'Morrison Residence Addition',
    siteAddress:   '22 Banksia Crescent, Ashgrove QLD 4060',
    contractRef:   'JOB-2026-007',
    contractValue: 485000,
    notes:         'Primary contact is David. Sarah handles approvals. On-site Fridays only.',
    createdAt:     daysAgo(62),
    updatedAt:     daysAgo(3)
  },
  {
    id:            'demo-proj-002',
    name:          'Indooroopilly Commercial Fitout',
    status:        'on-hold',
    clientName:    'Apex Property Group',
    clientEmail:   'projects@apexpg.com.au',
    clientPhone:   '07 3222 8800',
    projectName:   'Indooroopilly Commercial Fitout',
    siteAddress:   '310 Moggill Road, Indooroopilly QLD 4068',
    contractRef:   'JOB-2026-011',
    contractValue: 210000,
    notes:         'On hold pending DA approval. Expected to resume August 2026.',
    createdAt:     daysAgo(41),
    updatedAt:     daysAgo(18)
  },
  {
    id:            'demo-proj-003',
    name:          'Kenmore Hills New Dwelling',
    status:        'active',
    clientName:    'The Nguyen Family Trust',
    clientEmail:   'michael.nguyen@outlook.com',
    clientPhone:   '0421 987 654',
    projectName:   'Kenmore Hills New Dwelling',
    siteAddress:   '7 Ridge Court, Kenmore Hills QLD 4069',
    contractRef:   'JOB-2026-014',
    contractValue: 780000,
    notes:         '',
    createdAt:     daysAgo(28),
    updatedAt:     daysAgo(1)
  }
];

// ── Document History ───────────────────────────────────────────────────────

function docRecord(toolId, title, reference, projectId, clientName, siteAddress, daysOld) {
  return {
    id:         makeId(),
    toolId,
    title,
    reference,
    projectId,
    createdAt:  daysAgo(daysOld),
    updatedAt:  daysAgo(daysOld),
    formData: {
      clientName,
      siteAddress,
      projectName: DEMO_PROJECTS.find(p => p.id === projectId)?.projectName || '',
      contractRef: DEMO_PROJECTS.find(p => p.id === projectId)?.contractRef || ''
    },
    extraData: {}
  };
}

const DEMO_DOCS = [
  // Morrison Residence (proj-001)
  docRecord('quote-builder',    'Quote — Morrison Residence Addition',        'QT-001', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 60),
  docRecord('scope-of-works',   'Scope of Works — Morrison Residence',        'SW-001', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 58),
  docRecord('variation-notice', 'Variation — Additional Earthworks',          'VN-001', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 30),
  docRecord('progress-claim',   'Progress Claim #1 — Morrison Residence',     'PC-001', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 14),
  docRecord('site-diary',       'Site Diary — Week of 30 June 2026',          'SD-012', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 16),
  docRecord('toolbox-talk',     'Toolbox Talk — Working at Heights',          'TT-003', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 7),
  docRecord('variation-notice', 'Variation — Upgraded Kitchen Benchtops',     'VN-002', 'demo-proj-001', 'David & Sarah Morrison', '22 Banksia Crescent, Ashgrove QLD 4060', 3),

  // Indooroopilly Fitout (proj-002)
  docRecord('quote-builder',    'Quote — Indooroopilly Fitout',               'QT-002', 'demo-proj-002', 'Apex Property Group',    '310 Moggill Road, Indooroopilly QLD 4068', 39),
  docRecord('scope-of-works',   'Scope of Works — Commercial Fitout',         'SW-002', 'demo-proj-002', 'Apex Property Group',    '310 Moggill Road, Indooroopilly QLD 4068', 37),
  docRecord('delay-notice',     'Delay Notice — Pending DA Approval',         'DN-001', 'demo-proj-002', 'Apex Property Group',    '310 Moggill Road, Indooroopilly QLD 4068', 17),

  // Kenmore Hills (proj-003)
  docRecord('quote-builder',    'Quote — Kenmore Hills New Dwelling',         'QT-003', 'demo-proj-003', 'The Nguyen Family Trust', '7 Ridge Court, Kenmore Hills QLD 4069', 26),
  docRecord('scope-of-works',   'Scope of Works — New Dwelling',              'SW-003', 'demo-proj-003', 'The Nguyen Family Trust', '7 Ridge Court, Kenmore Hills QLD 4069', 24),
  docRecord('toolbox-talk',     'Toolbox Talk — Excavation & Trenching',      'TT-001', 'demo-proj-003', 'The Nguyen Family Trust', '7 Ridge Court, Kenmore Hills QLD 4069', 10),
  docRecord('site-diary',       'Site Diary — 8 July 2026',                   'SD-001', 'demo-proj-003', 'The Nguyen Family Trust', '7 Ridge Court, Kenmore Hills QLD 4069', 8),
  docRecord('inspection-checklist', 'Slab Inspection Checklist',              'IC-001', 'demo-proj-003', 'The Nguyen Family Trust', '7 Ridge Court, Kenmore Hills QLD 4069', 5)
];

// ── Document counters (so next generated doc gets correct sequence number) ─

const DEMO_COUNTERS = {
  'variation-notice':    2,
  'quote-builder':       3,
  'scope-of-works':      3,
  'site-diary':          12,
  'progress-claim':      1,
  'toolbox-talk':        3,
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

  // Builder profile
  localStorage.setItem('bik-builder-profile', JSON.stringify(DEMO_PROFILE));

  // Projects
  localStorage.setItem('bik-projects', JSON.stringify(DEMO_PROJECTS));

  // Document history
  localStorage.setItem('bik-doc-history', JSON.stringify(DEMO_DOCS));

  // Counters
  localStorage.setItem('bik-doc-counters', JSON.stringify(DEMO_COUNTERS));

  // Mark as seeded
  localStorage.setItem(DEMO_FLAG_KEY, '1');

  return true;
}

/**
 * Remove all demo-seeded data from localStorage.
 * Does not touch keys that weren't seeded (e.g. real user drafts).
 */
export function clearDemoData() {
  localStorage.removeItem('bik-builder-profile');
  localStorage.removeItem('bik-projects');
  localStorage.removeItem('bik-doc-history');
  localStorage.removeItem('bik-doc-counters');
  localStorage.removeItem(DEMO_FLAG_KEY);
}

/**
 * Returns true if demo data is currently seeded.
 */
export function isDemoActive() {
  return localStorage.getItem(DEMO_FLAG_KEY) === '1';
}
