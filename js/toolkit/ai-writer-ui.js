/**
 * AI Writer UI — Shared UI Components
 *
 * Reusable DOM components for the AI Writing Engine.
 * Import these in every tool that needs AI text assistance.
 *
 * Extracted from variation-notice/index.js so all tools share the same behaviour.
 */

import { AIWriter } from './ai-writer.js';

// ── Mode configuration ────────────────────────────────────────

export const AI_MODES = {
  professional: {
    icon: '✦',
    label: 'Rewrite Professionally',
    loadingLabel: 'Rewriting…',
    className: 'ai-btn ai-btn--writing',
    toast: 'Text rewritten professionally.'
  },
  'contract-protection': {
    icon: '⚖',
    label: 'Strengthen for Contract',
    loadingLabel: 'Strengthening…',
    className: 'ai-btn ai-btn--contract',
    toast: 'Text strengthened for contract protection.'
  },
  'spell-grammar': {
    icon: '✓',
    label: 'Spell & Grammar',
    loadingLabel: 'Checking…',
    className: 'ai-btn ai-btn--secondary',
    toast: 'Spelling and grammar corrected.'
  },
  'simplify-client': {
    icon: '↓',
    label: 'Simplify for Client',
    loadingLabel: 'Simplifying…',
    className: 'ai-btn ai-btn--secondary',
    toast: 'Text simplified for client communication.'
  },
  formal: {
    icon: '§',
    label: 'Formal Version',
    loadingLabel: 'Formalising…',
    className: 'ai-btn ai-btn--secondary',
    toast: 'Text converted to formal language.'
  },
  'plain-english': {
    icon: '○',
    label: 'Plain English',
    loadingLabel: 'Simplifying…',
    className: 'ai-btn ai-btn--secondary',
    toast: 'Text converted to plain English.'
  }
};

// ── Primary modes shown by default ───────────────────────────
const PRIMARY_MODES   = ['professional', 'contract-protection'];
const SECONDARY_MODES = ['spell-grammar', 'simplify-client', 'formal', 'plain-english'];

/**
 * Inject AI rewrite buttons below a textarea field after engine.mount().
 *
 * @param {string}     fieldId  — SCHEMA field id (textarea fields only)
 * @param {AIWriter}   writer   — shared AIWriter instance
 * @param {FormEngine} engine   — current form engine (for state + context)
 * @param {Function}   track    — analytics tracker
 * @param {Function}   toastFn  — toast notification function
 * @param {string[]}   [modes]  — modes to show (default: all)
 */
