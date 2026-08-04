/**
 * Instruction to Proceed — Supabase Integration
 *
 * Thin per-tool wiring only — all shared behaviour (project gating, save
 * panel, project's document list) lives in
 * js/toolkit/supabase-document-integration.js, reused by all 17 simple
 * document tools sharing public.project_documents (019).
 */

import { initProjectDocumentIntegration } from '../../toolkit/supabase-document-integration.js';

export function initInstructionToProceedSupabaseIntegration(mountTool) {
  return initProjectDocumentIntegration({
    mountTool,
    documentType: 'instruction_to_proceed',
    recordLabel: 'Instruction to Proceed',
    numberFieldId: 'itpNumber',
  });
}
