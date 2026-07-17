/**
 * Check-in token manager.
 *
 * Separates public QR URLs from internal project IDs.
 * Each project gets one public token — a 128-bit cryptographically
 * random hex string — stored in bik-checkin-tokens.
 *
 * The token encodes nothing about the project; it is only a lookup key.
 * The check-in page sees only { projectName, siteAddress } — never the
 * internal project ID or any other project data.
 *
 * Tokens can be rotated (regenerated) without affecting project data.
 *
 * localStorage key: bik-checkin-tokens
 * Shape: { [token]: { projectId, name, address, createdAt } }
 *
 * Reverse index:   bik-checkin-token-index
 * Shape: { [projectId]: token }  — so we can find the token for a project
 */

const TOKENS_KEY = 'bik-checkin-tokens';
const INDEX_KEY  = 'bik-checkin-token-index';

function _loadTokens() {
  try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}'); } catch { return {}; }
}
function _loadIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY)  || '{}'); } catch { return {}; }
}
function _saveTokens(t) { localStorage.setItem(TOKENS_KEY, JSON.stringify(t)); }
function _saveIndex(i)  { localStorage.setItem(INDEX_KEY,  JSON.stringify(i)); }

function _newToken() {
  const buf = new Uint8Array(16); // 128-bit
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

export const checkinTokens = {

  /**
   * Get (or create) the public token for a project.
   * Stores the minimum info needed to render the check-in page.
   * Returns the 32-char hex token string.
   */
  getOrCreate(project) {
    const index  = _loadIndex();
    const tokens = _loadTokens();
    let token    = index[project.id];
    if (token && tokens[token]) return token; // already exists

    // Generate fresh token
    token = _newToken();
    tokens[token] = {
      projectId:   project.id,
      name:        project.name || project.projectName || '',
      address:     project.siteAddress || '',
      createdAt:   new Date().toISOString(),
    };
    index[project.id] = token;
    _saveTokens(tokens);
    _saveIndex(index);
    return token;
  },

  /**
   * Look up a token. Returns { projectId, name, address } or null.
   * Used by the check-in page and the attendance store.
   */
  lookup(token) {
    if (!token) return null;
    return _loadTokens()[token] || null;
  },

  /**
   * Rotate the token for a project (revoke old, issue new).
   * Old QR codes will stop working after rotation.
   */
  rotate(projectId) {
    const tokens = _loadTokens();
    const index  = _loadIndex();
    const old    = index[projectId];
    if (old) delete tokens[old];
    // Re-issue via getOrCreate next call
    delete index[projectId];
    _saveTokens(tokens);
    _saveIndex(index);
  },

  /** Get the current token for a project, or null if none generated yet. */
  forProject(projectId) {
    const index = _loadIndex();
    const token = index[projectId];
    if (!token) return null;
    return _loadTokens()[token] ? token : null;
  },

  /** Update the cached name/address on a token when a project is edited. */
  sync(project) {
    const index  = _loadIndex();
    const tokens = _loadTokens();
    const token  = index[project.id];
    if (!token || !tokens[token]) return;
    tokens[token].name    = project.name    || project.projectName || tokens[token].name;
    tokens[token].address = project.siteAddress || tokens[token].address;
    _saveTokens(tokens);
  },
};
