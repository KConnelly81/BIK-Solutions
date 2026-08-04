/**
 * Non-Conformance Report — Supabase Integration
 *
 * Thin per-tool wiring only — all shared behaviour (project gating, save
 * panel, project's document list) lives in
 * js/toolkit/supabase-document-integration.js, reused by all 17 simple
 * document tools sharing public.project_documents (019).
 */

import { initProjectDocumentIntegration } from '../../toolkit/supabase-document-integration.js';

export function initNonConformanceReportSupabaseIntegration(mountTool) {
  return initProjectDocumentIntegration({
    mountTool,
    documentType: 'non_conformance_report',
    recordLabel: 'Non-Conformance Report',
    numberFieldId: 'ncrNumber',
  });
}
