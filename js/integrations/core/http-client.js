/**
 * BIK Integration Layer — HTTP Client
 *
 * Shared fetch wrapper used by all providers. Handles:
 * - JSON serialisation / deserialisation
 * - Authentication header injection
 * - Timeout (AbortController)
 * - Retry with exponential backoff (configurable)
 * - Error normalisation (network, 4xx, 5xx → typed errors)
 * - Structured request/response logging
 *
 * Each provider creates its own HttpClient instance with provider-specific
 * baseUrl and default headers. Business services never call this directly.
 *
 * Usage (inside a provider):
 *   this.http = new HttpClient({
 *     baseUrl:    'https://api.xero.com/api.xro/2.0',
 *     providerId: 'xero',
 *     logger:     this.log,
 *     getHeaders: () => ({ Authorization: `Bearer ${this._token}` })
 *   });
 *   const contact = await this.http.get('/Contacts/123');
 *   const created = await this.http.post('/Contacts', { Name: 'Test' });
 */

import { NetworkError, RateLimitError, ProviderError, TimeoutError } from './errors.js';

// Default retry config
const DEFAULT_RETRY = {
  attempts:    3,
  baseDelayMs: 500,
  maxDelayMs:  8000,
  retryOn:     [429, 500, 502, 503, 504]
};

const DEFAULT_TIMEOUT_MS = 20_000;

export class HttpClient {
  /**
   * @param {Object}   opts
   * @param {string}   opts.baseUrl      — provider API base URL
   * @param {string}   opts.providerId   — for error context
   * @param {Function} opts.getHeaders   — () => Record<string,string> (auth headers, etc.)
   * @param {Object}   [opts.logger]     — IntegrationLogger instance
   * @param {Object}   [opts.retry]      — override DEFAULT_RETRY
   * @param {number}   [opts.timeoutMs]  — per-request timeout
   */
  constructor(opts = {}) {
    this._baseUrl   = (opts.baseUrl || '').replace(/\/$/, '');
    this._provider  = opts.providerId || 'unknown';
    this._getHeaders = opts.getHeaders || (() => ({}));
    this._log       = opts.logger || { debug() {}, info() {}, warn() {}, error() {} };
    this._retry     = { ...DEFAULT_RETRY, ...(opts.retry || {}) };
    this._timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async get(path, opts = {})             { return this._request('GET',    path, null,   opts); }
  async post(path, body, opts = {})      { return this._request('POST',   path, body,   opts); }
  async put(path, body, opts = {})       { return this._request('PUT',    path, body,   opts); }
  async patch(path, body, opts = {})     { return this._request('PATCH',  path, body,   opts); }
  async delete(path, opts = {})          { return this._request('DELETE', path, null,   opts); }

  /** Upload file as multipart/form-data. Body should be a FormData instance. */
  async upload(path, formData, opts = {}) {
    return this._request('POST', path, formData, { ...opts, multipart: true });
  }

  // ── Internal ──────────────────────────────────────────────

  async _request(method, path, body, opts = {}) {
    const url = path.startsWith('http') ? path : `${this._baseUrl}${path}`;
    const { attempts, baseDelayMs, maxDelayMs, retryOn } = this._retry;

    let lastErr;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this._doRequest(method, url, body, opts);
      } catch (err) {
        lastErr = err;

        const isRetryable =
          err instanceof NetworkError ||
          (err instanceof ProviderError && retryOn.includes(err.meta?.statusCode)) ||
          (err instanceof RateLimitError);

        if (!isRetryable || attempt === attempts) break;

        const delay = err instanceof RateLimitError && err.retryAfterMs
          ? err.retryAfterMs
          : Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);

        this._log.warn(`Retry ${attempt}/${attempts - 1} after ${delay}ms`, {
          method, url, error: err.message
        });

        await sleep(delay);
      }
    }

    throw lastErr;
  }

  async _doRequest(method, url, body, opts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this._timeoutMs);

    const isMultipart = opts.multipart || body instanceof FormData;
    const authHeaders = this._getHeaders();

    const headers = {
      Accept: 'application/json',
      ...authHeaders,
      ...(opts.headers || {})
    };

    if (body && !isMultipart) {
      headers['Content-Type'] = 'application/json';
    }

    const init = {
      method,
      headers,
      signal: controller.signal
    };

    if (body) {
      init.body = isMultipart ? body : JSON.stringify(body);
    }

    this._log.debug(`→ ${method} ${url}`, { body: body ? '[body]' : undefined });

    let response;
    try {
      response = await fetch(url, init);
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        throw new TimeoutError(this._provider, `${method} ${url}`, this._timeoutMs);
      }
      throw new NetworkError(this._provider, url, fetchErr);
    } finally {
      clearTimeout(timeout);
    }

    this._log.debug(`← ${response.status} ${url}`);

    const responseBody = await this._parseResponse(response);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : null;
      throw new RateLimitError(this._provider, retryMs);
    }

    if (!response.ok) {
      throw new ProviderError(
        this._provider,
        String(response.status),
        this._extractErrorMessage(responseBody, response.status),
        { statusCode: response.status, body: responseBody }
      );
    }

    return responseBody;
  }

  async _parseResponse(response) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { return await response.json(); } catch (_) { return null; }
    }
    if (ct.includes('text/')) {
      return response.text();
    }
    return response.blob();
  }

  _extractErrorMessage(body, status) {
    if (!body) return `HTTP ${status}`;
    return body.message || body.error_description || body.error ||
           body.detail  || body.Message           || `HTTP ${status}`;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
