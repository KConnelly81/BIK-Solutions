/**
 * BIK Field — shared app-shell utilities.
 *
 * Every screen imports what it needs from here rather than each
 * reimplementing header markup, the offline banner, or session-expired
 * handling — the three tool screens (Attendance, Variation Notice,
 * Progress Claim) and the dashboard/project screens all share this.
 *
 * Capacitor plugins (@capacitor/network, @capacitor/geolocation,
 * @capacitor/camera) are loaded from the `Capacitor` global they attach
 * to `window` at runtime inside the native shell. In a plain desktop
 * browser (e.g. `npm run serve` during development) that global is
 * absent — every function here degrades to a web fallback (navigator.onLine,
 * the browser Geolocation API, an <input type=file capture> for camera)
 * so screens are also testable without a device. See TEST_PLAN.md.
 */

// ── Icons (inline SVG, no icon font/network dependency) ──────────────
export const ICONS = {
  attendance: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  variation: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  claim: '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
  signout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  cloudOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.88 9.1A5 5 0 0 1 18 9a5 5 0 0 1 1 9.9"/><path d="M5 5a5 5 0 0 1 7.2 6.2"/><path d="M9.5 18H4a4 4 0 0 1-2-7.5"/></svg>',
};

export function $(id) { return document.getElementById(id); }

export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

/** Reads ?project= from the URL, same convention as the web app. */
export function getProjectIdFromUrl() {
  return new URLSearchParams(location.search).get('project');
}

/**
 * Renders the shared header. `back` is a URL string (omit on the
 * dashboard, the app's root screen) or null.
 */
export function renderHeader({ title, sub, back, action } = {}) {
  const header = document.createElement('header');
  header.className = 'bf-header';
  header.innerHTML = `
    ${back ? `<a class="bf-header-back" href="${back}" aria-label="Back">${ICONS.back}</a>` : ''}
    <div class="bf-header-titles">
      <div class="bf-header-title">${escapeHtml(title || 'BIK Field')}</div>
      ${sub ? `<div class="bf-header-sub">${escapeHtml(sub)}</div>` : ''}
    </div>
    ${action ? `<button type="button" class="bf-header-action" id="bf-header-action-btn" aria-label="${escapeHtml(action.label)}">${action.icon}</button>` : ''}
  `;
  document.body.prepend(header);
  if (action) header.querySelector('#bf-header-action-btn').addEventListener('click', action.onClick);
  return header;
}

/** Renders the bottom tab bar. `active` is one of 'attendance'|'variation'|'claim'. */
export function renderTabBar({ projectId, active }) {
  const tabs = [
    { key: 'attendance', label: 'Attendance', href: `attendance.html?project=${encodeURIComponent(projectId)}`, icon: ICONS.attendance },
    { key: 'variation', label: 'Variations', href: `variation-notice.html?project=${encodeURIComponent(projectId)}`, icon: ICONS.variation },
    { key: 'claim', label: 'Claims', href: `progress-claim.html?project=${encodeURIComponent(projectId)}`, icon: ICONS.claim },
  ];
  const bar = document.createElement('nav');
  bar.className = 'bf-tabbar';
  bar.innerHTML = tabs.map(t => `
    <a class="bf-tab${t.key === active ? ' active' : ''}" href="${t.href}">
      <span class="bf-tab-icon">${t.icon}</span>
      <span class="bf-tab-label">${t.label}</span>
    </a>
  `).join('');
  document.body.appendChild(bar);
  return bar;
}

export function renderLoadingState(container, text = 'Loading…') {
  container.innerHTML = `
    <div class="bf-state">
      <div class="bf-spinner"></div>
      <p class="bf-state-body">${escapeHtml(text)}</p>
    </div>
  `;
}

export function renderErrorState(container, { title = 'Something went wrong', body, retry } = {}) {
  container.innerHTML = `
    <div class="bf-state">
      <div class="bf-state-icon">${ICONS.cloudOff}</div>
      <div class="bf-state-title">${escapeHtml(title)}</div>
      <p class="bf-state-body">${escapeHtml(body || 'Please try again.')}</p>
      ${retry ? '<button type="button" class="bf-btn bf-btn--sm" id="bf-state-retry-btn" style="margin-top:8px;">Try again</button>' : ''}
    </div>
  `;
  if (retry) container.querySelector('#bf-state-retry-btn').addEventListener('click', retry);
}

