/**
 * Record List Logic (Sprint 4 — bugfix follow-up)
 *
 * Pure decision logic for what a "records for this project" list panel
 * should render, given the settled outcome of the Supabase query that
 * feeds it. Extracted out of refreshRecordList() (supabase-record-panel.js)
 * specifically so the branching itself is unit testable without a browser
 * or a live Supabase project — this is the exact logic class that had a
 * real bug (PR #7 live testing): refreshRecordList() awaited its query
 * with no try/catch, so a rejected promise (rather than a resolved
 * {data, error} result) skipped straight past the code that would have
 * cleared the loading state, leaving the panel stuck on "Loading…"
 * forever with no error shown.
 *
 * This function is called only once the query has definitely settled one
 * way or another (resolved with data, resolved with an error, or thrown) —
 * there is deliberately no "still loading" outcome here; that's the
 * caller's concern before this is ever invoked.
 */

/**
 * @param {Object} outcome
 * @param {any[]} [outcome.data] — rows, if the query resolved successfully
 * @param {any} [outcome.error] — a Supabase/PostgREST error object, if the query resolved with an error
 * @param {any} [outcome.thrown] — a caught exception, if the query rejected/threw instead of resolving
 * @returns {{ state: 'error'|'empty'|'populated', rows: any[] }}
 */
export function determineListOutcome({ data, error, thrown } = {}) {
  if (thrown || error) {
    return { state: 'error', rows: [] };
  }
  if (!data || data.length === 0) {
    return { state: 'empty', rows: [] };
  }
  return { state: 'populated', rows: data };
}
