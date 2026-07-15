/**
 * BIK Integration Layer — Authentication Manager
 *
 * Manages OAuth 2.0 flows and API key auth for all providers.
 * Handles token storage, expiry detection, and refresh.
 *
 * Token storage is pluggable via the StorageAdapter interface:
 *   - Phase 1: localStorage (browser, single-user)
 *   - Phase 2: Database table via Supabase (server-side, multi-user)
 *   Swap the adapter — nothing else changes.
 *
 * AUTH_INTEGRATION_POINT:
 *   In Phase 2, replace LocalStorageTokenStore with a SupabaseTokenStore
 *   that reads/writes to integration_tokens table. Inject it via
 *   AuthManager({ tokenStore: new SupabaseTokenStore(supabase, userId) }).
 *
 * Supported auth types:
 *   'oauth2-pkce'  — OAuth2 PKCE (Xero, MYOB, QuickBooks)
 *   'oauth2-cc'    — OAuth2 Client Credentials (SimPRO, AroFlo server-side)
 *   'api-key'      — Static API key in header (ServiceM8, Buildxact)
 *   'basic'        — HTTP Basic Auth
 */

import { AuthenticationError } from './errors.js';
import { createLogger }        from './logger.js';

const log = createLogger('auth-manager');

// ── Token Store interface ─────────────────────────────────────

/**
 * StorageAdapter interface — implement this for Phase 2 server-side storage.
 *
 * interface TokenStore {
 *   async get(providerId: string): TokenData | null
 *   async set(providerId: string, data: TokenData): void
 *   async delete(providerId: string): void
 * }
 *
 * TokenData shape:
 * {
 *   accessToken:  string,
 *   refreshToken: string | null,
 *   expiresAt:    number,        // epoch ms
 *   scope:        string | null
 * }
 */

export class LocalStorageTokenStore {
  constructor(prefix = 'bik-integration-token') {
    this._prefix = prefix;
  }