/**
 * Redirects to signin.html?redirect=<current page> when a Supabase call
 * fails with an auth/JWT error — the standard "session expired" case.
 * Screens should call this from their catch block rather than showing a
 * raw error, so a lapsed session always recovers to a fresh sign-in
 * (which returns the user to exactly where they were) instead of a dead
 * error screen.
 */
export function isSessionExpiredError(error) {
  const message = error?.message || String(error || '');
  return /JWT|refresh_token|invalid.*token|session.*expired|Authentication required/i.test(message);
}

export function redirectToSignInPreservingReturn() {
  const returnTo = location.pathname.replace(/^.*\//, '') + location.search;
  location.replace(`signin.html?redirect=${encodeURIComponent(returnTo)}`);
}

// ── Network status (offline banner) ──────────────────────────────────
// @capacitor/network gives real connectivity state on-device (WiFi/cell/
// none), including cases navigator.onLine gets wrong (e.g. connected to a
// WiFi network with no internet). Falls back to navigator.onLine in a
// plain browser so `npm run serve` still shows a reasonable offline state.
export async function initOfflineBanner() {
  const bar = document.createElement('div');
  bar.className = 'bf-offline-bar';
  bar.textContent = 'You’re offline — changes can’t be saved right now.';
  bar.hidden = true;
  document.body.appendChild(bar);

  function setOnline(online) { bar.hidden = online; }

  const Network = window.Capacitor?.Plugins?.Network;
  if (Network) {
    const status = await Network.getStatus();
    setOnline(status.connected);
    Network.addListener('networkStatusChange', (status) => setOnline(status.connected));
  } else {
    setOnline(navigator.onLine);
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    // Backstop: the browser's online/offline events are not reliably
    // dispatched in every embedding context (confirmed in testing —
    // Chromium under devtools-protocol network emulation updates
    // navigator.onLine but does not always fire the offline event).
    // A cheap poll means the banner still corrects itself within a few
    // seconds even if the event never arrives, in either direction.
    setInterval(() => setOnline(navigator.onLine), 3000);
  }
}

export async function isOnline() {
  const Network = window.Capacitor?.Plugins?.Network;
  if (Network) return (await Network.getStatus()).connected;
  return navigator.onLine;
}

// ── Geolocation (Attendance check-in/out) ─────────────────────────────
/**
 * Requests a single current-position reading. Returns
 * { latitude, longitude, accuracy } on success, or
 * { error: 'denied' | 'unavailable' | 'timeout' } — callers render one of
 * three states (captured / denied / unavailable) from this, never throw
 * a raw geolocation error at the user. A denied/unavailable result is not
 * fatal to check-in: the record just saves without a location, same as
 * every check-in before this feature existed.
 */
export async function getCurrentLocationSafe() {
  const Geolocation = window.Capacitor?.Plugins?.Geolocation;
  try {
    if (Geolocation) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'denied') return { error: 'denied' };
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
    }
    // Web fallback (dev server / desktop testing).
    if (!navigator.geolocation) return { error: 'unavailable' };
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => resolve({ error: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  } catch (err) {
    const message = String(err?.message || err || '');
    if (/denied/i.test(message)) return { error: 'denied' };
    return { error: 'unavailable' };
  }
}

// ── Camera (Variation Notice photo attachment) ────────────────────────
/**
 * Opens the native camera/photo-library prompt and returns a
 * { base64, format } image, or null if the user cancelled — cancelling
 * is a normal, silent outcome, not an error state. Throws only for a
 * genuine device/permission failure, which the caller should turn into
 * a friendly denied-state banner (see variation-notice.html).
 */
export async function capturePhotoSafe() {
  const Camera = window.Capacitor?.Plugins?.Camera;
  if (Camera) {
    const photo = await Camera.getPhoto({
      quality: 70,
      allowEditing: false,
      resultType: 'base64',
      source: 'PROMPT', // lets the user choose Camera vs Photo Library
    });
    return { base64: photo.base64String, format: photo.format || 'jpeg' };
  }
  // Web fallback: a hidden <input type=file accept=image capture>.
  return await new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: String(reader.result).split(',')[1], format: file.type.split('/')[1] || 'jpeg' });
      reader.onerror = () => reject(new Error('Could not read the selected photo.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
