/**
 * AttendanceStore — Site Attendance & Workforce Register  v2
 *
 * localStorage keys:
 *   bik-attendance          — AttendanceRecord[]
 *   bik-attendance-schema-v — number (current: 2)
 *
 * Record shape (v2):
 * {
 *   id:           string      — 'att-<timestamp>-<random>'
 *   projectId:    string      — internal UUID or token fallback
 *   checkinToken: string      — public check-in token
 *   projectName:  string
 *   date:         string      — 'YYYY-MM-DD'
 *   name:         string
 *   company:      string
 *   trade:        string
 *   mobile:       string      — normalised (+61 where possible)
 *   type:         string      — 'employee'|'subcontractor'|'contractor'|'labour-hire'|'visitor'|'inspector'|'supplier'|'other'
 *   timeIn:       string      — ISO datetime
 *   timeOut:      string|null
 *   breakMinutes: number      — default 0
 *   hoursOnSite:  number|null — (timeOut - timeIn - breakMinutes) in hours, min 0
 *   status:       string      — 'active'|'checked-out'|'checkout-required'|'voided'
 *   voidReason:   string|null
 *   gps:          {lat,lng,accuracy}|null
 *   notes:        string
 *   checkedInBy:  string      — 'self'|'builder'
 *   auditLog:     AuditEntry[]
 *   _demo:        boolean|undefined
 * }
 *
 * AuditEntry:
 * { id, recordId, timestamp, changedBy, source, reason, changes:[{field,from,to}] }
 *
 * Migration from v1 → v2:
 *   Adds breakMinutes:0, status derived from timeOut, auditLog:[], voidReason:null.
 *   Non-destructive — no existing field is overwritten.
 */

const STORE_KEY    = 'bik-attendance';
const SCHEMA_KEY   = 'bik-attendance-schema-v';
const SCHEMA_V     = 2;

// ── Private helpers ──────────────────────────────────────────────────────────

function _load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(raw) ? _migrate(raw) : [];
  } catch { return []; }
}

function _schemaVersion() {
  try { return parseInt(localStorage.getItem(SCHEMA_KEY) || '1', 10); } catch { return 1; }
}

function _migrate(records) {
  if (_schemaVersion() >= SCHEMA_V) return records;
  const migrated = records.map(r => ({
    breakMinutes: 0,
    status:       r.timeOut ? 'checked-out' : 'active',
    auditLog:     [],
    voidReason:   null,
    ...r,                  // existing fields win over defaults
  }));
  _save(migrated);
  localStorage.setItem(SCHEMA_KEY, String(SCHEMA_V));
  return migrated;
}

