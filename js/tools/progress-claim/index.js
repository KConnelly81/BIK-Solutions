/**
 * Progress Claim — Tool Entry Point
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

export function init() {
  const ctrl = new ToolController(SCHEMA, generateDocument, {
    ...DOC_CONFIG,
    onAfterMount({ engine, $ }) {
      const calcSummary = document.getElementById('calc-summary');
      if (!calcSummary) return;
      const formContainer = document.getElementById('form-container');
      const sections = formContainer?.querySelectorAll('.form-section');
      let claimSection = null;
      sections?.forEach(s => {
        const title = s.querySelector('.form-section-title');
        if (title?.textContent.includes('Claim Details')) claimSection = s;
      });
      if (claimSection) {
        claimSection.after(calcSummary);
        calcSummary.hidden = false;
      }
    }
  });

  ctrl.mount();
}
