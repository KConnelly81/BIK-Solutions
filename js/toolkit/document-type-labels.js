/**
 * Shared document_type vocabulary for public.project_documents (019) — the
 * one table behind all 17 simple document-generator tools (Contract
 * Termination, Defect Report, Delay Notice, EOT Claim, Handover Checklist,
 * Incident Report, Inspection Checklist, Instruction to Proceed,
 * Non-Conformance Report, Notice to Show Cause, Payment Reminder, Practical
 * Completion, Scope of Works, Site Diary, Subcontractor Agreement, SWMS,
 * Toolbox Talk). Single source of truth for the human-readable label of
 * each type, used by every tool's own supabase-integration.js and by
 * Project Hub's taxonomy-grouped lists — one place to keep in sync with
 * the database CHECK constraint (019_create_project_documents.sql), not
 * copy-pasted per tool.
 */
export const DOCUMENT_TYPE_LABELS = {
  contract_termination:    'Contract Termination Notice',
  defect_report:           'Defect Report',
  delay_notice:            'Delay Notice',
  eot_claim:               'EOT Claim',
  handover_checklist:      'Handover Checklist',
  incident_report:         'Incident Report',
  inspection_checklist:    'Inspection Checklist',
  instruction_to_proceed:  'Instruction to Proceed',
  non_conformance_report:  'Non-Conformance Report',
  notice_to_show_cause:    'Notice to Show Cause',
  payment_reminder:        'Payment Reminder',
  practical_completion:    'Practical Completion Notice',
  scope_of_works:          'Scope of Works',
  site_diary:              'Site Diary Entry',
  subcontractor_agreement: 'Subcontractor Agreement',
  swms:                    'SWMS',
  toolbox_talk:            'Toolbox Talk',
};

/** Project Hub taxonomy grouping (Closed Beta Preparation's Commercial / Site / Safety
 *  split) — which document types appear in which grouped list. Quotes, Progress Claims,
 *  and Variation Notices already have their own dedicated panels and are not repeated here. */
export const DOCUMENT_TYPE_GROUPS = {
  commercial: ['contract_termination', 'payment_reminder', 'subcontractor_agreement'],
  site: [
    'defect_report', 'delay_notice', 'eot_claim', 'handover_checklist',
    'practical_completion', 'scope_of_works', 'instruction_to_proceed',
    'notice_to_show_cause', 'site_diary',
  ],
  safety: ['incident_report', 'inspection_checklist', 'non_conformance_report', 'swms', 'toolbox_talk'],
};
