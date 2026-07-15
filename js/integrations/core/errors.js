/**
 * BIK Integration Layer — Error Types
 *
 * All integration errors extend BIKIntegrationError so callers can
 * distinguish integration failures from application bugs with a single
 * instanceof check.
 *
 * Usage:
 *   import { AuthenticationError, ProviderError } from '../core/errors.js';
 *   throw new ProviderError('xero', 'CONTACT_NOT_FOUND', 'Contact 123 not found', { xeroId: '123' });
 */

// ── Base ─────────────────────────────────────────────────────

export class BIKIntegrationError extends Error {
  /**
   * @param {string} code    — machine-readable error code (SCREAMING_SNAKE_CASE)
   * @param {string} message — human-readable message
   * @param {Object} [meta]  — arbitrary context for logging
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.meta = meta;
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain in transpiled environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name:      this.name,
      code:      this.code,
      message:   this.message,
      meta:      this.meta,
      timestamp: this.timestamp
    };
  }
}

// ── Specific error types ──────────────────────────────────────

/**
 * Thrown when a provider cannot be authenticated.
 * Covers: invalid API key, expired OAuth token that could not be refreshed,
 * missing credentials in config.
 */
export class AuthenticationError extends BIKIntegrationError {
  constructor(providerId, message, meta = {}) {
    super('AUTHENTICATION_FAILED', message, { provider: providerId, ...meta });
    this.providerId = providerId;
  }
}

/**
 * Thrown when the requested resource does not exist in the provider.
 */
export class NotFoundError extends BIKIntegrationError {
  constructor(resource, id, providerId, meta = {}) {
    super('NOT_FOUND', `${resource} '${id}' not found in ${providerId}`, {
      resource, id, provider: providerId, ...meta
    });
  }
}

/**
 * Thrown when input data fails validation against the canonical interface.
 * Includes field-level errors.
 */
export class ValidationError extends BIKIntegrationError {
  /**
   * @param {string}   interface  — interface name ('Contact', 'Invoice', etc.)
   * @param {string[]} errors     — array of field-level error messages
   */
  constructor(interfaceName, errors) {
    super('VALIDATION_FAILED', `${interfaceName} validation failed: ${errors.join(', ')}`, {
      interface: interfaceName,
      errors
    });
    this.errors = errors;
  }
}

/**
 * Thrown when the provider returns an error response.
 * Wraps the provider-specific error so it never leaks into business code.
 */
export class ProviderError extends BIKIntegrationError {
  /**
   * @param {string} providerId     — 'xero', 'myob', etc.
   * @param {string} providerCode   — provider's own error code
   * @param {string} message
   * @param {Object} [providerMeta] — raw provider response details
   */
  constructor(providerId, providerCode, message, providerMeta = {}) {
    super('PROVIDER_ERROR', message, {
      provider:     providerId,
      providerCode,
      providerMeta
    });
    this.providerId   = providerId;
    this.providerCode = providerCode;
  }
}

/**
 * Thrown when a capability (e.g. 'quotes') is called on a provider
 * that does not support it, or when a method stub has not yet been implemented.
 */
export class NotImplementedError extends BIKIntegrationError {
  constructor(providerId, method) {
    super('NOT_IMPLEMENTED', `${providerId}.${method}() is not yet implemented`, {
      provider: providerId,
      method
    });
  }
}

/**
 * Thrown when the provider returns a rate limit response (HTTP 429).
 */
export class RateLimitError extends BIKIntegrationError {
  /**
   * @param {string} providerId
   * @param {number} [retryAfterMs] — milliseconds to wait before retrying
   */
  constructor(providerId, retryAfterMs = null) {
    super('RATE_LIMITED', `Rate limit exceeded for ${providerId}`, {
      provider: providerId,
      retryAfterMs
    });
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown when a network request fails (no response received).
 */
export class NetworkError extends BIKIntegrationError {
  constructor(providerId, url, cause) {
    super('NETWORK_ERROR', `Network request failed to ${providerId} (${url})`, {
      provider: providerId,
      url,
      cause: cause?.message
    });
    this.cause = cause;
  }
}

/**
 * Thrown when a provider operation exceeds the configured timeout.
 */
export class TimeoutError extends BIKIntegrationError {
  constructor(providerId, method, timeoutMs) {
    super('TIMEOUT', `${providerId}.${method}() timed out after ${timeoutMs}ms`, {
      provider: providerId,
      method,
      timeoutMs
    });
  }
}

/**
 * Thrown when the active provider does not support a requested capability.
 */
export class CapabilityError extends BIKIntegrationError {
  constructor(providerId, capability) {
    super('CAPABILITY_NOT_SUPPORTED',
      `Provider '${providerId}' does not support the '${capability}' capability`, {
        provider:   providerId,
        capability
      });
  }
}

/**
 * Thrown when no provider is configured or active.
 */
export class NoProviderError extends BIKIntegrationError {
  constructor() {
    super('NO_PROVIDER_CONFIGURED',
      'No integration provider is configured. Enable a provider in integration config.');
  }
}