  async get(providerId) {
    try {
      const raw = localStorage.getItem(`${this._prefix}:${providerId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  async set(providerId, data) {
    try {
      localStorage.setItem(`${this._prefix}:${providerId}`, JSON.stringify(data));
    } catch (_) {}
  }

  async delete(providerId) {
    try {
      localStorage.removeItem(`${this._prefix}:${providerId}`);
    } catch (_) {}
  }
}

// ── AuthManager ───────────────────────────────────────────────

export class AuthManager {
  /**
   * @param {Object} opts
   * @param {Object} [opts.tokenStore] — TokenStore implementation (default: LocalStorageTokenStore)
   */
  constructor(opts = {}) {
    this._store = opts.tokenStore || new LocalStorageTokenStore();
    this._refreshing = {};   // Guard against concurrent refresh calls per provider
  }

  // ── API Key auth ─────────────────────────────────────────────

  /**
   * Return headers for API key authentication.
   * Provider config should contain { apiKey, apiKeyHeader }.
   *
   * @param {Object} config — provider config
   * @returns {Record<string,string>}
   */
  apiKeyHeaders(config) {
    const header = config.apiKeyHeader || 'X-API-Key';
    if (!config.apiKey) throw new AuthenticationError(config.id, 'No API key configured');
    return { [header]: config.apiKey };
  }

  // ── Basic auth ───────────────────────────────────────────────

  basicHeaders(config) {
    if (!config.username || !config.password) {
      throw new AuthenticationError(config.id, 'No credentials configured for Basic auth');
    }
    const encoded = btoa(`${config.username}:${config.password}`);
    return { Authorization: `Basic ${encoded}` };
  }

  // ── OAuth2 ───────────────────────────────────────────────────

  /**
   * Return a valid Bearer token for a provider, refreshing if needed.
   * Throws AuthenticationError if not authenticated.
   *
   * @param {string} providerId
   * @param {Object} oauthConfig — { clientId, clientSecret, tokenUrl, refreshUrl? }
   * @returns {Promise<string>} access token
   */
  async getBearerToken(providerId, oauthConfig) {
    const token = await this._store.get(providerId);

    if (!token) {
      throw new AuthenticationError(providerId,
        `No OAuth token stored for '${providerId}'. Complete the OAuth flow first.`);
    }

    // Refresh if within 60s of expiry
    const expiryBuffer = 60_000;
    if (Date.now() >= token.expiresAt - expiryBuffer) {
      return this._refresh(providerId, token, oauthConfig);
    }

    return token.accessToken;
  }

  /**
   * Store an OAuth token response (call this after the OAuth callback).
   * Normalises Xero / MYOB / QuickBooks response shapes.
   *
   * @param {string} providerId
   * @param {Object} tokenResponse — raw response from the token endpoint
   */
  async storeTokenResponse(providerId, tokenResponse) {
    const expiresInMs = (tokenResponse.expires_in || 1800) * 1000;
    await this._store.set(providerId, {
      accessToken:  tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || null,
      expiresAt:    Date.now() + expiresInMs,
      scope:        tokenResponse.scope || null
    });
    log.info('Token stored', { provider: providerId });
  }

  /** Check if a provider has a stored (possibly expired) token. */
  async hasToken(providerId) {
    const t = await this._store.get(providerId);
    return !!t;
  }

  /** Revoke and delete the stored token for a provider. */
  async revokeToken(providerId) {
    await this._store.delete(providerId);
    log.info('Token revoked', { provider: providerId });
  }

  /**
   * Build the OAuth2 PKCE authorisation URL.
   * OAUTH_PKCE_INTEGRATION_POINT: Call this to start the OAuth flow.
   *
   * @param {Object} cfg — { authUrl, clientId, redirectUri, scopes[] }
   * @returns {{ url: string, codeVerifier: string }} — store codeVerifier in sessionStorage
   */
  async buildAuthorizationUrl(cfg) {
    const verifier  = this._randomBase64(32);
    const challenge = await this._sha256Base64Url(verifier);
    const state     = this._randomBase64(16);

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             cfg.clientId,
      redirect_uri:          cfg.redirectUri,
      scope:                 (cfg.scopes || []).join(' '),
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256'
    });

    return {
      url:          `${cfg.authUrl}?${params}`,
      codeVerifier: verifier,
      state
    };
  }

  /**
   * Exchange an auth code for tokens.
   * OAUTH_PKCE_INTEGRATION_POINT: Call this in the OAuth redirect handler.
   *
   * @param {string} providerId
   * @param {Object} cfg        — { tokenUrl, clientId, clientSecret, redirectUri }
   * @param {string} code       — from query string
   * @param {string} verifier   — stored codeVerifier from buildAuthorizationUrl
   */
  async exchangeCode(providerId, cfg, code, verifier) {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  cfg.redirectUri,
      client_id:     cfg.clientId,
      code_verifier: verifier
    });

    if (cfg.clientSecret) {
      body.set('client_secret', cfg.clientSecret);
    }

    log.info('Exchanging auth code', { provider: providerId });

    const response = await fetch(cfg.tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString()
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new AuthenticationError(providerId,
        `Token exchange failed: ${err.error_description || err.error || response.status}`);
    }

    const tokenResponse = await response.json();
    await this.storeTokenResponse(providerId, tokenResponse);
    return tokenResponse;
  }

  // ── Private ───────────────────────────────────────────────────

  async _refresh(providerId, token, cfg) {
    // Prevent concurrent refresh calls
    if (this._refreshing[providerId]) return this._refreshing[providerId];

    this._refreshing[providerId] = this.__doRefresh(providerId, token, cfg)
      .finally(() => { delete this._refreshing[providerId]; });

    return this._refreshing[providerId];
  }

  async __doRefresh(providerId, token, cfg) {
    if (!token.refreshToken) {
      await this._store.delete(providerId);
      throw new AuthenticationError(providerId,
        `Access token expired and no refresh token is available for '${providerId}'`);
    }

    log.info('Refreshing access token', { provider: providerId });

    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: token.refreshToken,
      client_id:     cfg.clientId
    });
    if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret);

    const response = await fetch(cfg.refreshUrl || cfg.tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString()
    });

    if (!response.ok) {
      await this._store.delete(providerId);
      const err = await response.json().catch(() => ({}));
      throw new AuthenticationError(providerId,
        `Token refresh failed: ${err.error_description || err.error || response.status}`);
    }

    const refreshed = await response.json();
    await this.storeTokenResponse(providerId, refreshed);
    log.info('Token refreshed successfully', { provider: providerId });
    return refreshed.access_token;
  }

  _randomBase64(byteLength) {
    const arr = new Uint8Array(byteLength);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async _sha256Base64Url(str) {
    const buf    = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

/** Default singleton for use across the integration layer. */
export const authManager = new AuthManager();
