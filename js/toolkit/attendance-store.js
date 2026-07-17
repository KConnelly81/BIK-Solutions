/**
 * AttendanceStore — Site Attendance & Workforce Register
 * Stores attendance records in localStorage. No backend required.
 *
 * localStorage key: bik-attendance
 *
 * Record shape:
 * {
 *   id:          string      — 'att-<timestamp>-<random>'
 *   projectId:   string      — links to bik-projects entry
 *   projectName: string      — denormalised for display without project lookup
 *   date:        string      — 'YYYY-MM-DD' local date
 *   name:        string      — worker full name
 *   company:     string      — employer / subcontractor company
 *   trade:       string      — trade/role (Plumber, Carpenter, Inspector, etc.)
 *   mobile:      string      — mobile number
 *   type:        string      — 'employee'|'subcontractor'|'labour-hire'|'visitor'|'inspector'|'supplier'|'other'
 *   timeIn:      string      — ISO datetime
 *   timeOut:     string|null — ISO datetime, null if still on site
 *   hoursOnSite: number|null — calculated on check-out
 *   gps:         {lat,lng}|null
 *   notes:       string
 *   checkedInBy: string      — 'self'|'builder'
 * }
 */

const STORE_KEY = 'bik-attendance';

function _load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
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

function _hours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return null;
  const diff = new Date(timeOut) - new Date(timeIn);
  if (diff <= 0) return null;
  return Math.round((diff / 3600000) * 100) / 100;
}

export const attendanceStore = {

  /** Check in a worker. Returns the new record id. */
  checkIn(data) {
    const records = _load();
    const now = new Date().toISOString();
    const record = {
      id:           _id(),
      projectId:    data.projectId    || '',
      checkinToken: data.checkinToken || '',   // public token used for this check-in
      projectName:  data.projectName  || '',
      date:        data.date        || _today(),
      name:        (data.name       || '').trim(),
      company:     (data.company    || '').trim(),
      trade:       (data.trade      || '').trim(),
      mobile:      (data.mobile     || '').trim(),
      type:        data.type        || 'subcontractor',
      timeIn:      data.timeIn      || now,
      timeOut:     null,
      hoursOnSite: null,
      gps:         data.gps         || null,
      notes:       (data.notes      || '').trim(),
      checkedInBy: data.checkedInBy || 'self',
    };
    records.unshift(record);
    _save(records);
    return record.id;
  },

  /** Check out a worker by attendance id. */
  checkOut(id, { timeOut, notes } = {}) {
    const records = _load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const out = timeOut || new Date().toISOString();
    records[idx].timeOut     = out;
    records[idx].hoursOnSite = _hours(records[idx].timeIn, out);
    if (notes) records[idx].notes = notes;
    _save(records);
    return true;
  },

  /** Get a single record by id. */
  get(id) {
    return _load().find(r => r.id === id) || null;
  },

  /** All records for a project on a given date (YYYY-MM-DD). */
  forProjectDate(projectId, date) {
    return _load().filter(r => r.projectId === projectId && r.date === date);
  },

  /** All records for a project (all dates). */
  forProject(projectId) {
    return _load().filter(r => r.projectId === projectId);
  },

  /**
   * All records for a project, matching by internal ID or by check-in token.
   * Needed because workers checking in on their own devices may produce records
   * where projectId === checkinToken (no internal ID was available at check-in time).
   */
  forProjectOrToken(projectId, token) {
    return _load().filter(r =>
      r.projectId === projectId ||
      (token && (r.checkinToken === token || r.projectId === token))
    );
  },

  /** Records currently on site for a project (checked in, not checked out). */
  onSite(projectId) {
    return _load().filter(r => r.projectId === projectId && !r.timeOut);
  },

  /** All records for today across all projects. */
  todayAll() {
    const today = _today();
    return _load().filter(r => r.date === today);
  },

  /** All records for today for a specific project. */
  todayForProject(projectId) {
    const today = _today();
    return _load().filter(r => r.projectId === projectId && r.date === today);
  },

  /** Total hours on site for a project on a date. */
  totalHours(projectId, date) {
    return attendanceStore.forProjectDate(projectId, date)
      .reduce((sum, r) => sum + (r.hoursOnSite || 0), 0);
  },

  /** Workers who forgot to check out (checked in >12 hours ago, no checkout). */
  forgotCheckout(projectId) {
    const cutoff = new Date(Date.now() - 12 * 3600000).toISOString();
    return attendanceStore.onSite(projectId).filter(r => r.timeIn < cutoff);
  },

  /** Delete a record (admin correction). */
  delete(id) {
    const records = _load().filter(r => r.id !== id);
    _save(records);
  },

  /** Update arbitrary fields on a record. */
  update(id, patch) {
    const records = _load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    Object.assign(records[idx], patch);
    _save(records);
    return true;
  },

  /** Find an active check-in for a worker by name+project (for check-out lookup). */
  findActive(projectId, name) {
    const needle = name.trim().toLowerCase();
    return _load().find(r =>
      r.projectId === projectId &&
      !r.timeOut &&
      r.name.toLowerCase() === needle
    ) || null;
  },

  /** All unique workers who have ever attended a project (workforce register). */
  workforceRegister(projectId, token) {
    const seen = new Map();
    for (const r of (token ? attendanceStore.forProjectOrToken(projectId, token) : attendanceStore.forProject(projectId))) {
      const key = r.name.toLowerCase() + '|' + r.company.toLowerCase();
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

  /** Export today's attendance as CSV string. */
  exportCSV(projectId, date) {
    const rows = attendanceStore.forProjectDate(projectId, date);
    const header = 'Name,Company,Trade,Type,Mobile,Time In,Time Out,Hours on Site,Notes';
    const lines = rows.map(r => [
      r.name, r.company, r.trade, r.type, r.mobile,
      r.timeIn ? new Date(r.timeIn).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '',
      r.timeOut ? new Date(r.timeOut).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : 'On site',
      r.hoursOnSite != null ? r.hoursOnSite.toFixed(2) : '',
      r.notes
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [header, ...lines].join('\n');
  },

  _today,
};
