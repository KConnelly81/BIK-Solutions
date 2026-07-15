/**
 * ProjectStore — Lightweight Project Data Layer
 *
 * Stores project records in localStorage. Each project groups a client,
 * site address, contract reference, and all associated documents.
 *
 * PROJECT_STORAGE_POINT — swap _load/_save for Supabase calls in V2.
 *
 * @typedef {Object} Project
 * @property {string}  id
 * @property {string}  name          — display name (e.g. "Smith Residence")
 * @property {string}  status        — 'active' | 'on-hold' | 'complete' | 'archived'
 * @property {string}  clientName
 * @property {string}  clientEmail
 * @property {string}  clientPhone
 * @property {string}  projectName   — short project label used in documents
 * @property {string}  siteAddress
 * @property {string}  contractRef
 * @property {number|null} contractValue
 * @property {string}  notes
 * @property {string}  createdAt     — ISO 8601
 * @property {string}  updatedAt     — ISO 8601
 */

const PROJECTS_KEY = 'bik-projects';

export const PROJECT_STATUSES = [
  { value: 'active',   label: 'Active',    colour: '#2b9e3f' },
  { value: 'on-hold',  label: 'On hold',   colour: '#e67e22' },
  { value: 'complete', label: 'Complete',  colour: '#2c7dd4' },
  { value: 'archived', label: 'Archived',  colour: '#aaa'    }
];

/**
 * Maps project fields → form engine field IDs across all tools.
 * Used by ProjectUI to auto-populate tool forms when a project is active.
 */
export const PROJECT_FIELD_MAP = {
  clientName:   ['clientName'],
  clientEmail:  ['clientEmail'],
  clientPhone:  ['clientPhone'],
  projectName:  ['projectName'],
  siteAddress:  ['siteAddress', 'projectAddress', 'clientAddress'],
  contractRef:  ['contractRef']
};

class ProjectStore {

  // ── Internal ─────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save(projects) {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn('[BIK Projects] Storage full:', e.message);
    }
  }

  _uuid() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Create a new project.
   * @param {Partial<Project>} data
   * @returns {string} new project id
   */
  create(data) {
    const now = new Date().toISOString();
    const project = {
      id:             this._uuid(),
      name:           data.name           || data.clientName || 'New Project',
      status:         data.status         || 'active',
      clientName:     data.clientName     || '',
      clientEmail:    data.clientEmail    || '',
      clientPhone:    data.clientPhone    || '',
      projectName:    data.projectName    || data.name || '',
      siteAddress:    data.siteAddress    || '',
      contractRef:    data.contractRef    || '',
      contractValue:  data.contractValue  ?? null,
      notes:          data.notes          || '',
      createdAt:      now,
      updatedAt:      now
    };
    const projects = this._load();
    projects.unshift(project);
    this._save(projects);
    return project.id;
  }

  /**
   * Update a project. Merges changes and bumps updatedAt.
   * @param {string} id
   * @param {Partial<Project>} changes
   * @returns {boolean}
   */
  update(id, changes) {
    const projects = this._load();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return false;
    Object.assign(projects[idx], changes, { updatedAt: new Date().toISOString() });
    this._save(projects);
    return true;
  }

  /**
   * Get a project by id.
   * @param {string} id
   * @returns {Project|null}
   */
  get(id) {
    return this._load().find(p => p.id === id) || null;
  }

  /**
   * List all projects, newest-updated first.
   * @param {string} [status] — filter by status
   * @returns {Project[]}
   */
  list(status) {
    const all = this._load();
    return status ? all.filter(p => p.status === status) : all;
  }

  /**
   * Delete a project.
   * @param {string} id
   */
  delete(id) {
    this._save(this._load().filter(p => p.id !== id));
  }

  /**
   * Return the most recently updated active project.
   * @returns {Project|null}
   */
  getMostRecent() {
    const active = this.list('active');
    return active[0] || this.list()[0] || null;
  }

  /**
   * Touch a project's updatedAt timestamp (e.g. when a doc is saved to it).
   * @param {string} id
   */
  touch(id) {
    const projects = this._load();
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) return;
    const p = projects.splice(idx, 1)[0];
    p.updatedAt = new Date().toISOString();
    projects.unshift(p);
    this._save(projects);
  }
}

export const projectStore = new ProjectStore();
