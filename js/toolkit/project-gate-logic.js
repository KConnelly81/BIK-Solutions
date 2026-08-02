/**
 * Project Gate Logic (Sprint 4 — bugfix follow-up)
 *
 * Pure decision logic for gateOnSupabaseProject()'s (supabase-project-
 * context.js) terminal outcomes, given the `?project=` URL param and the
 * settled outcome of the project lookup query. Extracted for the same
 * reason as record-list-logic.js's determineListOutcome(): the original
 * gate had the identical missing-try/catch shape as the bug found in
 * refreshRecordList() during PR #7's live testing — a rejected project
 * lookup, rather than one resolved with {data, error}, would have skipped
 * past the code that reveals the error state, leaving the page stuck on
 * its initial loading screen forever. Not the confirmed defect (the gate
 * worked correctly during that test — the rest of the page loaded), but
 * the same defect class in the same Sprint 4 file family, fixed alongside
 * it rather than left as a latent duplicate.
 */

/**
 * @param {Object} outcome
 * @param {string|null} outcome.projectId — the `?project=` URL param, or null/empty if absent
 * @param {Object|null} [outcome.project] — the loaded project row, if the query resolved successfully and found one
 * @param {any} [outcome.error] — a Supabase/PostgREST error object, if the query resolved with an error
 * @param {any} [outcome.thrown] — a caught exception, if the query rejected/threw instead of resolving
 * @returns {{ ok: true } | { ok: false, reason: 'missing-project-id'|'not-found'|'query-failed', detail?: any }}
 */
export function determineGateOutcome({ projectId, project, error, thrown } = {}) {
  if (!projectId) {
    return { ok: false, reason: 'missing-project-id' };
  }
  if (thrown) {
    return { ok: false, reason: 'query-failed', detail: thrown };
  }
  if (error) {
    return { ok: false, reason: 'query-failed', detail: error };
  }
  if (!project) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true };
}
