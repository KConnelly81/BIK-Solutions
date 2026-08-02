/**
 * Progress Claim — Tool Entry Point
 */

import { ToolController } from '../../toolkit/tool-controller.js';
import { ScheduleOfValuesEditor } from '../../toolkit/schedule-of-values.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';

/**
 * @param {Function} [onReady] — called once with { engine, toast, schedule }
 *   after the tool has mounted. Used by supabase-integration.js (Sprint 5a)
 *   to get a handle on the live FormEngine instance and the
 *   ScheduleOfValuesEditor for the one-time project snapshot, the
 *   Save-to-project panel, and syncing the schedule to
 *   progress_claim_line_items — same pattern as js/tools/quote-builder/
 *   index.js's onReady.
 */
export function init(onReady) {
  let schedule = null;

  const ctrl = new ToolController(SCHEMA, generateDocument, {
    ...DOC_CONFIG,

    getExtraState() {
      return schedule ? schedule.getItems() : {};
    },

    onAfterMount({ engine, toast, $ }) {
      const calcSummary = document.getElementById('calc-summary');
      const formContainer = document.getElementById('form-container');
      const sections = formContainer?.querySelectorAll('.form-section');
      let claimSection = null;
      sections?.forEach((s) => {
        const title = s.querySelector('.form-section-title');
        if (title?.textContent.includes('Claim Details')) claimSection = s;
      });
      if (claimSection && calcSummary) {
        claimSection.after(calcSummary);
        calcSummary.hidden = false;
      }

      // Inject the schedule of values editor after the Schedule of Values
      // section — replaces that section's free-text scheduleOfValues field
      // as the structured source progress_claim_line_items is synced from
      // (the free-text field remains on the form, still included in the
      // generated PDF, but is no longer what's saved to the database).
      const scheduleSection = Array.from(sections || []).find((s) =>
        s.querySelector('.form-section-title')?.textContent.includes('Schedule of Values')
      );

      const wrap = document.createElement('div');
      wrap.className = 'form-section';
      wrap.innerHTML = '<div class="form-section-title">Structured Schedule of Values</div>';
      const editorWrap = document.createElement('div');
      wrap.appendChild(editorWrap);

      if (scheduleSection) {
        scheduleSection.after(wrap);
      } else {
        formContainer?.appendChild(wrap);
      }

      schedule = new ScheduleOfValuesEditor(editorWrap, {
        onChange() {
          engine._onChange?.(engine.getState());
        }
      });
      schedule.mount();

      onReady?.({ engine, toast, schedule });
    },

    onRestoreExtra(extra) {
      if (schedule && extra?.items) {
        schedule.setItems(extra.items);
      }
    }
  });

  ctrl.mount();
}
