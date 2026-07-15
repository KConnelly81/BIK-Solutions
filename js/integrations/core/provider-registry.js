/**
 * BIK Integration Layer — Provider Registry
 *
 * Central registry for all integration providers.
 * Business services call registry.getActive() and never reference
 * a provider class directly — providers are swappable at config time.
 *
 * Usage:
 *   import { registry } from '../core/provider-registry.js';
 *   import { XeroProvider } from '../providers/xero/index.js';
 *
 *   registry.register('xero', XeroProvider);
 *   registry.configure('xero', { clientId: '...', tenantId: '...' });
 *   registry.setActive('xero');
 *
 *   const provider = registry.getActive();
 *   await provider.createInvoice(invoice);
 */

import { NoProviderError, CapabilityError } from './errors.js';
import { createLogger }                      from './logger.js';

const log = createLogger('provider-registry');

export class ProviderRegistry {
  constructor() {
    this._classes   = new Map();  // id → ProviderClass
    this._configs   = new Map();  // id → config object
    this._instances = new Map();  // id → provider instance (lazy)
    this._activeId  = null;
  }

  /**
   * Register a provider class.
   * @param {string} id             — 'xero', 'myob', etc.
   * @param {Function} ProviderClass — constructor
   */
  register(id, ProviderClass) {
    this._classes.set(id, ProviderClass);
    log.debug(`Provider registered: ${id}`);
    return this;
  }

  /**
   * Set runtime configuration for a provider.
   * Can be called after register() and before or after setActive().
   *
   * @param {string} id     — provider id
   * @param {Object} config — provider-specific config (see each provider's CONFIG_SCHEMA)
   */
  configure(id, config) {
    if (!this._classes.has(id)) {
      log.warn(`configure() called for unregistered provider: ${id}`);
    }
    this._configs.set(id, config);
    // Invalidate any cached instance so it picks up new config
    this._instances.delete(id);
    log.debug(`Provider configured: ${id}`);
    return this;
  }

  /**
   * Set the active provider.
   * @param {string|null} id — provider id, or null to disable integrations
   */
  setActive(id) {
    if (id !== null && !this._classes.has(id)) {
      throw new Error(`Cannot set active provider '${id}' — it is not registered`);
    }
    this._activeId = id;
    log.info(id ? `Active provider: ${id}` : 'Integration disabled (no active provider)');
    return this;
  }

  /**
   * Get the active provider instance.
   * @returns {BaseProvider}
   * @throws {NoProviderError} if no provider is active
   */
  getActive() {
    if (!this._activeId) throw new NoProviderError();
    return this._getInstance(this._activeId);
  }

  /**
   * Get the active provider only if it supports a specific capability.
   * @param {string} capability — 'contacts', 'invoices', 'quotes', etc.
   * @returns {BaseProvider}
   * @throws {NoProviderError | CapabilityError}
   */
  getActiveForCapability(capability) {
    const provider = this.getActive();
    if (!provider.capabilities.includes(capability)) {
      throw new CapabilityError(provider.id, capability);
    }
    return provider;
  }

  /**
   * Get a specific provider by id (even if not active).
   * @param {string} id
   * @returns {BaseProvider}
   */
  get(id) {
    if (!this._classes.has(id)) {
      throw new Error(`Provider '${id}' is not registered`);
    }
    return this._getInstance(id);
  }

  /** True if a provider is registered AND configured. */
  isAvailable(id) {
    return this._classes.has(id) && this._configs.has(id);
  }

  /** True if any provider is active. */
  hasActive() {
    return !!this._activeId;
  }

  /** Return the id of the active provider, or null. */
  get activeId() {
    return this._activeId;
  }

  /** Return all registered provider ids. */
  get registeredIds() {
    return [...this._classes.keys()];
  }

  /**
   * Return the capabilities of the active provider.
   * Returns [] if no provider is active.
   */
  get activeCapabilities() {
    if (!this._activeId) return [];
    try {
      return this.getActive().capabilities;
    } catch (_) {
      return [];
    }
  }

  /** Diagnostic summary (safe to log). */
  summary() {
    return {
      activeProvider:   this._activeId,
      registered:       this.registeredIds,
      configured:       [...this._configs.keys()],
      capabilities:     this.activeCapabilities
    };
  }

  // ── Private ──────────────────────────────────────────────────

  _getInstance(id) {
    if (!this._instances.has(id)) {
      const ProviderClass = this._classes.get(id);
      const config        = this._configs.get(id) || {};
      const instance      = new ProviderClass(config);
      this._instances.set(id, instance);
    }
    return this._instances.get(id);
  }
}

/** Singleton registry used across the integration layer. */
export const registry = new ProviderRegistry();
