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
      if (err.message === 'PROXY_NOT_CONFIGURED') {
        toastFn('AI writing is not yet available — proxy setup required.');
        console.error('[BIK AI] PROXY_URL not configured in ai-writer.js');
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
 * showAIKeyModal — retired.
 * AI Writer now routes through the BIK proxy; no API key is required from users.
 * Kept as a no-op export so any tool that imports it does not break at runtime.
 */
export function showAIKeyModal() {
  console.warn('[BIK AI] showAIKeyModal() called but AI Writer now uses a server proxy. No action taken.');
}
