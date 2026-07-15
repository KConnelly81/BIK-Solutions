/**
 * ApprovalUI — V1 Client Approval Workflow
 *
 * Injects a status tracker bar into the preview panel and provides
 * a Send Approval Email modal. Status is stored in record.approval
 * via documentHistory.updateApproval().
 *
 * APPROVAL_INTEGRATION_POINT — swap mailto: for a backend API call
 * that sends the email, generates a portal link, and returns a
 * portalToken. The record.approval shape already has V2 fields.
 */

import { documentHistory } from './document-history.js';

// ── Status config ─────────────────────────────────────────────────

export const APPROVAL_STATUSES = [
  { value: 'draft',    label: 'Draft',    colour: '#888' },
  { value: 'sent',     label: 'Sent',     colour: '#2c7dd4' },
  { value: 'approved', label: 'Approved', colour: '#2b9e3f' },
  { value: 'rejected', label: 'Rejected', colour: '#c0392b' },
  { value: 'archived', label: 'Archived', colour: '#aaa' }
];

function statusConfig(value) {
  return APPROVAL_STATUSES.find(s => s.value === value) || APPROVAL_STATUSES[0];
}

// ── CSS (injected once) ───────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('bik-approval-css')) return;
  const style = document.createElement('style');
  style.id = 'bik-approval-css';
  style.textContent = `
/* Approval status bar */
.approval-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #f5f0e8;
  border-bottom: 1px solid #e0dbd2;
  flex-wrap: wrap;
}
.approval-bar-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #888;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.approval-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}
.approval-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.7);
  flex-shrink: 0;
}
.approval-bar-meta {
  font-size: 0.72rem;
  color: #999;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.approval-bar-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.approval-bar-btn {
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid #d0cbc3;
  background: #fff;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.approval-bar-btn:hover { background: #f0ebe3; }
.approval-bar-btn--primary {
  background: #D85A30;
  border-color: #D85A30;
  color: #fff;
}
.approval-bar-btn--primary:hover { background: #c24e27; }

/* Approval modal */
.approval-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.approval-modal {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.22);
  width: 100%;
  max-width: 480px;
  overflow: hidden;
}
.approval-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}
.approval-modal-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2a2826;
  margin: 0;
}
.approval-modal-close {
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #888;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}
.approval-modal-close:hover { color: #333; }
.approval-modal-body { padding: 20px; }
.approval-modal-field { margin-bottom: 14px; }
.approval-modal-field label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 5px;
}
.approval-modal-field input,
.approval-modal-field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #333;
  background: #fafaf8;
}
.approval-modal-field input:focus,
.approval-modal-field textarea:focus {
  outline: none;
  border-color: #D85A30;
}
.approval-modal-preview {
  background: #f7f4ef;
  border: 1px solid #e5e0d8;
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 0.78rem;
  color: #555;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 160px;
  overflow-y: auto;
  margin-bottom: 14px;
}
.approval-modal-note {
  font-size: 0.72rem;
  color: #999;
  margin-bottom: 14px;
}
.approval-modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid #eee;
  background: #fafaf8;
}

/* Status change modal */
.status-modal-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
}
.status-modal-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.status-modal-option:hover { background: #f5f0e8; }
.status-modal-option.current { border-color: #D85A30; background: #fff8f5; }
.status-modal-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-modal-option-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}
.status-modal-option-desc {
  font-size: 0.72rem;
  color: #999;
}
.status-modal-notes-wrap {
  padding: 0 20px 16px;
}
`;
  document.head.appendChild(style);
}

// ── Status descriptions ───────────────────────────────────────────

const STATUS_DESCS = {
  draft:    'Not yet sent to client',
  sent:     'Sent and awaiting client approval',
  approved: 'Client has approved this variation',
  rejected: 'Client has rejected or declined',
  archived: 'Archived — no further action'
};

// ── ApprovalManager — main class ──────────────────────────────────

export class ApprovalManager {
  /**
   * @param {Object} opts
   * @param {Function} opts.getDocId   — () => string|null — current doc ID
   * @param {Function} opts.getState   — () => form state object
   * @param {Function} opts.toastFn    — (msg) => void
   */
  constructor({ getDocId, getState, toastFn }) {
    this._getDocId = getDocId;
    this._getState = getState;
    this._toast    = toastFn;
    this._bar      = null;
  }

