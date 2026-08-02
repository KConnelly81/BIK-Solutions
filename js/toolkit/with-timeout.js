/**
 * With Timeout (Sprint 4 — hotfix follow-up)
 *
 * Races a promise against a timeout so an operation that never settles —
 * neither resolves nor rejects — still lets its caller's `await` continue,
 * instead of hanging forever. Built for the Supabase queries in
 * supabase-record-panel.js and supabase-project-context.js: the try/catch
 * added for PR #7's confirmed defect only helps when a query *rejects*.
 * A query that never settles at all (a stalled RLS evaluation, an
 * exhausted connection pool, a stuck request with no network-level error)
 * skips both the try and the catch, leaving whatever depends on it — a
 * loading state, a gate — stuck indefinitely with no error ever surfaced.
 *
 * Always clears its own timer once either side settles, so a request that
 * finishes well within the timeout doesn't leave a dangling timer.
 */

/**
 * @param {Promise<any>} promise
 * @param {number} ms
 * @param {string} [message]
 * @returns {Promise<any>} settles exactly as `promise` would have if it
 *   does so within `ms`; otherwise rejects with an Error(message).
 */
export function withTimeout(promise, ms, message = 'Request timed out.') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}
