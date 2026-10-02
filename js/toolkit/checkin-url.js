/**
 * Pure URL-building helper for the "Show Site QR" link on attendance.html.
 *
 * Deliberately has zero imports (not even from attendance-rpc.js, which
 * pulls in the Supabase client and therefore a browser `window` global at
 * module-load time) so this can be unit tested in plain Node — see
 * __tests__/checkin-url.test.js.
 *
 * Previous version built this by string-replacing 'attendance.html' with
 * 'checkin.html' in location.pathname, which silently produced the wrong
 * URL whenever this page was reached at a path missing that literal
 * extension (e.g. a host that strips .html from URLs). Building from the
 * origin directly has no such dependency on how this page itself was
 * addressed.
 */
export function buildCheckinUrl(origin, token) {
  return `${origin}/checkin.html?t=${token}`;
}