export function injectAIAssist(fieldId, writer, engine, track, toastFn, modes = null) {
  const container = document.getElementById('form-container');
  const fieldWrap = container?.querySelector(`[data-field-id="${fieldId}"]`);
  if (!fieldWrap) return;

  const textarea = fieldWrap.querySelector('textarea');
  if (!textarea) return;

  const activePrimaryModes   = modes ? PRIMARY_MODES.filter(m => modes.includes(m))   : PRIMARY_MODES;
  const activeSecondaryModes = modes ? SECONDARY_MODES.filter(m => modes.includes(m)) : SECONDARY_MODES;

  // Primary button bar
  const bar = document.createElement('div');
  bar.className = 'ai-assist-bar';

  const primaryBtns = {};
  for (const mode of activePrimaryModes) {
    const cfg = AI_MODES[mode];
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = cfg.className;
    btn.setAttribute('aria-label', `${cfg.label} using AI`);
    btn.innerHTML = `<span class="ai-btn-icon" aria-hidden="true">${cfg.icon}</span> ${cfg.label}`;
    btn.addEventListener('click', () => handleAI(mode));
    bar.appendChild(btn);
    primaryBtns[mode] = btn;
  }

  // Secondary modes toggle
  let secondaryBar = null;
  let moreBtn      = null;

  if (activeSecondaryModes.length > 0) {
    moreBtn = document.createElement('button');
    moreBtn.type      = 'button';
    moreBtn.className = 'ai-btn ai-btn--more';
    moreBtn.innerHTML = '<span class="ai-btn-icon" aria-hidden="true">⋯</span> More';
    moreBtn.setAttribute('aria-expanded', 'false');
    bar.appendChild(moreBtn);

    secondaryBar = document.createElement('div');
    secondaryBar.className = 'ai-assist-bar ai-assist-bar--secondary';
    secondaryBar.hidden = true;

    const secondaryBtns = {};
    for (const mode of activeSecondaryModes) {
      const cfg = AI_MODES[mode];
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = cfg.className;
      btn.setAttribute('aria-label', `${cfg.label} using AI`);
      btn.innerHTML = `<span class="ai-btn-icon" aria-hidden="true">${cfg.icon}</span> ${cfg.label}`;
      btn.addEventListener('click', () => handleAI(mode));
      secondaryBar.appendChild(btn);
      secondaryBtns[mode] = btn;
    }

    moreBtn.addEventListener('click', () => {
      const isOpen = !secondaryBar.hidden;
      secondaryBar.hidden = isOpen;
      moreBtn.setAttribute('aria-expanded', String(!isOpen));
      moreBtn.innerHTML = isOpen
        ? '<span class="ai-btn-icon" aria-hidden="true">⋯</span> More'
        : '<span class="ai-btn-icon" aria-hidden="true">✕</span> Less';
    });
  }

  textarea.after(bar);
  if (secondaryBar) bar.after(secondaryBar);

  // Disclaimer shown after first successful rewrite
  function showDisclaimer() {
    if (fieldWrap.querySelector('.ai-disclaimer')) return;
    const d = document.createElement('p');
    d.className = 'ai-disclaimer';
    d.textContent = 'AI-assisted. Please review for accuracy before issuing.';
    const lastBar = secondaryBar || bar;
    lastBar.after(d);
  }

  function allButtons() {
    const btns = Object.values(primaryBtns);
    if (secondaryBar) {
      secondaryBar.querySelectorAll('.ai-btn').forEach(b => btns.push(b));
    }
    return btns;
  }

  async function handleAI(mode) {
    const text = textarea.value.trim();
    if (!text) {
      toastFn('Enter some text first, then click the AI button.');
      return;
    }
    if (!writer.hasKey()) {
      showAIKeyModal(writer, () => handleAI(mode), toastFn);
      return;
    }

    setLoading(true, mode);
    try {
      const state = engine.getState?.() || {};
      const rewritten = await writer.write(text, mode, {
        projectName: state.projectName,
        clientName:  state.clientName,
        toolName:    state.toolName
      });

      textarea.value = rewritten;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      showDisclaimer();
      track?.('ai_text_rewritten', { mode, field: fieldId });
      toastFn(AI_MODES[mode]?.toast || 'Text updated by AI.');

    } catch (err) {
      if (err.message === 'NO_KEY') {
        showAIKeyModal(writer, () => handleAI(mode), toastFn);
      } else if (err.message === 'INVALID_KEY') {
        writer.clearKey();
        toastFn('API key invalid — please re-enter it.');
        showAIKeyModal(writer, () => handleAI(mode), toastFn);
      } else {
        toastFn(`AI writing failed: ${err.message}`);
        console.error('[BIK AI]', err);
      }
    } finally {
      setLoading(false, mode);
    }
  }

  function setLoading(on, mode) {
    allButtons().forEach(b => { b.disabled = on; });
    if (on) {
      const cfg = AI_MODES[mode];
      const activeBtn = primaryBtns[mode] || secondaryBar?.querySelector(`[aria-label*="${AI_MODES[mode]?.label}"]`);
      if (activeBtn && cfg) {
        activeBtn.classList.add('loading');
        activeBtn.innerHTML = `<span class="ai-btn-icon" aria-hidden="true">${cfg.icon}</span> ${cfg.loadingLabel}`;
      }
    } else {
      for (const [m, btn] of Object.entries(primaryBtns)) {
        const cfg = AI_MODES[m];
        btn.classList.remove('loading');
        btn.innerHTML = `<span class="ai-btn-icon" aria-hidden="true">${cfg.icon}</span> ${cfg.label}`;
      }
      if (secondaryBar) {
        secondaryBar.querySelectorAll('.ai-btn').forEach(btn => {
          btn.classList.remove('loading');
        });
        // Re-set labels
        let idx = 0;
        for (const mode of activeSecondaryModes) {
          const cfg = AI_MODES[mode];
          const btn = secondaryBar.querySelectorAll('.ai-btn')[idx++];
          if (btn) btn.innerHTML = `<span class="ai-btn-icon" aria-hidden="true">${cfg.icon}</span> ${cfg.label}`;
        }
      }
    }
  }
}

