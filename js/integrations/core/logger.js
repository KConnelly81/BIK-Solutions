/**
 * BIK Integration Layer — Structured Logger
 *
 * Provides levelled, structured logging across all integration modules.
 * In Phase 1 / development, outputs to console.
 * In Phase 2, swap the _output() method to ship logs to your backend
 * (e.g. Supabase table, Axiom, Logtail) — no other code changes needed.
 *
 * Usage:
 *   import { createLogger } from '../core/logger.js';
 *   const log = createLogger('xero');
 *   log.info('Invoice created', { invoiceId: '123', contactId: '456' });
 *   log.error('Auth failed', { error: err.message });
 *
 * LOG_INTEGRATION_POINT:
 *   Replace _output() in IntegrationLogger to ship to a log aggregator.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// Only log debug output on localhost in Phase 1
const LEVEL_FLOOR = (typeof location !== 'undefined' && location.hostname === 'localhost')
  ? 'debug'
  : 'info';

class IntegrationLogger {
  /**
   * @param {string} namespace  — 'xero', 'invoice-service', etc.
   * @param {Object} [context]  — bound context merged into every entry
   */
  constructor(namespace, context = {}) {
    this._ns  = namespace;
    this._ctx = context;
  }

  /** Return a child logger that inherits namespace + merges extra context. */
  child(namespace, context = {}) {
    return new IntegrationLogger(`${this._ns}:${namespace}`, { ...this._ctx, ...context });
  }

  debug(message, meta = {}) { this._log('debug', message, meta); }
  info (message, meta = {}) { this._log('info',  message, meta); }
  warn (message, meta = {}) { this._log('warn',  message, meta); }
  error(message, meta = {}) { this._log('error', message, meta); }

  /** Time an async operation and log its duration. */
  async time(label, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      this.debug(`${label} completed`, { durationMs: Date.now() - start });
      return result;
    } catch (err) {
      this.error(`${label} failed`, { durationMs: Date.now() - start, error: err.message });
      throw err;
    }
  }

  _log(level, message, meta) {
    if (LEVELS[level] < LEVELS[LEVEL_FLOOR]) return;

    const entry = {
      ts:        new Date().toISOString(),
      level,
      ns:        this._ns,
      message,
      ...this._ctx,
      ...meta
    };

    this._output(level, entry);
    this._buffer(entry);
  }

  /**
   * LOG_INTEGRATION_POINT
   * Replace this to ship structured entries to a log aggregator.
   * Current: console output for development visibility.
   */
  _output(level, entry) {
    const prefix = `[BIK:${entry.ns}]`;
    const { ts, ns, level: _l, message, ...rest } = entry;
    const hasExtra = Object.keys(rest).length > 0;

    switch (level) {
      case 'debug': console.debug(prefix, message, hasExtra ? rest : ''); break;
      case 'info':  console.info (prefix, message, hasExtra ? rest : ''); break;
      case 'warn':  console.warn (prefix, message, hasExtra ? rest : ''); break;
      case 'error': console.error(prefix, message, hasExtra ? rest : ''); break;
    }
  }

  /** In-memory ring buffer — last 200 entries (useful for error reporting). */
  _buffer(entry) {
    IntegrationLogger._ring.push(entry);
    if (IntegrationLogger._ring.length > 200) IntegrationLogger._ring.shift();
  }

  /** Return the last N log entries (for error reports, support diagnostics). */
  static getRecentLogs(n = 50) {
    return IntegrationLogger._ring.slice(-n);
  }

  /** Clear the ring buffer. */
  static clearLogs() {
    IntegrationLogger._ring = [];
  }
}

IntegrationLogger._ring = [];

/**
 * Factory function — preferred way to create loggers.
 * @param {string} namespace
 * @param {Object} [context]
 * @returns {IntegrationLogger}
 */
export function createLogger(namespace, context = {}) {
  return new IntegrationLogger(namespace, context);
}

/** Root logger for the integration layer. */
export const rootLogger = createLogger('bik-integrations');

export { IntegrationLogger };