function _save(records) {
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

function _id() {
  return 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function _today() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function _hours(timeIn, timeOut, breakMinutes = 0) {
  if (!timeIn || !timeOut) return null;
  const diff = new Date(timeOut) - new Date(timeIn) - (Math.max(0, breakMinutes || 0) * 60000);
  return diff <= 0 ? 0 : Math.round((diff / 3600000) * 100) / 100;
}

function _normaliseMobile(m) {
  if (!m) return '';
  const stripped = m.replace(/[\s\-().]/g, '');
  // Australian mobile 04xxxxxxxx → +614xxxxxxxx
  if (/^04\d{8}$/.test(stripped)) return '+61' + stripped.slice(1);
  if (/^4\d{8}$/.test(stripped))  return '+61' + stripped;
  if (/^614\d{8}$/.test(stripped)) return '+' + stripped;
  return m.trim(); // preserve international / unknown formats
}

// ── Public store ─────────────────────────────────────────────────────────────

export const attendanceStore = {

  /** Check in a worker. Returns the new record id. */
  checkIn(data) {
    const records = _load();
    const now = new Date().toISOString();
    const record = {
      id:           _id(),
      projectId:    data.projectId    || '',
      checkinToken: data.checkinToken || '',
      projectName:  data.projectName  || '',
      date:         data.date         || _today(),
      name:         (data.name        || '').trim(),
      company:      (data.company     || '').trim(),
      trade:        (data.trade       || '').trim(),
      mobile:       _normaliseMobile((data.mobile || '').trim()),
      type:         data.type         || 'subcontractor',
      timeIn:       data.timeIn       || now,
      timeOut:      null,
      breakMinutes: 0,
      hoursOnSite:  null,
      status:       'active',
      gps:          data.gps          || null,
      notes:        (data.notes       || '').trim(),
      checkedInBy:  data.checkedInBy  || 'self',
      auditLog:     [],
    };
    records.unshift(record);
    _save(records);
    return record.id;
  },

  /** Check out a worker by id. Returns false if record not found or checkout would be before check-in. */
  checkOut(id, { timeOut, notes, breakMinutes } = {}) {
    const records = _load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const rec = records[idx];
    const out = timeOut || new Date().toISOString();
    if (new Date(out) <= new Date(rec.timeIn)) return false;
    const brk = breakMinutes != null ? Math.max(0, breakMinutes) : (rec.breakMinutes || 0);
    records[idx] = {
      ...rec,
      timeOut:      out,
      breakMinutes: brk,
      hoursOnSite:  _hours(rec.timeIn, out, brk),
      status:       'checked-out',
      notes:        notes !== undefined ? notes : rec.notes,
    };
    _save(records);
    return true;
  },

  /** Get a single record by id. */
  get(id) {
    return _load().find(r => r.id === id) || null;
  },

  /** Records for a project on a given date. */
  forProjectDate(projectId, date) {
    return _load().filter(r => r.projectId === projectId && r.date === date);
  },

  /** All records for a project (all dates). */
  forProject(projectId) {
    return _load().filter(r => r.projectId === projectId);
  },

  /** Records matching by project ID or check-in token (cross-device support). */
  forProjectOrToken(projectId, token) {
    return _load().filter(r =>
      r.projectId === projectId ||
      (token && (r.checkinToken === token || r.projectId === token))
    );
  },

  /** Active on-site records for a project (not checked out, not voided). */
  onSite(projectId) {
    return _load().filter(r =>
      r.projectId === projectId && !r.timeOut && r.status !== 'voided'
    );
  },

  /** All records for today across all projects. */
  todayAll() {
    const today = _today();
    return _load().filter(r => r.date === today && r.status !== 'voided');
  },

  /** Today's records for a specific project. */
  todayForProject(projectId) {
    const today = _today();
    return _load().filter(r =>
      r.projectId === projectId && r.date === today && r.status !== 'voided'
    );
  },

  /** Total recorded site hours for a project on a date.
   *  Open records older than 18 hours are excluded (likely forgotten checkouts). */
  totalHours(projectId, date, token) {
    const cutoff = new Date(Date.now() - 18 * 3600000).toISOString();
    return attendanceStore.forProjectOrToken(projectId, token || null)
      .filter(r => r.date === date && r.status !== 'voided')
      .filter(r => !(r.status === 'active' && r.timeIn < cutoff))
      .reduce((sum, r) => sum + (r.hoursOnSite || 0), 0);
  },

  /** Open records older than 18 hours (forgotten checkouts). */
  forgotCheckout(projectId) {
    const cutoff = new Date(Date.now() - 18 * 3600000).toISOString();
    return _load().filter(r =>
      r.projectId === projectId && !r.timeOut &&
      r.status !== 'voided' && r.timeIn < cutoff
    );
  },

  /** Check if a new check-in might duplicate an existing open record.
   *  Matches by name or mobile within the last 12 hours on the same project. */
  findDuplicate(projectId, token, name, mobile) {
    const normMob  = _normaliseMobile(mobile || '');
    const normName = name.trim().toLowerCase();
    const cutoff   = new Date(Date.now() - 12 * 3600000).toISOString();
    return _load().find(r => {
      if (r.timeOut || r.status === 'voided') return false;
      if (r.timeIn < cutoff) return false;
      const onProject = r.projectId === projectId ||
        (token && (r.checkinToken === token || r.projectId === token));
      if (!onProject) return false;
      const nameSame = r.name.toLowerCase() === normName;
      const mobSame  = normMob && r.mobile && _normaliseMobile(r.mobile) === normMob;
      return nameSame || mobSame;
    }) || null;
  },

  /** Find active check-ins by name and/or mobile (for checkout lookup without project context). */
  findActiveByLookup(name, mobile) {
    const normName = (name || '').trim().toLowerCase();
    const normMob  = _normaliseMobile(mobile || '');
    return _load().filter(r => {
      if (r.timeOut || r.status === 'voided') return false;
      const nameSame = normName && r.name.toLowerCase() === normName;
      const mobSame  = normMob && r.mobile && _normaliseMobile(r.mobile) === normMob;
      return nameSame || mobSame;
    });
  },

  /** Find an active check-in by name for a project. */
  findActive(projectId, name) {
    const needle = name.trim().toLowerCase();
    return _load().find(r =>
      r.projectId === projectId && !r.timeOut &&
      r.status !== 'voided' && r.name.toLowerCase() === needle
    ) || null;
  },

  /** Edit a record with a full audit trail. All changed fields are logged. */
  edit(id, patch, { reason = 'Correction', source = 'dashboard edit', changedBy = 'Business User' } = {}) {
    const records = _load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const rec = records[idx];

    const changes = [];
    for (const [field, newVal] of Object.entries(patch)) {
      if (String(rec[field] ?? '') !== String(newVal ?? '')) {
        changes.push({ field, from: rec[field], to: newVal });
      }
    }
    if (!changes.length) return true;

    const updated = { ...rec, ...patch };

    // Recalculate hours whenever time or break changes
    if ('timeOut' in patch || 'timeIn' in patch || 'breakMinutes' in patch) {
      const brk = Math.max(0, updated.breakMinutes || 0);
      updated.hoursOnSite = updated.timeOut ? _hours(updated.timeIn, updated.timeOut, brk) : null;
      if (!updated.timeOut && updated.status !== 'voided') updated.status = 'active';
      else if (updated.timeOut && updated.status !== 'voided') updated.status = 'checked-out';
    }

    updated.auditLog = [...(rec.auditLog || []), {
      id:        _id(),
      recordId:  id,
      timestamp: new Date().toISOString(),
      changedBy,
      source,
      reason,
      changes,
    }];

    records[idx] = updated;
    _save(records);
    return true;
  },

  /** Soft-delete a record. Keeps the record with status='voided' for audit purposes. */
  voidRecord(id, reason = 'Voided by builder', source = 'dashboard edit') {
    return attendanceStore.edit(id, { status: 'voided', voidReason: reason }, { reason, source });
  },

  /** Returns the full audit log for a record. */
  getAudit(id) {
    return _load().find(r => r.id === id)?.auditLog || [];
  },

  /** Hard-delete a record (prefer voidRecord). */
  delete(id) {
    _save(_load().filter(r => r.id !== id));
  },

  /** Update fields without audit logging (internal use). */
  update(id, patch) {
    const records = _load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    Object.assign(records[idx], patch);
    _save(records);
    return true;
  },

  /** Unique workers who have attended a project (workforce register). Voided records excluded. */
  workforceRegister(projectId, token) {
    const seen = new Map();
    const all = token
      ? attendanceStore.forProjectOrToken(projectId, token)
      : attendanceStore.forProject(projectId);
    for (const r of all) {
      if (r.status === 'voided') continue;
      const key = r.name.toLowerCase() + '|' + (r.company || '').toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { name: r.name, company: r.company, trade: r.trade, type: r.type, mobile: r.mobile, firstSeen: r.date, lastSeen: r.date, visits: 0, totalHours: 0 });
      }
      const entry = seen.get(key);
      entry.visits++;
      entry.totalHours = Math.round((entry.totalHours + (r.hoursOnSite || 0)) * 100) / 100;
      if (r.date < entry.firstSeen) entry.firstSeen = r.date;
      if (r.date > entry.lastSeen)  entry.lastSeen  = r.date;
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Export daily attendance as CSV (BOM-prefixed for Excel). */
  exportCSV(projectId, date, token) {
    const rows = (token
      ? attendanceStore.forProjectOrToken(projectId, token).filter(r => r.date === date)
      : attendanceStore.forProjectDate(projectId, date)
    ).filter(r => r.status !== 'voided');

    const fmt = iso => iso ? new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '';
    const csv = v => `"${String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const header = 'Name,Company,Trade,Type,Mobile,Check-In,Check-Out,Break (min),Recorded Site Hours,Status,Notes,Record Corrected';
    const lines = rows.map(r => [
      r.name, r.company, r.trade, r.type, r.mobile,
      fmt(r.timeIn),
      r.timeOut ? fmt(r.timeOut) : 'On site',
      r.breakMinutes || 0,
      r.hoursOnSite != null ? r.hoursOnSite.toFixed(2) : '',
      r.status || '',
      r.notes || '',
      (r.auditLog && r.auditLog.length) ? 'Yes' : 'No',
    ].map(csv).join(','));
    return '﻿' + [header, ...lines].join('\r\n');
  },

  /** Load representative demo attendance records. Idempotent — skips if demo data exists. */
  seedDemo(projectId, projectName, checkinToken = '') {
    const records = _load();
    if (records.some(r => r._demo)) return;

    const now   = new Date();
    const today = _today();
    const yest  = (() => {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    })();

    const base = (offset, overrides) => ({
      id: _id(), projectId, checkinToken, projectName, date: today,
      name: '', company: '', trade: '', mobile: '', type: 'subcontractor',
      timeIn: new Date(now.getTime() - offset).toISOString(),
      timeOut: null, breakMinutes: 0, hoursOnSite: null,
      status: 'active', gps: null, notes: '', checkedInBy: 'self',
      auditLog: [], _demo: true, ...overrides,
    });

    const d7id = _id();
    const d7timeIn = new Date(now.getTime() - 4 * 3600000).toISOString();

    const demos = [
      // 3 currently on site
      base(2   * 3600000, { name: 'James Talbot',   company: 'Talbot Plumbing', trade: 'Plumber',     mobile: '+61400111222', type: 'subcontractor' }),
      base(1.5 * 3600000, { name: 'Sarah Mitchell',  company: 'SM Electrical',  trade: 'Electrician', mobile: '+61400333444', type: 'subcontractor' }),
      base(45  * 60000,   { name: 'Carlos Rivera',   company: '',               trade: '',            mobile: '+61400555666', type: 'visitor',       notes: 'Architect site visit' }),
      // 2 checked out
      base(6 * 3600000, {
        name: 'Tom Nguyen', company: 'Ace Carpentry', trade: 'Carpenter', mobile: '+61400777888',
        timeOut: new Date(now.getTime() - 1 * 3600000).toISOString(), hoursOnSite: 5.0, status: 'checked-out',
      }),
      base(5 * 3600000, {
        name: 'Priya Sharma', company: 'Sharma Tiling', trade: 'Tiler', mobile: '+61400999000',
        timeOut: new Date(now.getTime() - 2 * 3600000).toISOString(), hoursOnSite: 3.0, status: 'checked-out',
      }),
      // 1 forgotten overnight checkout
      base(26 * 3600000, {
        name: 'Dave Kowalski', company: 'DK Concreting', trade: 'Concreter',
        mobile: '+61400112233', date: yest, status: 'checkout-required',
      }),
      // 1 corrected record with audit history
      {
        ...base(0, { id: d7id, name: 'Lisa Chen', company: 'Chen Painting', trade: 'Painter', mobile: '+61400445566' }),
        timeIn:  d7timeIn,
        timeOut: new Date(now.getTime() - 30 * 60000).toISOString(),
        hoursOnSite: 3.5, status: 'checked-out',
        auditLog: [{
          id: _id(), recordId: d7id,
          timestamp: new Date(now.getTime() - 20 * 60000).toISOString(),
          changedBy: 'Business User', source: 'dashboard edit',
          reason: 'Incorrect check-in time',
          changes: [{ field: 'timeIn', from: new Date(now.getTime() - 3 * 3600000).toISOString(), to: d7timeIn }],
        }],
      },
    ];

    _save([...demos, ...records]);
  },

  /** Remove only demo attendance records. */
  clearDemo() {
    _save(_load().filter(r => !r._demo));
  },

  _today,
  _normaliseMobile,
};