  /** Inject the approval status bar into the preview panel header. */
  mountBar() {
    injectCSS();
    const previewHeader = document.querySelector('.preview-panel-header');
    if (!previewHeader) return;

    const bar = document.createElement('div');
    bar.className = 'approval-bar';
    bar.id = 'approval-bar';
    bar.innerHTML = this._buildBarHTML('draft', null);
    previewHeader.insertAdjacentElement('afterend', bar);
    this._bar = bar;

    bar.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'send')   this._openSendModal();
      if (action === 'status') this._openStatusModal();
    });
  }

  /** Refresh the bar to reflect current doc's approval state. */
  refresh() {
    if (!this._bar) return;
    const id = this._getDocId();
    const rec = id ? documentHistory.get(id) : null;
    const approval = rec?.approval || null;
    const status = approval?.status || 'draft';
    this._bar.innerHTML = this._buildBarHTML(status, approval);
  }

  _buildBarHTML(status, approval) {
    const cfg  = statusConfig(status);
    const meta = this._buildMeta(status, approval);
    const showSend = status === 'draft' || status === 'rejected';
    return `
      <span class="approval-bar-label">Approval</span>
      <span class="approval-status-badge" style="background:${cfg.colour}">
        <span class="approval-status-dot"></span>${cfg.label}
      </span>
      ${meta ? `<span class="approval-bar-meta">${esc(meta)}</span>` : '<span class="approval-bar-meta"></span>'}
      <div class="approval-bar-actions">
        ${showSend ? `<button class="approval-bar-btn approval-bar-btn--primary" data-action="send" type="button">Send approval email</button>` : ''}
        <button class="approval-bar-btn" data-action="status" type="button">Change status</button>
      </div>`;
  }

  _buildMeta(status, approval) {
    if (!approval) return '';
    if (status === 'sent' && approval.sentAt) {
      const d = new Date(approval.sentAt);
      const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      return `Sent ${dateStr}${approval.sentTo ? ' to ' + approval.sentTo : ''}`;
    }
    if (status === 'approved' && approval.approvedAt) {
      return `Approved ${new Date(approval.approvedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
    }
    if (status === 'rejected' && approval.rejectedAt) {
      return `Rejected ${new Date(approval.rejectedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
    }
    return '';
  }

  // ── Send Approval Email Modal ─────────────────────────────────

  _openSendModal() {
    const id = this._getDocId();
    if (!id) {
      this._toast('Generate the document first before sending for approval.');
      return;
    }
    const state = this._getState();
    const rec   = documentHistory.get(id);
    const existingEmail = rec?.approval?.sentTo || state.clientEmail || '';
    const subject = this._buildEmailSubject(state);
    const body    = this._buildEmailBody(state);

    const overlay = document.createElement('div');
    overlay.className = 'approval-modal-overlay';
    overlay.innerHTML = `
      <div class="approval-modal" role="dialog" aria-modal="true" aria-label="Send approval email">
        <div class="approval-modal-header">
          <h2 class="approval-modal-title">Send for Client Approval</h2>
          <button class="approval-modal-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="approval-modal-body">
          <div class="approval-modal-field">
            <label for="approval-client-email">Client email address</label>
            <input type="email" id="approval-client-email" value="${esc(existingEmail)}" placeholder="client@email.com" autocomplete="off" />
          </div>
          <div class="approval-modal-field">
            <label>Email preview</label>
            <div class="approval-modal-preview">${esc('Subject: ' + subject + '\n\n' + body)}</div>
          </div>
          <p class="approval-modal-note">Clicking "Open in email" will open your default email app with this email pre-filled. Attach the PDF before sending.</p>
        </div>
        <div class="approval-modal-footer">
          <button class="approval-bar-btn" type="button" data-action="cancel">Cancel</button>
          <button class="approval-bar-btn approval-bar-btn--primary" type="button" data-action="send">Open in email</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.approval-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('[data-action="send"]').addEventListener('click', () => {
      const email = overlay.querySelector('#approval-client-email').value.trim();
      if (!email) { this._toast('Please enter the client email address.'); return; }
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailto, '_self');

      // Record as Sent
      const now = new Date().toISOString();
      documentHistory.updateApproval(id, {
        status:          'sent',
        statusUpdatedAt: now,
        sentAt:          now,
        sentTo:          email,
        sentBy:          'builder'
      });
      this.refresh();
      this._toast('Email opened. Mark as Approved once the client confirms.');
      close();
    });
  }

  _buildEmailSubject(state) {
    const ref = state.variationNumber ? `VN-${state.variationNumber}` : 'Variation Notice';
    const proj = state.projectName || state.clientName || 'your project';
    return `Variation Notice — ${ref} — ${proj} — Approval required`;
  }

  _buildEmailBody(state) {
    const ref      = state.variationNumber ? `VN-${state.variationNumber}` : 'Variation Notice';
    const client   = state.clientName    || 'Client';
    const proj     = state.projectName   || 'your project';
    const builder  = state.builderName   || 'your builder';
    const phone    = state.builderPhone  || '';
    const email    = state.builderEmail  || '';
    const cost     = state.additionalCost ? `$${parseFloat(state.additionalCost).toFixed(2)} excl. GST` : '';
    const costLine = cost ? `\nVariation amount: ${cost}` : '';

    const contactLine = [phone, email].filter(Boolean).join(' | ');

    return `Hi ${client},

Please find attached Variation Notice ${ref} for ${proj}.

This variation covers the additional work detailed in the attached document.${costLine}

Please review, sign, and return the attached PDF to approve this variation. Work cannot proceed until the variation is approved in writing.

If you have any questions, please don't hesitate to get in touch.

Kind regards,
${builder}${contactLine ? '\n' + contactLine : ''}

---
This email was generated using BIK Business Toolkit.
Please retain a copy of the signed Variation Notice for your records.`;
  }

  // ── Change Status Modal ───────────────────────────────────────

  _openStatusModal() {
    const id = this._getDocId();
    if (!id) {
      this._toast('Generate the document first to track its status.');
      return;
    }
    const rec    = documentHistory.get(id);
    const current = rec?.approval?.status || 'draft';

    const overlay = document.createElement('div');
    overlay.className = 'approval-modal-overlay';
    overlay.innerHTML = `
      <div class="approval-modal" role="dialog" aria-modal="true" aria-label="Change approval status">
        <div class="approval-modal-header">
          <h2 class="approval-modal-title">Update Approval Status</h2>
          <button class="approval-modal-close" type="button" aria-label="Close">✕</button>
        </div>
        <div class="status-modal-options">
          ${APPROVAL_STATUSES.map(s => `
            <button class="status-modal-option${s.value === current ? ' current' : ''}" type="button" data-status="${s.value}">
              <span class="status-modal-swatch" style="background:${s.colour}"></span>
              <div>
                <div class="status-modal-option-label">${s.label}</div>
                <div class="status-modal-option-desc">${STATUS_DESCS[s.value]}</div>
              </div>
            </button>`).join('')}
        </div>
        <div class="status-modal-notes-wrap">
          <div class="approval-modal-field">
            <label for="approval-notes">Notes (optional)</label>
            <textarea id="approval-notes" rows="2" placeholder="e.g. Client approved by phone on 15 Jul 2026">${esc(rec?.approval?.notes || '')}</textarea>
          </div>
        </div>
        <div class="approval-modal-footer">
          <button class="approval-bar-btn" type="button" data-action="cancel">Cancel</button>
          <button class="approval-bar-btn approval-bar-btn--primary" type="button" data-action="save">Save status</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    let selectedStatus = current;
    overlay.querySelectorAll('.status-modal-option').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.status-modal-option').forEach(b => b.classList.remove('current'));
        btn.classList.add('current');
        selectedStatus = btn.dataset.status;
      });
    });

    const close = () => overlay.remove();
    overlay.querySelector('.approval-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('[data-action="save"]').addEventListener('click', () => {
      const notes = overlay.querySelector('#approval-notes').value.trim();
      const now   = new Date().toISOString();
      const update = {
        status:          selectedStatus,
        statusUpdatedAt: now,
        notes:           notes || null
      };
      if (selectedStatus === 'approved' && current !== 'approved') update.approvedAt = now;
      if (selectedStatus === 'rejected' && current !== 'rejected') update.rejectedAt = now;
      documentHistory.updateApproval(id, update);
      this.refresh();
      const cfg = statusConfig(selectedStatus);
      this._toast(`Status updated to: ${cfg.label}.`);
      close();
    });
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
