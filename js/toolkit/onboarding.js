/**
 * BIK Onboarding Wizard
 *
 * A 3-step guided setup modal that appears the first time a builder
 * visits the dashboard with no profile and no projects.
 *
 * Step 1 — Business details (profile setup)
 * Step 2 — Create first project
 * Step 3 — You're ready! (celebration + CTA to first tool)
 *
 * Stores completion state in 'bik-onboarding-complete'.
 * Exports checkAndInit() — call once from the dashboard script.
 */

const COMPLETE_KEY = 'bik-onboarding-complete';
const PROFILE_KEY  = 'bik-builder-profile';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

const SOFTWARE_OPTIONS = [
  { value: 'xero',       label: 'Xero' },
  { value: 'myob',       label: 'MYOB' },
  { value: 'buildxact',  label: 'Buildxact' },
  { value: 'servicem8',  label: 'ServiceM8' },
  { value: 'aroflo',     label: 'AroFlo' },
  { value: 'none',       label: 'None / spreadsheets' }
];

// ── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
.ob-overlay {
  position: fixed; inset: 0; z-index: 9900;
  background: rgba(37,35,32,0.72);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: ob-fade-in 0.25s ease;
}
@keyframes ob-fade-in { from { opacity:0 } to { opacity:1 } }

.ob-modal {
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 520px;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0,0,0,0.28);
  display: flex;
  flex-direction: column;
}

