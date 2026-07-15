/**
 * Beta Banner + Feedback Widget
 * Injects the beta banner and feedback modal on all tool/dashboard pages.
 * Feedback is stored in localStorage under 'bik-beta-feedback'.
 *
 * Usage: <script type="module" src="./js/toolkit/beta-banner.js"></script>
 */

const BETA_VERSION     = '0.9';
const BETA_RELEASE     = '15 Jul 2026';
const FEEDBACK_KEY     = 'bik-beta-feedback';
const CHANGELOG_URL    = 'release-notes.html';

const CSS = `
.beta-banner {
  position: sticky;
  top: 0;
  z-index: 900;
  background: #1e1c1a;
  color: #e8e4de;
  font-family: inherit;
  font-size: 0.75rem;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 7px 16px;
  flex-wrap: wrap;
}
.beta-banner-badge {
  background: #D85A30;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 3px;
}
.beta-banner-text { color: #9c9893; }
.beta-banner-actions { display: flex; gap: 10px; align-items: center; margin-left: auto; }
.beta-banner-link {
  color: #b5b0a8;
  text-decoration: none;
  font-size: 0.72rem;
}
.beta-banner-link:hover { color: #e8e4de; }
.beta-banner-btn {
  background: transparent;
  border: 1px solid #3d3a36;
  color: #e8e4de;
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}
.beta-banner-btn:hover { background: #2e2b28; border-color: #5a5650; }

/* Trust footer */
#bik-trust-footer {
  border-top: 1px solid #dedad4;
  background: #f5f0e8;
  padding: 16px 24px;
  text-align: center;
}
#bik-trust-footer nav {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; margin-bottom: 8px;
}
#bik-trust-footer a {
  font-size: 0.72rem; color: #888780; text-decoration: none; font-family: inherit;
}
#bik-trust-footer a:hover { color: #D85A30; text-decoration: underline; }
#bik-trust-footer p {
  font-size: 0.68rem; color: #aaa9a6; margin: 0; font-family: inherit;
}

/* Feedback modal */
.feedback-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  opacity: 0; pointer-events: none; transition: opacity 0.2s;
}
.feedback-overlay.is-open { opacity: 1; pointer-events: auto; }
.feedback-modal {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.22);
  width: 100%; max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  font-family: inherit;
  transform: translateY(12px); transition: transform 0.2s;
}
.feedback-overlay.is-open .feedback-modal { transform: translateY(0); }
.feedback-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #eee;
}
.feedback-modal-title { font-size: 0.95rem; font-weight: 700; color: #252320; margin: 0; }
.feedback-modal-close {
  background: none; border: none; cursor: pointer;
  font-size: 1.1rem; color: #888; padding: 2px 6px; border-radius: 4px;
}
.feedback-modal-close:hover { background: #f0ede8; color: #252320; }
.feedback-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.fb-label { font-size: 0.78rem; font-weight: 600; color: #252320; margin-bottom: 6px; display: block; }
.fb-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.fb-type-btn {
  border: 1.5px solid #ddd; background: #fff; border-radius: 6px;
  padding: 9px 8px; font-size: 0.78rem; font-weight: 600; color: #555;
  cursor: pointer; text-align: center; transition: all 0.12s; font-family: inherit;
}
.fb-type-btn:hover { border-color: #D85A30; color: #D85A30; }
.fb-type-btn.selected { border-color: #D85A30; background: #fef5f2; color: #D85A30; }
.fb-textarea {
  width: 100%; border: 1.5px solid #ddd; border-radius: 6px;
  padding: 10px 12px; font-size: 0.82rem; font-family: inherit; resize: vertical;
  box-sizing: border-box; color: #252320;
  transition: border-color 0.15s;
}
.fb-textarea:focus { outline: none; border-color: #D85A30; }
.fb-rating-wrap { display: flex; gap: 6px; }
.fb-star {
  background: none; border: none; font-size: 1.4rem; cursor: pointer; padding: 2px;
  line-height: 1; color: #ddd; transition: color 0.1s; display: inline-block;
}
.fb-star.active, .fb-star:hover ~ .fb-star { }
.fb-star.active { color: #f5a623; }
.fb-recommend { display: flex; gap: 8px; }
.fb-rec-btn {
  flex: 1; border: 1.5px solid #ddd; background: #fff; border-radius: 6px;
  padding: 8px; font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all 0.12s; color: #555;
}
.fb-rec-btn:hover { border-color: #D85A30; color: #D85A30; }
.fb-rec-btn.selected { border-color: #D85A30; background: #fef5f2; color: #D85A30; }
.fb-time-select {
  width: 100%; border: 1.5px solid #ddd; border-radius: 6px;
  padding: 9px 12px; font-size: 0.82rem; font-family: inherit; color: #252320;
  background: #fff; appearance: none; cursor: pointer; box-sizing: border-box;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
}
.fb-submit-btn {
  background: #D85A30; color: #fff; border: none; border-radius: 6px;
  padding: 11px 20px; font-size: 0.85rem; font-weight: 700; cursor: pointer;
  font-family: inherit; width: 100%; transition: background 0.15s;
}
.fb-submit-btn:hover { background: #c04e28; }
.fb-success {
  text-align: center; padding: 32px 20px;
  display: none; flex-direction: column; align-items: center; gap: 10px;
}
.fb-success-icon { font-size: 2.5rem; }
.fb-success-title { font-size: 1rem; font-weight: 700; color: #252320; }
.fb-success-msg { font-size: 0.82rem; color: #888; }
`;

