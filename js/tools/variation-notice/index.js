/**
 * Variation Notice — Tool Entry Point
 * Wires the tool using ToolController.
 * All shared behaviour (generate, AI, email, history, tabs, etc.) lives in ToolController.
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

export function init() {
  const ctrl = new ToolController(SCHEMA, generateDocument, {
    ...DOC_CONFIG,
    onAfterMount({ engine, $ }) {
      // Inject GST summary after the Cost section
      const calcSummary = document.getElementById('calc-summary');
      if (!calcSummary) return;
      const formContainer = document.getElementById('form-container');
      const sections = formContainer?.querySelectorAll('.form-section');
      let costSection = null;
      sections?.forEach(s => {
        const title = s.querySelector('.form-section-title');
        if (title?.textContent.includes('Cost')) costSection = s;
      });
      if (costSection) {
        costSection.after(calcSummary);
        calcSummary.hidden = false;
      }
    }
  });

  ctrl.mount();
}
