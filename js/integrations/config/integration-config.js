/**
 * Integration Configuration
 *
 * Defines the shape of provider configuration and provides helpers for
 * loading/saving integration settings. In Phase 1 settings are stored in
 * localStorage; Phase 2 will move these to a user account backend.
 *
 * INTEGRATION_CONFIG_STORAGE_POINT — swap _load/_save for server calls.
 */

import { registry }          from '../core/provider-registry.js';
import { XeroProvider }      from '../providers/xero/index.js';
import { MYOBProvider }      from '../providers/myob/index.js';
import { QuickBooksProvider } from '../providers/quickbooks/index.js';
import { BuildxactProvider } from '../providers/buildxact/index.js';
import { ServiceM8Provider } from '../providers/servicem8/index.js';
import { SimPROProvider }    from '../providers/simpro/index.js';
import { AroFloProvider }    from '../providers/aroflo/index.js';
import { createLogger }      from '../core/logger.js';

const log = createLogger('integration-config');

const STORAGE_KEY = 'bik-integration-config';

/**
 * @typedef {Object} IntegrationSettings
 * @property {string|null} activeProvider  — provider id or null
 * @property {Object}      providers       — { [providerId]: providerConfig }
 */

const DEFAULT_SETTINGS = {
  activeProvider: null,
  providers: {}
};

/** All supported providers in registration order */
export const SUPPORTED_PROVIDERS = [
  { id: 'xero',       Class: XeroProvider,       label: 'Xero' },
  { id: 'myob',       Class: MYOBProvider,        label: 'MYOB' },
  { id: 'quickbooks', Class: QuickBooksProvider,  label: 'QuickBooks' },
  { id: 'buildxact',  Class: BuildxactProvider,   label: 'Buildxact' },
  { id: 'servicem8',  Class: ServiceM8Provider,   label: 'ServiceM8' },
  { id: 'simpro',     Class: SimPROProvider,       label: 'SimPRO' },
  { id: 'aroflo',     Class: AroFloProvider,       label: 'AroFlo' }
];

/** Load raw settings from localStorage */
function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings to localStorage */
function _save(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    log.warn('Failed to persist integration config', { error: e.message });
  }
}

/**
 * Initialise the registry from persisted settings.
 * Call once at app startup before any integration operations.
 */
export function initIntegrations() {
  const settings = _load();

  for (const { id, Class } of SUPPORTED_PROVIDERS) {
    registry.register(id, Class);
    const cfg = settings.providers[id];
    if (cfg) registry.configure(id, cfg);
  }

  if (settings.activeProvider) {
    try {
      registry.setActive(settings.activeProvider);
    } catch (e) {
      log.warn('Could not restore active provider', { id: settings.activeProvider, error: e.message });
    }
  }

  log.info('Integrations initialised', registry.summary());
}

/**
 * Configure a provider and optionally make it active.
 * @param {string}  providerId
 * @param {Object}  config     — provider-specific config object
 * @param {boolean} [setActive=false]
 */
export function configureProvider(providerId, config, setActive = false) {
  registry.configure(providerId, config);

  const settings = _load();
  settings.providers[providerId] = config;
  if (setActive) {
    registry.setActive(providerId);
    settings.activeProvider = providerId;
  }
  _save(settings);

  log.info('Provider configured', { providerId, setActive });
}

/**
 * Switch the active provider.
 * @param {string|null} providerId — pass null to clear active provider
 */
export function setActiveProvider(providerId) {
  registry.setActive(providerId);
  const settings = _load();
  settings.activeProvider = providerId;
  _save(settings);
  log.info('Active provider changed', { providerId });
}

/**
 * Remove a provider's configuration and clear it if active.
 * @param {string} providerId
 */
export function disconnectProvider(providerId) {
  const settings = _load();
  delete settings.providers[providerId];
  if (settings.activeProvider === providerId) {
    settings.activeProvider = null;
    registry.setActive(null);
  }
  _save(settings);
  log.info('Provider disconnected', { providerId });
}

/** @returns {IntegrationSettings} current raw settings */
export function getIntegrationSettings() {
  return _load();
}
