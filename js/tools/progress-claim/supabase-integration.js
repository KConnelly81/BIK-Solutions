/**
 * Progress Claim — Supabase Integration (Sprint 5a)
 *
 * Same shape as js/tools/quote-builder/supabase-integration.js. The one
 * deliberate difference: the "Issue" action is wired for real (calls the
 * real issue_progress_claim() RPC, not a stub) but is guaranteed to be
 * rejected by 017's temporary gate regardless of input — see
 * progress-claim-save-logic.js's header comment for why no
 * validateForIssue() exists here. Drafts (create, edit, the schedule of
 * values, calculation) are fully functional; only issuing is blocked, and
 * that block is enforced by the database, not hidden by this file.
 *
 * Wires progress-claim.html to public.create_progress_claim() and
 * public.issue_progress_claim() only (supabase/migrations/015-017) — never
 * a direct call to internal.*.
 */

// ?v= cache-busts these shared files — see js/toolkit/asset-version.js's
// header for why this must be a literal, not an imported constant, and
// which other files carry the same token.
import { gateOnSupabaseProject, applySnapshotOnce } from '../../toolkit/supabase-project-context.js?v=20260804a';
import { wireSaveButton, refreshRecordList, escapeHtml } from '../../toolkit/supabase-record-panel.js?v=20260804a';
import { wireIssueButton } from '../../toolkit/supabase-issue-button.js';
import { syncLineItems } from '../../toolkit/supabase-line-items.js';
import { formatAUD, centsToDollars } from '../../toolkit/calculator.js';
import {
  buildCreatePayload,
  buildHeaderPayload,
  mapScheduleItemToRow,
  validateForSave,
  friendlyProgressClaimError,
  deriveClientSnapshot
} from './progress-claim-save-logic.js';

const TABLE = 'progress_claims';
const LINE_ITEMS_TABLE = 'progress_claim_line_items';
const RPC_CREATE = 'create_progress_claim';
const RPC_ISSUE = 'issue_progress_claim';

/**
 * Gates progress-claim.html on an authenticated session and a valid
 * `?project=` id, then mounts the tool (mountTool = js/tools/progress-claim/
 * index.js's init, accepting onReady({ engine, toast, schedule })) and
 * wires the Save-to-project panel, the Issue action, and the project's
 * progress claims list.
 */
export async function initProgressClaimSupabaseIntegration(mountTool) {
  await gateOnSupabaseProject({
    mountTool,
    customerFields: 'business_name, first_name, last_name, email',
    onGated(project, mount) {
      try {
        mount(({ engine, schedule }) => {
          applySnapshotOnce(engine, deriveClientSnapshot(project));

          let currentClaimId = null;

          wireSaveButton({
            engine,
            project,
            table: TABLE,
            rpcName: RPC_CREATE,
            buildInsertPayload: (state, proj) => buildCreatePayload(state, proj.id),
            buildCreateFollowUpPayload: buildHeaderPayload,
            buildUpdatePayload: buildHeaderPayload,
            validate: validateForSave,
            getRecordRef: (row) => row.claim_number,
            recordLabel: 'Progress claim',
            friendlyError: friendlyProgressClaimError,
            applyResultToEngine: (row, eng) => {
              currentClaimId = row.id;
              eng.setState('claimNumber', row.claim_number);
            },
            onSaved: async () => {
              try {
                const { items } = schedule.getItems();
                await syncLineItems({
                  table: LINE_ITEMS_TABLE,
                  parentColumn: 'progress_claim_id',
                  parentId: currentClaimId,
                  items: items.filter((it) => it.description?.trim()),
                  mapItemToRow: mapScheduleItemToRow
                });
              } catch (err) {
                console.error('[BIK] Progress claim schedule sync error:', err);
                const errorEl = document.getElementById('sb-save-error');
                if (errorEl) {
                  errorEl.textContent = `Header saved, but the schedule of values was not: ${friendlyProgressClaimError(err)}`;
                  errorEl.hidden = false;
                }
              }
              refreshClaimsList(project.id);
            }
          });

          // No `validate` here, deliberately — see the module header
          // comment. Every click that has something saved genuinely calls
          // issue_progress_claim() and shows exactly the message the
          // database returns.
          wireIssueButton({
            rpcName: RPC_ISSUE,
            buildParams: (id) => ({ p_progress_claim_id: id }),
            getRecordId: () => currentClaimId,
            recordLabel: 'Progress claim',
            friendlyError: friendlyProgressClaimError,
            unsavedMessage: 'Save this progress claim to the project before attempting to issue it.'
          });
        });
      } catch (err) {
        console.error('[BIK] Progress Claim failed to mount:', err);
      }

      refreshClaimsList(project.id);
    }
  });
}

function refreshClaimsList(projectId) {
  return refreshRecordList({
    table: TABLE,
    projectId,
    selectColumns: 'id, claim_number, client_name, status, net_payable_cents',
    emptyMessage: 'No progress claims saved to this project yet.',
    renderTotal: (rows) => {
      const totalCents = rows.reduce((sum, row) => sum + (row.net_payable_cents || 0), 0);
      return `Total ${formatAUD(centsToDollars(totalCents))}`;
    },
    renderRow: (row) => `
      <li class="sb-list-item">
        <span class="sb-list-item-number">${escapeHtml(row.claim_number)}</span>
        <span class="sb-list-item-client">${escapeHtml(row.client_name || '')}</span>
        <span class="status-pill status-pill--${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
        <span class="sb-list-item-amount">${formatAUD(centsToDollars(row.net_payable_cents))}</span>
      </li>
    `
  });
}