function injectCSS() {
  if (document.getElementById('bik-beta-css')) return;
  const style = document.createElement('style');
  style.id = 'bik-beta-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function createBanner() {
  const banner = document.createElement('div');
  banner.className = 'beta-banner';
  banner.setAttribute('role', 'banner');
  banner.setAttribute('aria-label', 'Beta version notice');
  banner.innerHTML = `
    <span class="beta-banner-badge">Beta</span>
    <span class="beta-banner-text">Version ${BETA_VERSION} — Released ${BETA_RELEASE}</span>
    <div class="beta-banner-actions">
      <a href="${CHANGELOG_URL}" class="beta-banner-link">Release notes</a>
      <button type="button" class="beta-banner-btn" id="btn-beta-feedback">
        Leave feedback
      </button>
    </div>`;
  return banner;
}

function createFeedbackModal() {
  const overlay = document.createElement('div');
  overlay.className = 'feedback-overlay';
  overlay.id = 'feedback-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Beta feedback');
  overlay.innerHTML = `
    <div class="feedback-modal" id="feedback-modal">
      <div class="feedback-modal-header">
        <h2 class="feedback-modal-title">Share your feedback</h2>
        <button type="button" class="feedback-modal-close" id="btn-feedback-close" aria-label="Close">✕</button>
      </div>
      <div class="feedback-modal-body" id="feedback-form">
        <div>
          <label class="fb-label">What type of feedback?</label>
          <div class="fb-type-grid">
            <button type="button" class="fb-type-btn" data-type="bug">🐛 Bug report</button>
            <button type="button" class="fb-type-btn" data-type="idea">💡 Idea</button>
            <button type="button" class="fb-type-btn" data-type="feature">⭐ Feature request</button>
            <button type="button" class="fb-type-btn" data-type="other">💬 Other</button>
          </div>
        </div>
        <div>
          <label class="fb-label" for="fb-message">Tell us more</label>
          <textarea class="fb-textarea" id="fb-message" rows="4"
            placeholder="What did you notice? What would make this better?"></textarea>
        </div>
        <div>
          <label class="fb-label">Overall rating</label>
          <div class="fb-rating-wrap" id="fb-rating" aria-label="Rating 1 to 5 stars">
            <button type="button" class="fb-star" data-rating="1" aria-label="1 star">★</button>
            <button type="button" class="fb-star" data-rating="2" aria-label="2 stars">★</button>
            <button type="button" class="fb-star" data-rating="3" aria-label="3 stars">★</button>
            <button type="button" class="fb-star" data-rating="4" aria-label="4 stars">★</button>
            <button type="button" class="fb-star" data-rating="5" aria-label="5 stars">★</button>
          </div>
        </div>
        <div>
          <label class="fb-label" for="fb-time">Roughly how much time did this save you?</label>
          <select class="fb-time-select" id="fb-time">
            <option value="">Select…</option>
            <option value="<5min">Less than 5 minutes</option>
            <option value="5-15min">5–15 minutes</option>
            <option value="15-30min">15–30 minutes</option>
            <option value="30-60min">30–60 minutes</option>
            <option value=">60min">More than an hour</option>
            <option value="unsure">Not sure yet</option>
          </select>
        </div>
        <div>
          <label class="fb-label">Would you recommend BIK Toolkit to another builder?</label>
          <div class="fb-recommend">
            <button type="button" class="fb-rec-btn" data-rec="yes">👍 Yes</button>
            <button type="button" class="fb-rec-btn" data-rec="maybe">🤔 Maybe</button>
            <button type="button" class="fb-rec-btn" data-rec="no">👎 Not yet</button>
          </div>
        </div>
        <button type="button" class="fb-submit-btn" id="btn-feedback-submit">Submit feedback</button>
      </div>
      <div class="fb-success" id="feedback-success">
        <div class="fb-success-icon">🙏</div>
        <div class="fb-success-title">Thanks for your feedback!</div>
        <div class="fb-success-msg">Your response has been saved on this device. It helps us build a better product for Australian builders.</div>
      </div>
    </div>`;
  return overlay;
}

