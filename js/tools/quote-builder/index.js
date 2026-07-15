/**
 * Quote Builder — Tool Entry Point
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { LineItemsEditor } from '../../toolkit/line-items.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

export function init() {
  let lineItems = null;

  const ctrl = new ToolController(SCHEMA, generateDocument, {
    ...DOC_CONFIG,

    getExtraState() {
      return lineItems ? lineItems.getItems() : {};
    },

    getEmailData(state, extra) {
      return {
        clientEmail: state.clientEmail || '',
        clientName:  state.clientName  || '',
        projectName: state.projectName || '',
        reference:   `Q-${state.quoteNumber || '???'}`,
        extraLines:  [`Quote total: ${extra?.total != null ? '$' + (extra.total / 100).toFixed(2) : '—'}`]
      };
    },

    onAfterMount({ engine, $ }) {
      // Inject line items editor after the Optional Items section
      const formContainer = document.getElementById('form-container');
      const sections = formContainer?.querySelectorAll('.form-section');
      let pricingSection = null;
      sections?.forEach(s => {
        const title = s.querySelector('.form-section-title');
        if (title?.textContent.includes('Optional')) pricingSection = s;
      });

      const wrap = document.createElement('div');
      wrap.className = 'form-section';
      wrap.innerHTML = '<div class="form-section-title">Pricing — Line Items</div>';
      const editorWrap = document.createElement('div');
      wrap.appendChild(editorWrap);

      if (pricingSection) {
        pricingSection.before(wrap);
      } else {
        formContainer?.appendChild(wrap);
      }

      lineItems = new LineItemsEditor(editorWrap, {
        onChange(totals) {
          engine._onChange?.(engine.getState());
        }
      });
      lineItems.mount();
    },

    onRestoreExtra(extra) {
      if (lineItems && extra?.lineItems) {
        lineItems.setItems(extra.lineItems);
      }
    }
  });

  ctrl.mount();
}
