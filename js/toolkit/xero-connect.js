/**
 * XeroConnect — thin client for the BIK Xero proxy (cloudflare-worker-xero/).
 *
 * Not wired into any page yet — no "Connect to Xero" button exists in the
 * UI. This module is the one line a future settings/integrations page
 * needs to call; see connect()/getStatus()/disconnect() below. It cannot
 * be exercised end-to-end until the Xero Worker is deployed with real
 * XERO_CLIENT_ID/XERO_CLIENT_SECRET (see cloudflare-worker-xero/worker.js's
 * header).
 *
 * XERO_INTEGRATION_POINT:
 *   Update PROXY_URL below after deploying cloudflare-worker-xero
 *   (wrangler deploy from that folder).
 *
 * Usage (once a page wires a button to it):
 *   import { XeroConnect } from '../toolkit/xero-connect.js';
 *   const btn = document.getElementById('connect-xero-btn');
 *   btn.addEventListener('click', () => XeroConnect.connect());
 *
 *   // On page load, e.g. to show "Connected" vs "Connect" state:
 *   const status = await XeroConnect.getStatus();
 *   if (status.connected) { ... }
 *
 *   // After redirect back from Xero, app-dashboard.html (or wherever
 *   // APP_REDIRECT_URL in wrangler.toml points) receives ?xero=connected
 *   // or ?xero=error&reason=... in the query string — read it with
 *   // new URLSearchParams(location.search).
 */

// ── XERO_INTEGRATION_POINT ──────────────────────────────────────────────
// Replace with the deployed Worker's URL after running `wrangler deploy`
// from cloudflare-worker-xero/. Example: 'https://bik-xero-proxy.<account>.workers.dev'
const PROXY_URL = 'https://bik-xero-proxy.biksolutions.workers.dev';

async function authHeader() {
  const { supabase } = await import('../supabase/client.js');
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('NOT_SIGNED_IN');
  return { Authorization: `Bearer ${token}` };
}

export const XeroConnect = {
  /**
   * Starts the Xero OAuth2 connect flow: asks the Worker for a signed
   * authorize URL (requires the caller's Supabase session, so this must
   * be a fetch() with an Authorization header — a plain <a href> link
   * cannot carry that header, which is why this isn't just a static
   * link to the Worker), then navigates the browser there.
   * @throws {Error} message === 'NOT_SIGNED_IN' | 'CONNECT_REQUEST_FAILED'
   */
  async connect() {
    const headers = await authHeader();
    const resp = await fetch(`${PROXY_URL}/connect`, { headers });
    if (!resp.ok) throw new Error('CONNECT_REQUEST_FAILED');
    const { authorizeUrl } = await resp.json();
    window.location.href = authorizeUrl;
  },

  /**
   * @returns {Promise<{connected: boolean, tenantName?: string, connectedAt?: string}>}
   */
  async getStatus() {
    try {
      const headers = await authHeader();
      const resp = await fetch(`${PROXY_URL}/status`, { headers });
      if (!resp.ok) return { connected: false };
      return await resp.json();
    } catch {
      return { connected: false };
    }
  },

  /** @returns {Promise<boolean>} true if the connection was removed */
  async disconnect() {
    const headers = await authHeader();
    const resp = await fetch(`${PROXY_URL}/disconnect`, { method: 'DELETE', headers });
    if (!resp.ok) return false;
    const { disconnected } = await resp.json();
    return Boolean(disconnected);
  },
};