/**
 * Show the AI API key setup modal.
 * Created once in the DOM; reused on subsequent calls.
 *
 * @param {AIWriter}      writer    — AIWriter instance
 * @param {Function|null} onSuccess — called after key is saved
 * @param {Function}      toastFn   — toast notification function
 */
export function showAIKeyModal(writer, onSuccess, toastFn) {
  let modal = document.getElementById('ai-key-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'ai-key-modal';
    modal.className = 'ai-key-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ai-modal-title');
    modal.innerHTML = `
      <div class="ai-key-modal-inner">
        <div class="ai-modal-header">
          <span class="ai-modal-icon" aria-hidden="true">&#10022;</span>
          <h2 class="ai-modal-title" id="ai-modal-title">AI Professional Writer Setup</h2>
        </div>
        <p class="ai-modal-body">
          The AI Writer uses Anthropic Claude to rewrite your text into professional,
          contract-ready Australian construction language. You supply your own Anthropic API key
          &mdash; it is stored only in this browser and never sent to BIK servers.
        </p>
        <div class="ai-modal-field">
          <label class="form-label" for="ai-key-input">Anthropic API key</label>
          <input type="password" class="form-input" id="ai-key-input"
            placeholder="sk-ant-api03-&hellip;"
            autocomplete="off" spellcheck="false" />
          <span class="field-hint">
            Get a key at
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
              console.anthropic.com/settings/keys</a>
            &mdash; typical cost is a few cents per rewrite.
          </span>
        </div>
        <div class="ai-modal-security">
          <span aria-hidden="true">&#128274;</span>
          Your key is stored only in this browser&rsquo;s local storage on this device.
          It is never transmitted to BIK Solutions servers.
        </div>
        <div class="ai-modal-actions">
          <button class="app-btn app-btn--ghost-dark" id="ai-modal-cancel" type="button">Cancel</button>
          <button class="app-btn app-btn--coral" id="ai-modal-save" type="button">Save key</button>
        </div>
        <div id="ai-modal-clear-wrap" class="ai-modal-clear-wrap" style="display:none">
          <button class="ai-modal-clear-btn" id="ai-modal-clear" type="button">
            Remove saved key from this device
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  const keyInput  = modal.querySelector('#ai-key-input');
  const saveBtn   = modal.querySelector('#ai-modal-save');
  const cancelBtn = modal.querySelector('#ai-modal-cancel');
  const clearBtn  = modal.querySelector('#ai-modal-clear');
  const clearWrap = modal.querySelector('#ai-modal-clear-wrap');

  clearWrap.style.display = writer.hasKey() ? '' : 'none';
  keyInput.value = '';

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  const newSave = saveBtn.cloneNode(true);
  saveBtn.replaceWith(newSave);
  newSave.addEventListener('click', () => {
    const k = keyInput.value.trim();
    if (!k.startsWith('sk-ant-')) {
      toastFn('That doesn\'t look right — Anthropic keys start with sk-ant-');
      keyInput.focus();
      return;
    }
    writer.setKey(k);
    clearWrap.style.display = '';
    closeModal();
    toastFn('API key saved. AI writing is ready to use.');
    onSuccess?.();
  });

  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);
  newCancel.addEventListener('click', closeModal);

  const newClear = clearBtn.cloneNode(true);
  clearBtn.replaceWith(newClear);
  newClear.addEventListener('click', () => {
    writer.clearKey();
    closeModal();
    toastFn('API key removed from this device.');
  });

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => keyInput?.focus(), 50);
}