.ob-header {
  padding: 28px 28px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ob-logo-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ob-logo-mark {
  width: 36px; height: 36px;
  background: #252320;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 900; font-size: 1.05rem;
  flex-shrink: 0;
}

.ob-logo-text {
  font-size: 0.78rem;
  font-weight: 700;
  color: #888;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ob-skip-btn {
  background: none; border: none; cursor: pointer;
  font-size: 0.75rem; color: #aaa; padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
}
.ob-skip-btn:hover { color: #666; background: #f5f0e8; }

.ob-progress {
  padding: 20px 28px 0;
  display: flex;
  gap: 6px;
}

.ob-step-dot {
  flex: 1; height: 3px; border-radius: 2px;
  background: #e8e4de;
  transition: background 0.3s;
}
.ob-step-dot.active { background: #D85A30; }
.ob-step-dot.done   { background: #2b9e3f; }

.ob-step-label {
  padding: 8px 28px 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #D85A30;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ob-body {
  padding: 16px 28px 24px;
  flex: 1;
}

.ob-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #252320;
  margin-bottom: 6px;
  line-height: 1.2;
}

.ob-sub {
  font-size: 0.84rem;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.6;
}

.ob-field { margin-bottom: 14px; }

.ob-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: #252320;
  margin-bottom: 5px;
}

.ob-label .ob-opt {
  font-weight: 400;
  color: #aaa;
  margin-left: 4px;
}

.ob-input, .ob-select {
  width: 100%;
  border: 1.5px solid #ddd;
  border-radius: 7px;
  padding: 9px 12px;
  font-size: 0.88rem;
  font-family: inherit;
  color: #252320;
  background: #fff;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ob-input:focus, .ob-select:focus {
  outline: none;
  border-color: #D85A30;
}
.ob-input.ob-error { border-color: #c0392b; }

.ob-error-msg {
  font-size: 0.75rem;
  color: #c0392b;
  margin-top: 4px;
  display: none;
}
.ob-error-msg.visible { display: block; }

.ob-radio-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ob-radio-btn {
  flex: 1;
  min-width: 90px;
  border: 1.5px solid #ddd;
  border-radius: 7px;
  padding: 9px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #555;
  background: #fff;
  cursor: pointer;
  text-align: center;
  transition: all 0.12s;
  font-family: inherit;
}
.ob-radio-btn:hover { border-color: #D85A30; color: #D85A30; }
.ob-radio-btn.selected { border-color: #D85A30; background: #fef5f2; color: #D85A30; }

.ob-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ob-checkbox-btn {
  border: 1.5px solid #ddd;
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #555;
  background: #fff;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
}
.ob-checkbox-btn:hover { border-color: #888; }
.ob-checkbox-btn.selected { border-color: #252320; background: #f5f0e8; color: #252320; font-weight: 600; }

.ob-footer {
  padding: 0 28px 28px;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
}

.ob-btn-primary {
  background: #D85A30;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 11px 24px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
  min-width: 130px;
}
.ob-btn-primary:hover { background: #c04e28; }

.ob-btn-back {
  background: none;
  border: 1.5px solid #ddd;
  border-radius: 7px;
  padding: 10px 18px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.ob-btn-back:hover { border-color: #888; color: #252320; }

/* Step 3 — celebration */
.ob-celebrate {
  text-align: center;
  padding: 8px 0 24px;
}

.ob-celebrate-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  display: block;
  animation: ob-bounce 0.6s ease;
}

@keyframes ob-bounce {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}

.ob-celebrate-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #252320;
  margin-bottom: 10px;
}

.ob-celebrate-body {
  font-size: 0.88rem;
  color: #555;
  line-height: 1.7;
  margin-bottom: 24px;
  max-width: 380px;
  margin-inline: auto;
}

.ob-celebrate-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.ob-celebrate-actions .ob-btn-primary {
  width: 100%;
  max-width: 280px;
  padding: 13px 24px;
  font-size: 0.92rem;
}

.ob-celebrate-skip {
  font-size: 0.8rem;
  color: #aaa;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.ob-celebrate-skip:hover { color: #666; }

/* two-col grid for fields */
.ob-field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}
.ob-field-grid .ob-field { margin-bottom: 14px; }
.ob-field-grid .ob-field--full { grid-column: 1 / -1; }

@media (max-width: 480px) {
  .ob-modal { border-radius: 10px; }
  .ob-header { padding: 20px 20px 0; }
  .ob-progress { padding: 16px 20px 0; }
  .ob-step-label { padding: 8px 20px 0; }
  .ob-body { padding: 14px 20px 20px; }
  .ob-footer { padding: 0 20px 24px; }
  .ob-field-grid { grid-template-columns: 1fr; }
  .ob-field-grid .ob-field--full { grid-column: 1; }
}
`;

// ── HTML Builders ──────────────────────────────────────────────────────────

function buildStep1HTML() {
  const stateOptions = AU_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
  const swOpts = SOFTWARE_OPTIONS.map(o =>
    `<button type="button" class="ob-checkbox-btn" data-sw="${o.value}">${o.label}</button>`
  ).join('');

  return `
    <div class="ob-step-label">Step 1 of 3 — Your Business</div>
    <div class="ob-body">
      <h2 class="ob-title">Tell us about your business</h2>
      <p class="ob-sub">This fills your details across every document — you only enter it once.</p>

      <div class="ob-field-grid">
        <div class="ob-field ob-field--full">
          <label class="ob-label" for="ob-builderName">Business name <span class="ob-opt">(required)</span></label>
          <input class="ob-input" id="ob-builderName" type="text" placeholder="e.g. Smith Building Pty Ltd" autocomplete="organization" />
          <div class="ob-error-msg" id="ob-err-name">Please enter your business name.</div>
        </div>

        <div class="ob-field">
          <label class="ob-label">Builder type</label>
          <div class="ob-radio-group">
            <button type="button" class="ob-radio-btn" data-type="residential">Residential</button>
            <button type="button" class="ob-radio-btn" data-type="commercial">Commercial</button>
            <button type="button" class="ob-radio-btn" data-type="both">Both</button>
          </div>
        </div>

        <div class="ob-field">
          <label class="ob-label" for="ob-state">State / Territory</label>
          <select class="ob-select" id="ob-state">
            <option value="">Select state…</option>
            ${stateOptions}
          </select>
        </div>

        <div class="ob-field">
          <label class="ob-label" for="ob-abn">ABN <span class="ob-opt">(optional)</span></label>
          <input class="ob-input" id="ob-abn" type="text" placeholder="12 345 678 901" />
        </div>

        <div class="ob-field">
          <label class="ob-label" for="ob-licence">Licence number <span class="ob-opt">(optional)</span></label>
          <input class="ob-input" id="ob-licence" type="text" placeholder="e.g. QBCC 1234567" />
        </div>

        <div class="ob-field">
          <label class="ob-label">GST registered?</label>
          <div class="ob-radio-group">
            <button type="button" class="ob-radio-btn" data-gst="yes">Yes</button>
            <button type="button" class="ob-radio-btn" data-gst="no">No</button>
          </div>
        </div>

        <div class="ob-field ob-field--full">
          <label class="ob-label">Existing software <span class="ob-opt">(select all that apply)</span></label>
          <div class="ob-checkbox-group">${swOpts}</div>
        </div>
      </div>
    </div>
  `;
}

function buildStep2HTML() {
  return `
    <div class="ob-step-label">Step 2 of 3 — First Project</div>
    <div class="ob-body">
      <h2 class="ob-title">Create your first project</h2>
      <p class="ob-sub">BIK connects all your documents to a project so you can see the full picture at a glance.</p>

      <div class="ob-field">
        <label class="ob-label" for="ob-projName">Project name <span class="ob-opt">(required)</span></label>
        <input class="ob-input" id="ob-projName" type="text" placeholder="e.g. Johnson Renovation — Paddington" autocomplete="off" />
        <div class="ob-error-msg" id="ob-err-proj">Please enter a project name.</div>
      </div>

      <div class="ob-field">
        <label class="ob-label" for="ob-clientName">Client name <span class="ob-opt">(optional)</span></label>
        <input class="ob-input" id="ob-clientName" type="text" placeholder="John & Jane Johnson" autocomplete="name" />
      </div>

      <div class="ob-field">
        <label class="ob-label" for="ob-siteAddress">Site address <span class="ob-opt">(optional)</span></label>
        <input class="ob-input" id="ob-siteAddress" type="text" placeholder="123 Example Street, Brisbane QLD 4000" autocomplete="street-address" />
      </div>
    </div>
  `;
}

function buildStep3HTML(builderName, projectName) {
  const name = builderName ? builderName.split(' ')[0] : 'builder';
  const proj = projectName || 'your project';
  return `
    <div class="ob-body ob-celebrate">
      <span class="ob-celebrate-icon">🏗️</span>
      <h2 class="ob-celebrate-title">You're ready to build, ${name}!</h2>
      <p class="ob-celebrate-body">
        Your profile is set up and <strong>${proj}</strong> is live in your dashboard.
        BIK will now track health, activity, and smart actions for this project automatically.
      </p>
      <div class="ob-celebrate-actions">
        <a href="quote-builder.html" class="ob-btn-primary">Generate your first quote →</a>
        <button type="button" class="ob-celebrate-skip" id="ob-go-dash">Take me to the dashboard</button>
      </div>
    </div>
  `;
}

// ── State ──────────────────────────────────────────────────────────────────

let currentStep = 1;
let selectedType = '';
let selectedGST  = '';
let selectedSoftware = new Set();
let createdProjectId = null;
let builderNameVal   = '';
let projectNameVal   = '';

// ── Utilities ──────────────────────────────────────────────────────────────

function injectCSS() {
  if (document.getElementById('ob-css')) return;
  const s = document.createElement('style');
  s.id = 'ob-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function updateProgress() {
  document.querySelectorAll('.ob-step-dot').forEach((dot, i) => {
    dot.classList.toggle('done',   i + 1 < currentStep);
    dot.classList.toggle('active', i + 1 === currentStep);
  });
}

function showError(id, show) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('visible', show);
}

// ── Step handlers ──────────────────────────────────────────────────────────

function step1Advance(overlay, projectStore) {
  const name = document.getElementById('ob-builderName')?.value?.trim() || '';
  if (!name) { showError('ob-err-name', true); document.getElementById('ob-builderName')?.focus(); return; }
  showError('ob-err-name', false);

  builderNameVal = name;

  const profile = {
    builderName:        name,
    builderABN:         document.getElementById('ob-abn')?.value?.trim() || '',
    builderLicence:     document.getElementById('ob-licence')?.value?.trim() || '',
    builderPhone:       '',
    builderEmail:       '',
    builderAddress:     '',
    builderApprovalName: name,
    _builderType:       selectedType,
    _state:             document.getElementById('ob-state')?.value || '',
    _gst:               selectedGST,
    _software:          [...selectedSoftware]
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  currentStep = 2;
  renderStep(overlay, projectStore);
}

function step2Advance(overlay, projectStore) {
  const projName = document.getElementById('ob-projName')?.value?.trim() || '';
  if (!projName) { showError('ob-err-proj', true); document.getElementById('ob-projName')?.focus(); return; }
  showError('ob-err-proj', false);
  projectNameVal = projName;

  const now = new Date().toISOString();
  const project = {
    id:            'proj-' + Date.now(),
    name:          projName,
    status:        'active',
    clientName:    document.getElementById('ob-clientName')?.value?.trim() || '',
    clientEmail:   '',
    clientPhone:   '',
    projectName:   projName,
    siteAddress:   document.getElementById('ob-siteAddress')?.value?.trim() || '',
    contractRef:   '',
    contractValue: null,
    notes:         '',
    createdAt:     now,
    updatedAt:     now
  };

  // Save to projectStore
  if (projectStore) {
    try { projectStore.create(project); } catch (_) {
      // Fallback: write directly
      const key = 'bik-projects';
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift(project);
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (_) {}
    }
  }
  createdProjectId = project.id;

  currentStep = 3;
  renderStep(overlay, projectStore);
}

function finish(overlay) {
  localStorage.setItem(COMPLETE_KEY, '1');
  overlay.remove();
  // Trigger dashboard re-render if available
  if (typeof window.bikRenderAll === 'function') window.bikRenderAll();
  else location.reload();
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderStep(overlay, projectStore) {
  const modal = overlay.querySelector('.ob-modal');
  if (!modal) return;

  // Keep header + progress; replace step content
  const existing = modal.querySelector('.ob-step-dynamic');
  if (existing) existing.remove();

  updateProgress();

  const wrapper = document.createElement('div');
  wrapper.className = 'ob-step-dynamic';

  if (currentStep === 1) {
    wrapper.innerHTML = buildStep1HTML();
    wrapper.innerHTML += `
      <div class="ob-footer">
        <span></span>
        <button type="button" class="ob-btn-primary" id="ob-btn-next">Continue →</button>
      </div>
    `;
    modal.appendChild(wrapper);
    wireStep1(overlay, projectStore);

  } else if (currentStep === 2) {
    wrapper.innerHTML = buildStep2HTML();
    wrapper.innerHTML += `
      <div class="ob-footer">
        <button type="button" class="ob-btn-back" id="ob-btn-back">← Back</button>
        <button type="button" class="ob-btn-primary" id="ob-btn-next">Create project →</button>
      </div>
    `;
    modal.appendChild(wrapper);
    wireStep2(overlay, projectStore);

  } else if (currentStep === 3) {
    wrapper.innerHTML = buildStep3HTML(builderNameVal, projectNameVal);
    modal.appendChild(wrapper);
    wireStep3(overlay);
    fireCelebration();
  }

  modal.scrollTop = 0;
}

function wireStep1(overlay, projectStore) {
  // Type buttons
  overlay.querySelectorAll('.ob-radio-btn[data-type]').forEach(btn => {
    if (btn.dataset.type === selectedType) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      overlay.querySelectorAll('.ob-radio-btn[data-type]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // GST buttons
  overlay.querySelectorAll('.ob-radio-btn[data-gst]').forEach(btn => {
    if (btn.dataset.gst === selectedGST) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      selectedGST = btn.dataset.gst;
      overlay.querySelectorAll('.ob-radio-btn[data-gst]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Software checkboxes
  overlay.querySelectorAll('.ob-checkbox-btn[data-sw]').forEach(btn => {
    if (selectedSoftware.has(btn.dataset.sw)) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      const v = btn.dataset.sw;
      if (selectedSoftware.has(v)) { selectedSoftware.delete(v); btn.classList.remove('selected'); }
      else { selectedSoftware.add(v); btn.classList.add('selected'); }
    });
  });

  // Name error clear
  const nameInput = document.getElementById('ob-builderName');
  if (nameInput) nameInput.addEventListener('input', () => showError('ob-err-name', false));

  document.getElementById('ob-btn-next')?.addEventListener('click', () => step1Advance(overlay, projectStore));
}

function wireStep2(overlay, projectStore) {
  document.getElementById('ob-btn-back')?.addEventListener('click', () => { currentStep = 1; renderStep(overlay, projectStore); });
  document.getElementById('ob-projName')?.addEventListener('input', () => showError('ob-err-proj', false));
  document.getElementById('ob-btn-next')?.addEventListener('click', () => step2Advance(overlay, projectStore));
}

function wireStep3(overlay) {
  document.getElementById('ob-go-dash')?.addEventListener('click', () => finish(overlay));
}

// ── Celebration confetti ───────────────────────────────────────────────────

function fireCelebration() {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const COLOURS = ['#D85A30','#252320','#2b9e3f','#f5a623','#2c7dd4'];
  const pieces  = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    w: 6 + Math.random() * 8,
    h: 10 + Math.random() * 6,
    r: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 4,
    vr: (Math.random() - 0.5) * 0.15,
    c: COLOURS[Math.floor(Math.random() * COLOURS.length)]
  }));
  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (frame < 80) requestAnimationFrame(tick);
    else canvas.remove();
  }
  requestAnimationFrame(tick);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if the onboarding wizard should be shown. If so, inject and show it.
 *
 * @param {Object} projectStore   — BIK project store instance
 * @param {boolean} [force=false] — show even if already completed (for testing)
 */
export function checkAndInit(projectStore, force = false) {
  const completed = localStorage.getItem(COMPLETE_KEY) === '1';
  if (completed && !force) return;

  // Only show if no existing projects (real user data shouldn't be disrupted)
  if (!force) {
    const hasProjects = typeof projectStore?.list === 'function' && projectStore.list().length > 0;
    if (hasProjects) return;
  }

  injectCSS();
  currentStep      = 1;
  selectedType     = '';
  selectedGST      = '';
  selectedSoftware = new Set();
  createdProjectId = null;
  builderNameVal   = '';
  projectNameVal   = '';

  const overlay = document.createElement('div');
  overlay.className = 'ob-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'BIK onboarding wizard');

  overlay.innerHTML = `
    <div class="ob-modal">
      <div class="ob-header">
        <div class="ob-logo-row">
          <div class="ob-logo-mark">B</div>
          <div class="ob-logo-text">BIK Business Toolkit</div>
        </div>
        <button type="button" class="ob-skip-btn" id="ob-skip">Skip setup</button>
      </div>
      <div class="ob-progress">
        <div class="ob-step-dot active"></div>
        <div class="ob-step-dot"></div>
        <div class="ob-step-dot"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#ob-skip')?.addEventListener('click', () => {
    localStorage.setItem(COMPLETE_KEY, '1');
    overlay.remove();
  });

  renderStep(overlay, projectStore);
}

/**
 * Mark onboarding as complete (e.g. after demo mode discard).
 */
export function markComplete() {
  localStorage.setItem(COMPLETE_KEY, '1');
}
