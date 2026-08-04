/**
 * Generic Supabase integration for the 17 simple document-generator tools
 * that share public.project_documents (019) — Contract Termination, Defect
 * Report, Delay Notice, EOT Claim, Handover Checklist, Incident Report,
 * Inspection Checklist, Instruction to Proceed, Non-Conformance Report,
 * Notice to Show Cause, Payment Reminder, Practical Completion, Scope of
 * Works, Site Diary, Subcontractor Agreement, SWMS, Toolbox Talk.
 *
 * Same shape as js/tools/variation-notice/supabase-integration.js — the
 * generic session/project gating, save-panel dispatch, and list rendering
 * live in supabase-project-context.js and supabase-record-panel.js, reused
 * unchanged here. What this module adds is the one thing all 17 tools
 * share that Quotes/Progress Claims/Variation Notices don't need: no
 * numbering RPC, no issue workflow, a single shared table with a
 * `document_type` discriminator instead of one dedicated table each — see
 * 019_create_project_documents.sql's header for why.
 *
 * Each tool's own supabase-integration.js is a thin ~15-line call into
 * this function (documentType, recordLabel, the field id holding that
 * tool's own already-generated reference number) — not a parallel
 * reimplementation per tool.
 */

// ?v= cache-busts these shared files — see js/toolkit/asset-version.js's
// header for why this must be a literal, not an imported constant, and
// which other files carry the same token. This one file's tokens cover
// all 17 project_documents tools that import it, not just this file.
import { gateOnSupabaseProject } from './supabase-project-context.js?v=20260804a';
import { wireSaveButton, refreshRecordList, escapeHtml } from './supabase-record-panel.js?v=20260804a';
import { DOCUMENT_TYPE_LABELS } from './document-type-labels.js';

const TABLE = 'project_documents';

/**
 * @param {Function} mountTool — the tool's own index.js init(), forwarded to gateOnSupabaseProject
 * @param {string} documentType — one of project_documents_document_type_check's values (019)
 * @param {string} recordLabel — e.g. 'Defect Report', used in "Defect Report DEF-001 saved."
 * @param {string} numberFieldId — the FormEngine state field holding this tool's own
 *   client-generated reference number (e.g. 'noticeNumber', 'swmsNumber') — recorded as
 *   project_documents.title, never assigned here.
 */
export async function initProjectDocumentIntegration({ mountTool, documentType, recordLabel, numberFieldId }) {
  const deriveTitle = (state) => String(state[numberFieldId] || '').trim() || recordLabel;

  await gateOnSupabaseProject({
    mountTool,
    onGated(project, mount) {
      try {
        mount(({ engine }) => {
          wireSaveButton({
            engine,
            project,
            table: TABLE,
            buildInsertPayload: (state, proj) => ({
              organisation_id: proj.organisation_id,
              project_id: proj.id,
              document_type: documentType,
              title: deriveTitle(state),
              form_data: state,
            }),
            buildUpdatePayload: (state) => ({
              title: deriveTitle(state),
              form_data: state,
            }),
            validate: (state) => {
              const hasAnyValue = Object.values(state).some((v) => String(v ?? '').trim());
              return hasAnyValue ? null : 'Fill in at least one field before saving.';
            },
            getRecordRef: (row) => row.title || recordLabel,
            recordLabel,
            friendlyError: friendlyDocumentError,
            onSaved: () => refreshDocumentList(project.id, documentType, recordLabel),
          });
        });
      } catch (err) {
        console.error(`[BIK] ${recordLabel} failed to mount:`, err);
      }

      refreshDocumentList(project.id, documentType, recordLabel);
    },
  });
}

function refreshDocumentList(projectId, documentType, recordLabel) {
  return refreshRecordList({
    table: TABLE,
    projectId,
    match: { document_type: documentType },
    selectColumns: 'id, title, status, created_at',
    emptyMessage: `No ${recordLabel.toLowerCase()}s saved to this project yet.`,
    renderRow: (row) => `
      <li class="sb-list-item">
        <span class="sb-list-item-number">${escapeHtml(row.title || recordLabel)}</span>
        <span class="status-pill status-pill--${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
      </li>
    `,
  });
}

/**
 * Renders a Project Hub "grouped" list (e.g. Safety: SWMS + Incident
 * Reports + ... mixed together) — a single panel across several
 * document_type values, each row labelled with its own type since the
 * list itself doesn't imply one. Used by project-hub.html only.
 */
export function refreshGroupedDocumentList({ idPrefix, projectId, documentTypes, emptyMessage }) {
  return refreshRecordList({
    idPrefix,
    table: TABLE,
    projectId,
    match: { document_type: documentTypes },
    selectColumns: 'id, document_type, title, status, created_at',
    emptyMessage,
    renderRow: (row) => `
      <li class="sb-list-item">
        <span class="sb-list-item-number">${escapeHtml(row.title || DOCUMENT_TYPE_LABELS[row.document_type] || row.document_type)}</span>
        <span class="sb-list-item-client">${escapeHtml(DOCUMENT_TYPE_LABELS[row.document_type] || row.document_type)}</span>
        <span class="status-pill status-pill--${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
      </li>
    `,
  });
}

/** Turns a raised database/PostgREST error into text safe to show a builder. */
function friendlyDocumentError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  return error.message || String(error);
}