function wireFeedbackModal(overlay) {
  let selectedType   = null;
  let selectedRating = 0;
  let selectedRec    = null;

  const close = () => overlay.classList.remove('is-open');

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('btn-feedback-close').addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });

  // Type buttons
  overlay.querySelectorAll('.fb-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.fb-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedType = btn.dataset.type;
    });
  });

  // Star rating
  const stars = overlay.querySelectorAll('.fb-star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.rating, 10);
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.rating, 10) <= selectedRating);
      });
    });
  });

  // Recommend buttons
  overlay.querySelectorAll('.fb-rec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.fb-rec-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedRec = btn.dataset.rec;
    });
  });

  // Submit
  document.getElementById('btn-feedback-submit').addEventListener('click', () => {
    const message = document.getElementById('fb-message').value.trim();
    const timeSaved = document.getElementById('fb-time').value;

    const entry = {
      ts:          Date.now(),
      page:        location.pathname.split('/').pop() || 'index.html',
      type:        selectedType,
      message,
      rating:      selectedRating || null,
      timeSaved:   timeSaved || null,
      recommend:   selectedRec
    };

    try {
      const existing = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
      existing.push(entry);
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing));
    } catch (_) {}

    document.getElementById('feedback-form').style.display = 'none';
    const success = document.getElementById('feedback-success');
    success.style.display = 'flex';
    setTimeout(close, 3000);
  });
}

function resetFeedbackForm(overlay) {
  overlay.querySelectorAll('.fb-type-btn').forEach(b => b.classList.remove('selected'));
  overlay.querySelectorAll('.fb-star').forEach(s => s.classList.remove('active'));
  overlay.querySelectorAll('.fb-rec-btn').forEach(b => b.classList.remove('selected'));
  const msg = document.getElementById('fb-message');
  if (msg) msg.value = '';
  const time = document.getElementById('fb-time');
  if (time) time.value = '';
  const form = document.getElementById('feedback-form');
  if (form) form.style.display = '';
  const success = document.getElementById('feedback-success');
  if (success) success.style.display = 'none';
}

function init() {
  injectCSS();

  const banner  = createBanner();
  const overlay = createFeedbackModal();
  document.body.prepend(overlay);

  // Insert banner before .app-shell or .dash-shell, or at top of body
  const shell = document.querySelector('.app-shell, .dash-shell');
  if (shell) {
    document.body.insertBefore(banner, shell);
  } else {
    document.body.prepend(banner);
  }

  wireFeedbackModal(overlay);

  document.getElementById('btn-beta-feedback').addEventListener('click', () => {
    resetFeedbackForm(overlay);
    overlay.classList.add('is-open');
    document.getElementById('fb-message')?.focus();
  });

  // Inject trust footer after app-shell or dash-shell
  const appShell = document.querySelector('.app-shell, .dash-shell');
  if (appShell && !document.getElementById('bik-trust-footer')) {
    const footer = document.createElement('footer');
    footer.id = 'bik-trust-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.innerHTML = `
      <nav aria-label="Legal and support links">
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="terms-of-use.html">Terms of Use</a>
        <a href="ai-usage-notice.html">AI Usage Notice</a>
        <a href="support.html">Support</a>
        <a href="release-notes.html">Release Notes</a>
      </nav>
      <p>&copy; 2026 BIK Solutions Pty Ltd &nbsp;·&nbsp; v${BETA_VERSION} Beta &nbsp;·&nbsp; All data stored on this device only</p>`;
    appShell.after(footer);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
