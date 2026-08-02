/**
 * Quote Builder — Supabase Integration (Sprint 5a)
 *
 * Tool-specific wiring only, same shape as js/tools/variation-notice/
 * supabase-integration.js: the generic session/project gating, save-panel
 * dispatch, and list rendering live in js/toolkit/supabase-project-context.js
 * and js/toolkit/supabase-record-panel.js. This file adds two things
 * Variation Notice doesn't need: syncing the LineItemsEditor's rows to
 * quote_line_items after every save (js/toolkit/supabase-line-items.js),
 * and the "Issue quote" action (js/toolkit/supabase-issue-button.js).
 *
 * Wires quote-builder.html to public.create_quote() and public.issue_quote()
 * only (supabase/migrations/012-014) — never a direct call to internal.*.
 *
 * All pure logic lives in quote-save-logic.js and is unit tested there
 * directly. This file requires a browser and a live Supabase project.
 */

import { gateOnSupabaseProject, applySnapshotOnce } from '../../toolkit/supabase-project-context.js';
import { wireSaveButton, refreshRecordList, escapeHtml } from '../../toolkit/supabase-record-panel.js';
import { wireIssueButton } from '../../toolkit/supabase-issue-button.js';
import { syncLineItems } from '../../toolkit/supabase-line-items.js';
import { formatAUD, centsToDollars } from '../../toolkit/calculator.js';
import {
  buildCreatePayload,
  buildHeaderPayload,
  mapLineItemToRow,
  validateForSave,
  validateForIssue,
  friendlyQuoteError,
  deriveClientSnapshot
} from './quote-save-logic.js';

const TABLE = 'quotes';
const LINE_ITEMS_TABLE = 'quote_line_items';
const RPC_CREATE = 'create_quote';
const RPC_ISSUE = 'issue_quote';

/**
 * Gates quote-builder.html on an authenticated session and a valid
 * `?project=` id, then mounts the tool (mountTool = js/tools/quote-builder/
 * index.js's init, which accepts an onReady({ engine, toast, lineItems })
 * callback) and wires the Save-to-project panel, the Issue action, and the
 * project's quotes list.
 */
export async function initQuoteBuilderSupabaseIntegration(mountTool) {
  await gateOnSupabaseProject({
    mountTool,
    customerFields: 'business_name, first_name, last_name, email',
    onGated(project, mount) {
      // See variation-notice's identical try/catch: the list panel below
      // has nothing to do with whether the (large) form itself mounts
      // successfully.
      try {
        mount(({ engine, lineItems }) => {
          applySnapshotOnce(engine, deriveClientSnapshot(project));

          let currentQuoteId = null;

          wireSaveButton({
            engine,
            project,
            table: TABLE,
            rpcName: RPC_CREATE,
            buildInsertPayload: (state, proj) => buildCreatePayload(state, proj.id),
            buildCreateFollowUpPayload: buildHeaderPayload,
            buildUpdatePayload: buildHeaderPayload,
            validate: validateForSave,
            getRecordRef: (row) => row.quote_number,
            recordLabel: 'Quote',
            friendlyError: friendlyQuoteError,
            applyResultToEngine: (row, eng) => {
              currentQuoteId = row.id;
              eng.setState('quoteNumber', row.quote_number);
            },
            onSaved: async () => {
              try {
                const { items } = lineItems.getItems();
                await syncLineItems({
                  table: LINE_ITEMS_TABLE,
                  parentColumn: 'quote_id',
                  parentId: currentQuoteId,
                  items: items.filter((it) => it.description?.trim()),
                  mapItemToRow: mapLineItemToRow
                });
              } catch (err) {
                // A line-item sync failure (most likely: the quote was
                // already issued in another tab/session) must not be
                // silently swallowed, but the header save itself already
                // succeeded and shown its own success message — surface
                // this as a second, distinct error rather than replacing
                // that message.
                console.error('[BIK] Quote line item sync error:', err);
                const errorEl = document.getElementById('sb-save-error');
                if (errorEl) {
                  errorEl.textContent = `Header saved, but line items were not: ${friendlyQuoteError(err)}`;
                  errorEl.hidden = false;
                }
              }
              refreshQuotesList(project.id);
            }
          });

          wireIssueButton({
            rpcName: RPC_ISSUE,
            buildParams: (id) => ({ p_quote_id: id }),
            getRecordId: () => currentQuoteId,
            validate: () => {
              const { items } = lineItems.getItems();
              const count = items.filter((it) => it.description?.trim()).length;
              return validateForIssue(engine.getState(), count);
            },
            recordLabel: 'Quote',
            friendlyError: friendlyQuoteError,
            unsavedMessage: 'Save this quote to the project before issuing it.',
            onIssued: () => refreshQuotesList(project.id)
          });
        });
      } catch (err) {
        console.error('[BIK] Quote Builder failed to mount:', err);
      }

      refreshQuotesList(project.id);
    }
  });
}

function refreshQuotesList(projectId) {
  return refreshRecordList({
    table: TABLE,
    projectId,
    selectColumns: 'id, quote_number, client_name, status, total_cents',
    emptyMessage: 'No quotes saved to this project yet.',
    renderTotal: (rows) => {
      const totalCents = rows.reduce((sum, row) => sum + (row.total_cents || 0), 0);
      return `Total ${formatAUD(centsToDollars(totalCents))}`;
    },
    renderRow: (row) => `
      <li class="sb-list-item">
        <span class="sb-list-item-number">${escapeHtml(row.quote_number)}</span>
        <span class="sb-list-item-client">${escapeHtml(row.client_name || '')}</span>
        <span class="status-pill status-pill--${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
        <span class="sb-list-item-amount">${formatAUD(centsToDollars(row.total_cents))}</span>
      </li>
    `
  });
}
