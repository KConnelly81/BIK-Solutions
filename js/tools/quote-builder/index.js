/**
 * Quote Builder — Tool Entry Point
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { LineItemsEditor } from '../../toolkit/line-items.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

/**
 * @param {Function} [onReady] — called once with { engine, toast, lineItems }
 *   after the tool has mounted. Used by supabase-integration.js (Sprint 5a)
 *   to get a handle on the live FormEngine instance and the LineItemsEditor
 *   for the one-time project snapshot, the Save-to-project panel, and
 *   syncing line items to quote_line_items — same pattern as
 *   js/tools/variation-notice/index.js's onReady.
 */
export function init(onReady) {
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
        reference:   state.quoteNumber || 'Unsaved quote',
        extraLines:  [`Quote total: ${extra?.total != null ? '$' + Number(extra.total).toFixed(2) : '—'}`]
      };
    },

    onAfterMount({ engine, toast, $ }) {
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

      onReady?.({ engine, toast, lineItems });
    },

    onRestoreExtra(extra) {
      if (lineItems && extra?.lineItems) {
        lineItems.setItems(extra.lineItems);
      }
    }
  });

  ctrl.mount();
}
