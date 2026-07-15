/**
 * ProjectUI — Project Context Bar and Modal for Tool Pages
 *
 * Injects a project context bar above the form, allows builders to link
 * a document to a project, auto-fills project fields into the form engine,
 * and provides create/change/remove project modals.
 */

import { projectStore, PROJECT_FIELD_MAP, PROJECT_STATUSES } from './project-store.js';

// ── CSS ───────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('bik-project-css')) return;
  const style = document.createElement('style');
  style.id = 'bik-project-css';
  style.textContent = `
/* Project context bar */
.project-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  background: #f0ece4;
  border-bottom: 1px solid #e0dbd2;
  flex-wrap: wrap;
}
.project-bar-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}
.project-bar-info {
  flex: 1;
  min-width: 0;
}
.project-bar-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: #2a2826;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-bar-meta {
  font-size: 0.72rem;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.project-bar-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.project-bar-btn {
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid #d0cbc3;
  background: #fff;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;
}
.project-bar-btn:hover { background: #e8e3db; }
.project-bar--empty {
  background: #f8f5f0;
}
.project-bar--empty .project-bar-link {
  font-size: 0.78rem;
  color: #D85A30;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.project-bar--empty .project-bar-link:hover { color: #b8461e; }

/* Project modal (shared base with approval modal) */
.project-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.project-modal {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.22);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}
.project-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.project-modal-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2a2826;
  margin: 0;
}
.project-modal-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #888;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.project-modal-close:hover { color: #333; }
.project-modal-body { padding: 16px 20px; }
.project-modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid #eee;
  background: #fafaf8;
  position: sticky;
  bottom: 0;
}

/* Project list in picker */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  max-height: 320px;
  overflow-y: auto;
}
.project-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s, background 0.12s;
}
.project-list-item:hover { background: #f5f0e8; border-color: #c5bfb5; }
.project-list-item.selected { border-color: #D85A30; background: #fff8f5; }
.project-list-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.project-list-name {
  font-size: 0.87rem;
  font-weight: 600;
  color: #2a2826;
}
.project-list-meta {
  font-size: 0.72rem;
  color: #999;
}
.project-list-empty {
  padding: 16px;
  text-align: center;
  color: #aaa;
  font-size: 0.83rem;
}
.project-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.72rem;
  color: #bbb;
  margin: 10px 0;
}
.project-divider::before,
.project-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8e3db;
}

/* Project form fields */
.project-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.project-form-field { display: flex; flex-direction: column; gap: 4px; }
.project-form-field.full { grid-column: 1 / -1; }
.project-form-label {
  font-size: 0.76rem;
  font-weight: 600;
  color: #666;
}
.project-form-input,
.project-form-textarea,
.project-form-select {
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 0.84rem;
  color: #333;
  background: #fafaf8;
  font-family: inherit;
  width: 100%;
}
.project-form-input:focus,
.project-form-textarea:focus,
.project-form-select:focus {
  outline: none;
  border-color: #D85A30;
}
.project-form-textarea { resize: vertical; min-height: 54px; }

/* Modal buttons */
.pm-btn {
  font-size: 0.8rem;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid #d0cbc3;
  background: #fff;
  color: #555;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
}
.pm-btn:hover { background: #f0ebe3; }
.pm-btn--primary {
  background: #D85A30;
  border-color: #D85A30;
  color: #fff;
}
.pm-btn--primary:hover { background: #c24e27; }
.pm-btn--ghost { color: #888; }
.pm-btn--ghost:hover { color: #333; }
.pm-btn--danger { color: #c0392b; border-color: #c0392b; }
.pm-btn--danger:hover { background: #fdf0ee; }

/* Project status badge (small inline use) */
.project-status-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  vertical-align: middle;
}

@media (max-width: 480px) {
  .project-form-grid { grid-template-columns: 1fr; }
  .project-form-field.full { grid-column: 1; }
}
`;
  document.head.appendChild(style);
}

// ── Helpers ───────────────────────────────────────────────────────

