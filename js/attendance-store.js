/* ============================================================
   BIK Solutions — attendance-store.js
   Site Sign-In & Workforce Register  |  localStorage data layer
   Schema version: 1
   Namespace: bik_att_
   ============================================================ */

(function (root) {
  'use strict';

  /* ── Keys ─────────────────────────────────────────────── */
  var KEYS = {
    schemaVersion : 'bik_att_schema_version',
    projects      : 'bik_att_projects',
    records       : 'bik_att_records',
    audit         : 'bik_att_audit',
  };

  var CURRENT_SCHEMA = 1;

  /* ── Helpers ───────────────────────────────────────────── */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function now() {
    return new Date().toISOString();
  }

  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[BIK Attendance] localStorage write failed:', e);
      return false;
    }
  }

  /* ── Schema migration ──────────────────────────────────── */
  function migrate() {
    var version = load(KEYS.schemaVersion) || 0;
    if (version >= CURRENT_SCHEMA) return;

    // v0 → v1: initialise empty collections
    if (version < 1) {
      if (!load(KEYS.projects)) save(KEYS.projects, []);
      if (!load(KEYS.records))  save(KEYS.records,  []);
      if (!load(KEYS.audit))    save(KEYS.audit,    []);
    }

    save(KEYS.schemaVersion, CURRENT_SCHEMA);
  }

  migrate();

  /* ── Projects ──────────────────────────────────────────── */
  var Projects = {
    all: function () {
      return load(KEYS.projects) || [];
    },

    get: function (projectId) {
      return this.all().find(function (p) { return p.id === projectId; }) || null;
    },

    create: function (name, address, opts) {
      opts = opts || {};
      var project = {
        id         : uid(),
        name       : (name || '').trim(),
        address    : (address || '').trim(),
        createdAt  : now(),
        updatedAt  : now(),
        isSample   : opts.isSample || false,
      };
      var list = this.all();
      list.push(project);
      save(KEYS.projects, list);
      return project;
    },

    update: function (projectId, fields) {
      var list = this.all();
      var idx = list.findIndex(function (p) { return p.id === projectId; });
      if (idx === -1) return null;
      Object.assign(list[idx], fields, { updatedAt: now() });
      save(KEYS.projects, list);
      return list[idx];
    },

    clearSamples: function () {
      var list = this.all().filter(function (p) { return !p.isSample; });
      save(KEYS.projects, list);
      // Also clear sample attendance records
      Records.clearSamples();
    },
  };

  /* ── Attendance Records ────────────────────────────────── */
  var Records = {
    all: function () {
      return load(KEYS.records) || [];
    },

    /* Active = checked in, no checkout yet */
    active: function (projectId) {
      return this.all().filter(function (r) {
        return r.status === 'active' &&
               (!projectId || r.projectId === projectId);
      });
    },

    /* Everyone currently on site for a project */
    onSite: function (projectId) {
      return this.active(projectId);
    },

    forProject: function (projectId) {
      return this.all().filter(function (r) { return r.projectId === projectId; });
    },

    /* Records that were still active at end of a previous calendar day */
    forgottenCheckouts: function () {
      var today = new Date().toDateString();
      return this.all().filter(function (r) {
        if (r.status !== 'active') return false;
        var checkinDate = new Date(r.checkinAt).toDateString();
        return checkinDate !== today;
      });
    },

    get: function (id) {
      return this.all().find(function (r) { return r.id === id; }) || null;
    },

    /* Check for duplicate active check-in by name+project */
    findDuplicate: function (projectId, workerName) {
      var name = (workerName || '').trim().toLowerCase();
      return this.active(projectId).find(function (r) {
        return r.workerName.toLowerCase() === name;
      }) || null;
    },

    checkin: function (data) {
      var t = now();
      var record = {
        id          : uid(),
        projectId   : data.projectId,
        workerName  : (data.workerName  || '').trim(),
        company     : (data.company     || '').trim(),
        workerType  : data.workerType   || 'Contractor',
        trade       : (data.trade       || '').trim(),
        mobile      : (data.mobile      || '').trim(),
        checkinAt   : t,
        checkoutAt  : null,
        status      : 'active',
        recordedSiteHours: null,
        createdAt   : t,
        updatedAt   : t,
        isSample    : data.isSample || false,
      };
      var list = this.all();
      list.push(record);
      save(KEYS.records, list);
      return record;
    },

    checkout: function (id) {
      var list = this.all();
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx === -1) return null;
      if (list[idx].status !== 'active') return list[idx];

      var t = now();
      var checkinMs = new Date(list[idx].checkinAt).getTime();
      var checkoutMs = new Date(t).getTime();
      var hrs = Math.round(((checkoutMs - checkinMs) / 3600000) * 100) / 100;
      if (hrs < 0) hrs = 0;

      list[idx].checkoutAt = t;
      list[idx].status = 'completed';
      list[idx].recordedSiteHours = hrs;
      list[idx].updatedAt = t;
      save(KEYS.records, list);
      return list[idx];
    },

    /* Manual correction — builder closes a forgotten checkout */
    manualClose: function (id, checkoutTime, note) {
      var list = this.all();
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx === -1) return null;

      var original = JSON.parse(JSON.stringify(list[idx]));

      var checkinMs = new Date(list[idx].checkinAt).getTime();
      var checkoutMs = new Date(checkoutTime).getTime();
      var hrs = Math.round(((checkoutMs - checkinMs) / 3600000) * 100) / 100;

      list[idx].checkoutAt = checkoutTime;
      list[idx].status = 'corrected';
      list[idx].recordedSiteHours = hrs < 0 ? 0 : hrs;
      list[idx].correctionNote = (note || '').trim();
      list[idx].updatedAt = now();
      save(KEYS.records, list);

      Audit.log(id, 'manual_close', original, list[idx], note);

      return list[idx];
    },

    /* Builder manually checks out someone still on site */
    adminCheckout: function (id, note) {
      var list = this.all();
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx === -1) return null;
      var original = JSON.parse(JSON.stringify(list[idx]));

      var t = now();
      var checkinMs = new Date(list[idx].checkinAt).getTime();
      var hrs = Math.round(((new Date(t).getTime() - checkinMs) / 3600000) * 100) / 100;

      list[idx].checkoutAt = t;
      list[idx].status = 'admin_checkout';
      list[idx].recordedSiteHours = hrs;
      list[idx].correctionNote = (note || '').trim();
      list[idx].updatedAt = t;
      save(KEYS.records, list);

      Audit.log(id, 'admin_checkout', original, list[idx], note);
      return list[idx];
    },

    clearSamples: function () {
      var list = this.all().filter(function (r) { return !r.isSample; });
      save(KEYS.records, list);
    },

    /* Workforce register: aggregate per worker across a project */
    workforceRegister: function (projectId) {
      var records = projectId ? this.forProject(projectId) : this.all();
      var map = {};
      records.forEach(function (r) {
        var key = r.workerName.toLowerCase() + '|' + r.company.toLowerCase();
        if (!map[key]) {
          map[key] = {
            workerName        : r.workerName,
            company           : r.company,
            trade             : r.trade,
            workerType        : r.workerType,
            visitCount        : 0,
            totalSiteHours    : 0,
            lastAttendance    : r.checkinAt,
          };
        }
        map[key].visitCount++;
        if (r.recordedSiteHours) map[key].totalSiteHours += r.recordedSiteHours;
        if (r.checkinAt > map[key].lastAttendance) map[key].lastAttendance = r.checkinAt;
      });
      return Object.values(map).sort(function (a, b) {
        return b.lastAttendance.localeCompare(a.lastAttendance);
      });
    },

    /* All records for today across a project */
    todayRecords: function (projectId) {
      var today = new Date().toDateString();
      return this.forProject(projectId).filter(function (r) {
        return new Date(r.checkinAt).toDateString() === today;
      });
    },
  };

  /* ── Audit Log ─────────────────────────────────────────── */
  var Audit = {
    all: function () {
      return load(KEYS.audit) || [];
    },

    log: function (recordId, action, prevValue, newValue, note) {
      var entry = {
        id         : uid(),
        recordId   : recordId,
        action     : action,
        prevValue  : prevValue,
        newValue   : newValue,
        note       : (note || '').trim(),
        timestamp  : now(),
      };
      var list = this.all();
      list.push(entry);
      save(KEYS.audit, list);
      return entry;
    },

    forRecord: function (recordId) {
      return this.all().filter(function (e) { return e.recordId === recordId; });
    },
  };

  /* ── CSV helpers ───────────────────────────────────────── */
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-AU') + ' ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }

  function toCSV(rows, headers) {
    var lines = [headers.join(',')];
    rows.forEach(function (row) {
      lines.push(headers.map(function (h) {
        var v = row[h] != null ? String(row[h]) : '';
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(','));
    });
    return lines.join('\r\n');
  }

  function downloadCSV(content, filename) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  var CSV = {
    dailyAttendance: function (projectId) {
      var records = Records.todayRecords(projectId);
      var project = Projects.get(projectId);
      var siteName = project ? project.name : projectId;
      var rows = records.map(function (r) {
        return {
          'Attendance ID'       : r.id,
          'Site'                : siteName,
          'Worker Name'         : r.workerName,
          'Company'             : r.company,
          'Worker Type'         : r.workerType,
          'Trade'               : r.trade,
          'Mobile'              : r.mobile,
          'Check-In'            : formatDate(r.checkinAt),
          'Check-Out'           : formatDate(r.checkoutAt),
          'Status'              : r.status,
          'Recorded Site Hours' : r.recordedSiteHours != null ? r.recordedSiteHours.toFixed(2) : '',
        };
      });
      var headers = ['Attendance ID','Site','Worker Name','Company','Worker Type','Trade','Mobile','Check-In','Check-Out','Status','Recorded Site Hours'];
      var today = new Date().toISOString().slice(0, 10);
      downloadCSV(toCSV(rows, headers), 'attendance-' + today + '.csv');
    },

    workforce: function (projectId) {
      var register = Records.workforceRegister(projectId);
      var project = Projects.get(projectId);
      var siteName = project ? project.name : (projectId || 'All Sites');
      var rows = register.map(function (w) {
        return {
          'Site'                   : siteName,
          'Worker Name'            : w.workerName,
          'Company'                : w.company,
          'Trade'                  : w.trade,
          'Worker Type'            : w.workerType,
          'Visit Count'            : w.visitCount,
          'Total Recorded Site Hours': w.totalSiteHours.toFixed(2),
          'Last Attendance'        : formatDate(w.lastAttendance),
        };
      });
      var headers = ['Site','Worker Name','Company','Trade','Worker Type','Visit Count','Total Recorded Site Hours','Last Attendance'];
      downloadCSV(toCSV(rows, headers), 'workforce-register.csv');
    },
  };

  /* ── Expose public API ─────────────────────────────────── */
  root.BIKAttendance = {
    Projects : Projects,
    Records  : Records,
    Audit    : Audit,
    CSV      : CSV,
    uid      : uid,
    formatDate: formatDate,
  };

}(typeof window !== 'undefined' ? window : this));
