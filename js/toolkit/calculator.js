/**
 * Calculator — BIK Document Intelligence Engine
 * Pure functions for currency, GST and date calculations.
 * No DOM access, no side effects, fully testable in isolation.
 *
 * GST DISCLAIMER: Calculations are indicative only and are not tax advice.
 * Australian GST rate is 10%. Users must verify their own tax obligations.
 */

export const GST_RATE = 0.1; // 10% — Work Choices Act 1999 / A New Tax System (GST) Act 1999

/**
 * Calculate GST amount from a GST-exclusive cost.
 * Returns 0 when cost is invalid or non-positive.
 * @param {number|string} costExclGST
 * @param {boolean} [applicable=true]
 * @returns {number}
 */
export function calcGST(costExclGST, applicable = true) {
  if (!applicable) return 0;
  const n = parseFloat(costExclGST);
  if (!isFinite(n) || n < 0) return 0;
  return round2(n * GST_RATE);
}

/**
 * Total amount including GST.
 * @param {number|string} costExclGST
 * @param {boolean} [applicable=true]
 * @returns {number}
 */
export function calcTotal(costExclGST, applicable = true) {
  const n = parseFloat(costExclGST);
  if (!isFinite(n) || n < 0) return 0;
  return round2(n + calcGST(n, applicable));
}

/**
 * Format a number as Australian dollars.
 * @param {number|string} n
 * @returns {string}  e.g. "$1,250.00"
 */
export function formatAUD(n) {
  const num = parseFloat(n);
  if (!isFinite(num)) return '$0.00';
  return num.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format an ISO date string (YYYY-MM-DD) as a long Australian date.
 * @param {string} iso
 * @returns {string}  e.g. "15 July 2026"
 */
export function formatDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Return today's date as YYYY-MM-DD in the local timezone.
 * @returns {string}
 */
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Add N calendar days to an ISO date string.
 * @param {string} iso  — base date (YYYY-MM-DD)
 * @param {number} days — days to add
 * @returns {string}    — new date as YYYY-MM-DD
 */
export function addDays(iso, days) {
  if (!iso || !days) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + parseInt(days, 10));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Round to 2 decimal places, avoiding floating point drift. */
function round2(n) {
  return Math.round(n * 100) / 100;
}