function statusColour(status) {
  return PROJECT_STATUSES.find(s => s.value === status)?.colour || '#888';
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── ProjectUI — main class ────────────────────────────────────────

export class ProjectUI {
  /**
   * @param {Object} opts
   * @param {FormEngine} opts.engine    — tool's form engine
   * @param {Function}   opts.toastFn  — (msg) => void
   */
  constructor({ engine, toastFn }) {
    this._engine   = engine;
    this._toast    = toastFn;
    this._projectId = null;
    this._bar       = null;
  }

  /** Current project id, or null if none selected. */
  get projectId() { return this._projectId; }

  /**
   * Read ?project=<id> from the URL and, if found, load that project.
   * Call after engine.mount().
   * @returns {Project|null}
   */
  readURLParam() {
    const id = new URLSearchParams(location.search).get('project');
    if (!id) return null;
    const project = projectStore.get(id);
    if (project) {
      this._projectId = id;
      this._applyToForm(project);
    }
    return project || null;
  }

  /**
   * Inject the project context bar above the form container.
   * Call after readURLParam().
   */
  mountBar(formContainer) {
    injectCSS();
    const bar = document.createElement('div');
    bar.id = 'project-bar';
    this._bar = bar;
    formContainer.before(bar);
    this._renderBar();

    bar.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'pick')   this.openPicker();
      if (action === 'change') this.openPicker();
      if (action === 'remove') this._removeProject();
      if (action === 'create') this.openCreateModal(null, id => {
        this._setProject(id);
        this._toast('Project created and linked.');
      });
    });
  }

  _renderBar() {
    if (!this._bar) return;
    if (!this._projectId) {
      this._bar.className = 'project-bar project-bar--empty';
      this._bar.innerHTML = `
        <span class="project-bar-icon">📁</span>
        <span class="project-bar-info" style="color:#aaa;font-size:0.8rem;">No project linked</span>
        <div class="project-bar-actions">
          <button class="project-bar-link" data-action="pick" type="button">Link to a project</button>
        </div>`;
      return;
    }
    const p = projectStore.get(this._projectId);
    if (!p) { this._removeProject(); return; }
    const colour = statusColour(p.status);
    this._bar.className = 'project-bar';
    this._bar.innerHTML = `
      <span class="project-bar-icon">📁</span>
      <div class="project-bar-info">
        <div class="project-bar-name">${esc(p.name)}</div>
        ${p.clientName ? `<div class="project-bar-meta">${esc(p.clientName)}${p.siteAddress ? ' · ' + esc(p.siteAddress.split('\n')[0]) : ''}</div>` : ''}
      </div>
      <span class="project-status-badge" style="background:${colour}">${esc(PROJECT_STATUSES.find(s=>s.value===p.status)?.label||p.status)}</span>
      <div class="project-bar-actions">
        <button class="project-bar-btn" data-action="change" type="button">Change</button>
        <button class="project-bar-btn" data-action="remove" type="button">×</button>
      </div>`;
  }

  _applyToForm(project) {
    for (const [projField, formFields] of Object.entries(PROJECT_FIELD_MAP)) {
      const value = project[projField];
      if (!value) continue;
      for (const fieldId of formFields) {
        try { this._engine.setState(fieldId, value); } catch (_) {}
      }
    }
    this._engine._onChange?.(this._engine.getState());
  }

  _setProject(id) {
    this._projectId = id;
    const p = projectStore.get(id);
    if (p) this._applyToForm(p);
    this._renderBar();
  }

  _removeProject() {
    this._projectId = null;
    this._renderBar();
    this._toast('Project unlinked from this document.');
  }

  // ── Project Picker Modal ──────────────────────────────────────

  openPicker() {
    const projects = projectStore.list();
    const overlay  = document.createElement('div');
    overlay.className = 'project-modal-overlay';
    const listHTML = projects.length === 0
      ? `<div class="project-list-empty">No projects yet. Create one below.</div>`
      : projects.map(p => {
          const colour = statusColour(p.status);
          const meta   = [p.clientName, p.siteAddress?.split('\n')[0]].filter(Boolean).join(' · ');
          return `<button class="project-list-item${p.id === this._projectId ? ' selected' : ''}" type="button" data-id="${esc(p.id)}">
            <span class="project-list-swatch" style="background:${colour}"></span>
            <div>
              <div class="project-list-name">${esc(p.name)}</div>
              ${meta ? `<div class="project-list-meta">${esc(meta)}</div>` : ''}
            </div>
          </button>`;
        }).join('');

    overlay.innerHTML = `
      <div class="project-modal" role="dialog" aria-modal="true" aria-label="Link to project">
        <div class="project-modal-header">
          <h2 class="project-modal-title">Link to a Project</h2>
          <button class="project-modal-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="project-modal-body">
          <div class="project-list">${listHTML}</div>
          <div class="project-divider">or</div>
          <button class="pm-btn" type="button" data-action="new" style="width:100%">+ Create new project</button>
        </div>
        <div class="project-modal-footer">
          <button class="pm-btn pm-btn--ghost" type="button" data-action="cancel">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.project-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelectorAll('.project-list-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._setProject(btn.dataset.id);
        this._toast(`Project linked: ${projectStore.get(btn.dataset.id)?.name}`);
        close();
      });
    });

    overlay.querySelector('[data-action="new"]').addEventListener('click', () => {
      close();
      this.openCreateModal(null, id => {
        this._setProject(id);
        this._toast('Project created and linked.');
      });
    });
  }

  // ── Project Create / Edit Modal ───────────────────────────────

  /**
   * Open the create/edit modal.
   * @param {string|null} projectId — null to create, id to edit
   * @param {Function} [onSave]     — (id) => void
   */
  openCreateModal(projectId, onSave) {
    const existing = projectId ? projectStore.get(projectId) : null;
    const title    = existing ? 'Edit Project' : 'New Project';

    // Pre-fill from current form state if creating new
    let prefill = {};
    if (!existing) {
      const state = this._engine.getState();
      prefill = {
        clientName:  state.clientName  || '',
        clientEmail: state.clientEmail || '',
        clientPhone: state.clientPhone || '',
        projectName: state.projectName || '',
        siteAddress: state.siteAddress || state.projectAddress || state.clientAddress || '',
        contractRef: state.contractRef || ''
      };
    }

    const v = key => esc((existing || prefill)[key] || '');

    const overlay = document.createElement('div');
    overlay.className = 'project-modal-overlay';
    overlay.innerHTML = `
      <div class="project-modal" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="project-modal-header">
          <h2 class="project-modal-title">${title}</h2>
          <button class="project-modal-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="project-modal-body">
          <div class="project-form-grid">
            <div class="project-form-field full">
              <label class="project-form-label" for="pf-name">Project name *</label>
              <input class="project-form-input" type="text" id="pf-name" value="${v('name') || v('projectName')}" placeholder="e.g. Smith Residence Renovation" autocomplete="off" />
            </div>
            <div class="project-form-field">
              <label class="project-form-label" for="pf-clientName">Client name</label>
              <input class="project-form-input" type="text" id="pf-clientName" value="${v('clientName')}" placeholder="John & Jane Smith" autocomplete="off" />
            </div>
            <div class="project-form-field">
              <label class="project-form-label" for="pf-clientEmail">Client email</label>
              <input class="project-form-input" type="email" id="pf-clientEmail" value="${v('clientEmail')}" placeholder="client@email.com" autocomplete="off" />
            </div>
            <div class="project-form-field">
              <label class="project-form-label" for="pf-clientPhone">Client phone</label>
              <input class="project-form-input" type="tel" id="pf-clientPhone" value="${v('clientPhone')}" placeholder="0400 000 000" autocomplete="off" />
            </div>
            <div class="project-form-field">
              <label class="project-form-label" for="pf-contractRef">Contract / job reference</label>
              <input class="project-form-input" type="text" id="pf-contractRef" value="${v('contractRef')}" placeholder="e.g. JOB-2026-014" autocomplete="off" />
            </div>
            <div class="project-form-field full">
              <label class="project-form-label" for="pf-siteAddress">Site address</label>
              <textarea class="project-form-textarea" id="pf-siteAddress" rows="2" placeholder="123 Example St, Brisbane QLD 4000">${v('siteAddress')}</textarea>
            </div>
            <div class="project-form-field">
              <label class="project-form-label" for="pf-status">Status</label>
              <select class="project-form-select" id="pf-status">
                ${PROJECT_STATUSES.map(s => `<option value="${s.value}"${(existing?.status || 'active') === s.value ? ' selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
            <div class="project-form-field">
              <label class="project-form-label" for="pf-contractValue">Contract value ($, excl. GST)</label>
              <input class="project-form-input" type="number" id="pf-contractValue" value="${existing?.contractValue || ''}" placeholder="0.00" min="0" step="0.01" />
            </div>
            <div class="project-form-field full">
              <label class="project-form-label" for="pf-notes">Notes</label>
              <textarea class="project-form-textarea" id="pf-notes" rows="2" placeholder="Any internal notes about this project">${v('notes')}</textarea>
            </div>
          </div>
        </div>
        <div class="project-modal-footer">
          ${existing ? `<button class="pm-btn pm-btn--danger" type="button" data-action="delete" style="margin-right:auto">Delete project</button>` : ''}
          <button class="pm-btn pm-btn--ghost" type="button" data-action="cancel">Cancel</button>
          <button class="pm-btn pm-btn--primary" type="button" data-action="save">Save project</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#pf-name')?.focus();

    const close = () => overlay.remove();
    overlay.querySelector('.project-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = overlay.querySelector('#pf-name').value.trim();
      if (!name) { this._toast('Project name is required.'); return; }
      const data = {
        name,
        clientName:     overlay.querySelector('#pf-clientName').value.trim(),
        clientEmail:    overlay.querySelector('#pf-clientEmail').value.trim(),
        clientPhone:    overlay.querySelector('#pf-clientPhone').value.trim(),
        contractRef:    overlay.querySelector('#pf-contractRef').value.trim(),
        siteAddress:    overlay.querySelector('#pf-siteAddress').value.trim(),
        status:         overlay.querySelector('#pf-status').value,
        contractValue:  parseFloat(overlay.querySelector('#pf-contractValue').value) || null,
        notes:          overlay.querySelector('#pf-notes').value.trim(),
        projectName:    overlay.querySelector('#pf-clientName').value.trim()
                        ? name
                        : (overlay.querySelector('#pf-name').value.trim())
      };
      if (existing) {
        projectStore.update(existing.id, data);
        onSave?.(existing.id);
      } else {
        const id = projectStore.create(data);
        onSave?.(id);
      }
      close();
    });

    overlay.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (!confirm(`Delete project "${existing.name}"? Documents will not be deleted.`)) return;
      projectStore.delete(existing.id);
      if (this._projectId === existing.id) this._removeProject();
      close();
      this._toast('Project deleted.');
    });
  }
}
