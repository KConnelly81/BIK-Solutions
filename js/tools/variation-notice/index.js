/**
 * Variation Notice — Tool Entry Point
 * Wires the tool using ToolController.
 * All shared behaviour (generate, AI, email, history, tabs, etc.) lives in ToolController.
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

/**
 * @param {Function} [onReady] — called once with { engine, toast } after
 *   the tool has mounted. Used by supabase-integration.js (Sprint 3) to
 *   get a handle on the live FormEngine instance for the one-time project
 *   snapshot and the Save-to-project panel — ToolController does not
 *   expose the engine any other way, and this tool intentionally doesn't
 *   duplicate ToolController's mounting logic to get one.
 */
export function init(onReady) {
  const ctrl = new ToolController(SCHEMA, generateDocument, {
    ...DOC_CONFIG,
    onAfterMount({ engine, toast, $ }) {
      // Inject GST summary after the Cost section
      const calcSummary = document.getElementById('calc-summary');
      const formContainer = document.getElementById('form-container');
      const sections = formContainer?.querySelectorAll('.form-section');
      let costSection = null;
      sections?.forEach(s => {
        const title = s.querySelector('.form-section-title');
        if (title?.textContent.includes('Cost')) costSection = s;
      });
      if (calcSummary && costSection) {
        costSection.after(calcSummary);
        calcSummary.hidden = false;
      }

      onReady?.({ engine, toast });
    }
  });

  ctrl.mount();
}
