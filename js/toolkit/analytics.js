/**
 * Analytics — BIK Document Intelligence Engine
 * Privacy-conscious event stubs. No project content is transmitted.
 * Only interaction events are tracked (what happened, not what was entered).
 *
 * HOW TO WIRE REAL ANALYTICS:
 *   Replace the body of `emit()` with your analytics call, e.g.:
 *     gtag('event', event.name, event.props);         // Google Analytics 4
 *     posthog.capture(event.name, event.props);       // PostHog
 *     fathom.trackEvent(event.name);                  // Fathom
 *
 * IMPORTANT: Never pass `data` (form state) to analytics events.
 * Only pass the toolId, event name, and non-sensitive metadata.
 *
 * Event catalogue:
 *   tool_opened          — user lands on the tool page
 *   document_generated   — user clicks Generate and receives a document
 *   pdf_downloaded       — user clicks Save PDF (print dialog opened)
 *   document_printed     — alias for pdf_downloaded
 *   text_copied          — user clicks Copy Text
 *   draft_saved          — autosave fires successfully
 *   draft_restored       — user restores a saved draft
 *   draft_deleted        — user explicitly deletes a draft
 *   form_cleared         — user clears all fields
 *   validation_error     — generate attempted with missing required fields
 */

/** @type {boolean} — set true to log events to console during development */
const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

/**
 * Emit an analytics event.
 * Safe to call before analytics SDK loads — events are silently dropped.
 *
 * @param {string} toolId   — e.g. 'variation-notice'
 * @param {string} name     — event name from catalogue above
 * @param {Object} [props]  — non-sensitive metadata only (counts, flags, not text)
 */
export function emit(toolId, name, props = {}) {
  const event = {
    tool: toolId,
    name,
    props: { ...props, ts: Date.now() }
  };

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('[BIK Analytics]', event);
  }

  // ── ANALYTICS_INTEGRATION_POINT ──────────────────────────────────────────
  // Uncomment and adapt ONE of the following when ready:
  //
  // Google Analytics 4:
  //   if (typeof gtag === 'function') {
  //     gtag('event', `bik_${name}`, { tool_id: toolId, ...props });
  //   }
  //
  // PostHog:
  //   if (typeof posthog !== 'undefined') {
  //     posthog.capture(`bik_${name}`, { tool_id: toolId, ...props });
  //   }
  //
  // Fathom:
  //   if (typeof fathom !== 'undefined') {
  //     fathom.trackEvent(`bik_${toolId}_${name}`);
  //   }
  // ─────────────────────────────────────────────────────────────────────────
}

/**
 * Convenience wrapper — creates a bound emitter for a specific tool.
 * Usage:
 *   const track = createTracker('variation-notice');
 *   track('document_generated');
 *
 * @param {string} toolId
 * @returns {Function}
 */
export function createTracker(toolId) {
  return (name, props) => emit(toolId, name, props);
}
