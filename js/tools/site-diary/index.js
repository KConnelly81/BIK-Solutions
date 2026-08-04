/**
 * Site Diary — Tool Entry Point
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

/**
 * @param {Function} [onReady] — called once with { engine, toast } after the
 *   tool has mounted. Used by supabase-integration.js for the Save-to-project
 *   panel — same pattern as js/tools/variation-notice/index.js's onReady.
 */
export function init(onReady) {
  const ctrl = new ToolController(SCHEMA, generateDocument, {
    ...DOC_CONFIG,
    onAfterMount({ engine, toast }) {
      onReady?.({ engine, toast });
    }
  });
  ctrl.mount();
}
