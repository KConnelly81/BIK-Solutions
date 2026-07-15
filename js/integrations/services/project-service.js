/**
 * Project Service
 *
 * Business-level API for project operations. Delegates to the active provider.
 */

import { registry }          from '../core/provider-registry.js';
import { validateProject }   from '../interfaces/project.js';
import { createLogger }      from '../core/logger.js';
import { CapabilityError }   from '../core/errors.js';

const log = createLogger('project-service');

function _provider() {
  const p = registry.getActiveForCapability('projects');
  if (!p) throw new CapabilityError('projects');
  return p;
}

/**
 * Create a new project in the active provider.
 * @param {Object} data — raw project data; will be validated
 * @returns {Promise<import('../interfaces/project.js').Project>}
 */
export async function createProject(data) {
  const project = validateProject(data);
  log.info('createProject', { name: project.name });
  return _provider().createProject(project);
}

/**
 * Retrieve a project by its provider-assigned ID.
 * @param {string} externalId
 */
export async function getProject(externalId) {
  log.debug('getProject', { externalId });
  return _provider().getProject(externalId);
}

/**
 * List projects with optional filters.
 * @param {Object} [filters]
 */
export async function listProjects(filters = {}) {
  log.debug('listProjects', filters);
  return _provider().listProjects(filters);
}

/**
 * Update project details.
 * @param {string} externalId
 * @param {Object} data — partial fields to update
 */
export async function updateProject(externalId, data) {
  log.info('updateProject', { externalId });
  return _provider().updateProject(externalId, data);
}

/**
 * Close/complete a project.
 * @param {string} externalId
 */
export async function closeProject(externalId) {
  log.info('closeProject', { externalId });
  return _provider().closeProject(externalId);
}
