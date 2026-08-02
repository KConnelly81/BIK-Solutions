/**
 * ScheduleOfValuesEditor — Progress Claim Schedule of Values (Sprint 5a)
 *
 * Structured schedule editor for Progress Claim, mirroring LineItemsEditor's
 * shape (line-items.js) but with the columns progress_claim_line_items
 * (015) actually has: description, contract value, previously claimed,
 * this claim (as a % of contract value, or a direct dollar amount),
 * claimed to date, remaining value — the AS4000/AS2124-style schedule
 * tradies already expect, not a generic pricing table. Client-side totals
 * here are for the live preview only; the database independently computes
 * and owns the authoritative figures on every insert
 * (compute_progress_claim_line_item_amounts(), 015) — this editor's math
 * is deliberately kept in exact agreement with that trigger's formula so
 * the preview never disagrees with what gets saved.
 */

import { formatAUD } from './calculator.js';

export class ScheduleOfValuesEditor {

  /**
   * @param {HTMLElement} container
   * @param {Object} [opts]
   * @param {Function} [opts.onChange]
   * @param {number}   [opts.maxRows=50]
   */
  constructor(container, { onChange, maxRows = 50 } = {}) {
    this._container = container;
    this._onChange = onChange || null;
    this._maxRows = maxRows;
    this._items = [];
    this._el = null;
  }

  mount() {
    this._el = document.createElement('div');
    this._el.className = 'line-items-editor';
    this._el.innerHTML = `
      <div class="line-items-header">
        <span class="line-items-title">Schedule of Values</span>
        <button type="button" class="li-add-btn" aria-label="Add schedule item">+ Add item</button>
      </div>
      <div class="line-items-table-wrap">
        <table class="line-items-table" aria-label="Schedule of values">
          <thead>
            <tr>
              <th class="li-col-desc">Description</th>
              <th class="li-col-price">Contract value</th>
              <th class="li-col-price">Previously claimed</th>
              <th class="li-col-qty">This claim %</th>
              <th class="li-col-total">This claim $</th>
              <th class="li-col-total">Claimed to date</th>
              <th class="li-col-total">Remaining</th>
              <th class="li-col-del" aria-label="Remove"></th>
            </tr>
          </thead>
          <tbody class="line-items-body"></tbody>
        </table>
      </div>
      <div class="line-items-totals">
        <div class="li-total-row"><span>Total contract value</span><span class="li-subtotal">$0.00</span></div>
        <div class="li-total-row"><span>Total this claim</span><span class="li-gst-total">$0.00</span></div>
        <div class="li-total-row li-total-row--grand"><span>Total claimed to date</span><span class="li-grand-total">$0.00</span></div>
      </div>`;

    this._container.appendChild(this._el);
    this._el.querySelector('.li-add-btn').addEventListener('click', () => this.addRow());
    this.addRow();
  }

  addRow(data = {}) {
    if (this._items.length >= this._maxRows) return;
    const item = {
      description: data.description || '',
      contractValue: data.contractValue !== undefined ? data.contractValue : '',
      previouslyClaimed: data.previouslyClaimed !== undefined ? data.previouslyClaimed : 0,
      thisClaimPercent: data.thisClaimPercent !== undefined ? data.thisClaimPercent : ''
    };
    this._items.push(item);
    this._renderRow(this._items.length - 1);
    this._updateTotals();
  }

  setItems(items) {
    this._items = [];
    const tbody = this._el?.querySelector('.line-items-body');
    if (tbody) tbody.innerHTML = '';
    for (const item of (items || [])) this.addRow(item);
    if (this._items.length === 0) this.addRow();
  }

  /**
   * @returns {{ items: Array, contractValueTotal: number, thisClaimTotal: number, claimedToDateTotal: number }}
   */
  getItems() {
    const items = this._items.map((it) => {
      const contractValue = parseFloat(it.contractValue) || 0;
      const previouslyClaimed = parseFloat(it.previouslyClaimed) || 0;
      const thisClaimCents = this._thisClaimCents(it);
      const claimedToDate = Math.round((previouslyClaimed * 100 + thisClaimCents)) / 100;
      return {
        description: it.description,
        contractValue,
        previouslyClaimed,
        thisClaimPercent: it.thisClaimPercent === '' ? null : parseFloat(it.thisClaimPercent),
        thisClaim: Math.round(thisClaimCents) / 100,
        claimedToDate,
        remaining: Math.round((contractValue * 100 - claimedToDate * 100)) / 100
      };
    });

    let contractValueTotal = 0, thisClaimTotal = 0, claimedToDateTotal = 0;
    for (const it of items) {
      contractValueTotal += it.contractValue;
      thisClaimTotal += it.thisClaim;
      claimedToDateTotal += it.claimedToDate;
    }
    return {
      items,
      contractValueTotal: Math.round(contractValueTotal * 100) / 100,
      thisClaimTotal: Math.round(thisClaimTotal * 100) / 100,
      claimedToDateTotal: Math.round(claimedToDateTotal * 100) / 100
    };
  }

  // ── Private ───────────────────────────────────────────────────

  /** cents, matching compute_progress_claim_line_item_amounts()'s round(contract_value_cents * this_claim_percent / 100). */
  _thisClaimCents(item) {
    if (item.thisClaimPercent === '' || item.thisClaimPercent == null) return 0;
    const contractValueCents = Math.round((parseFloat(item.contractValue) || 0) * 100);
    const pct = parseFloat(item.thisClaimPercent) || 0;
    return Math.round(contractValueCents * pct / 100);
  }

  _renderRow(index) {
    const tbody = this._el.querySelector('.line-items-body');
    const item = this._items[index];
    const thisClaim = Math.round(this._thisClaimCents(item)) / 100;
    const previouslyClaimed = parseFloat(item.previouslyClaimed) || 0;
    const contractValue = parseFloat(item.contractValue) || 0;
    const claimedToDate = previouslyClaimed + thisClaim;
    const remaining = contractValue - claimedToDate;

    const tr = document.createElement('tr');
    tr.className = 'li-row';
    tr.dataset.idx = String(index);
    tr.innerHTML = `
      <td class="li-col-desc">
        <input type="text" class="li-input li-input--desc" placeholder="e.g. Foundations, Framing, Roofing"
          value="${esc(item.description)}" aria-label="Description" />
      </td>
      <td class="li-col-price">
        <input type="number" class="li-input li-input--contract" min="0" step="0.01"
          value="${item.contractValue}" placeholder="0.00" aria-label="Contract value" inputmode="decimal" />
      </td>
      <td class="li-col-price">
        <input type="number" class="li-input li-input--prev" min="0" step="0.01"
          value="${item.previouslyClaimed}" placeholder="0.00" aria-label="Previously claimed" inputmode="decimal" />
      </td>
      <td class="li-col-qty">
        <input type="number" class="li-input li-input--percent" min="0" max="100" step="0.01"
          value="${item.thisClaimPercent}" placeholder="0" aria-label="This claim percent" inputmode="decimal" />
      </td>
      <td class="li-col-total"><span class="li-line-total li-this-claim">${formatAUD(thisClaim)}</span></td>
      <td class="li-col-total"><span class="li-line-total li-claimed-to-date">${formatAUD(claimedToDate)}</span></td>
      <td class="li-col-total"><span class="li-line-total li-remaining">${formatAUD(remaining)}</span></td>
      <td class="li-col-del"><button type="button" class="li-del-btn" aria-label="Remove this schedule item">✕</button></td>`;

    tbody.appendChild(tr);
    this._wireRow(tr, index);
  }

  _wireRow(tr, index) {
    const update = () => {
      const desc = tr.querySelector('.li-input--desc');
      const contract = tr.querySelector('.li-input--contract');
      const prev = tr.querySelector('.li-input--prev');
      const percent = tr.querySelector('.li-input--percent');

      const item = this._items[index];
      item.description = desc?.value || '';
      item.contractValue = contract?.value || '0';
      item.previouslyClaimed = prev?.value || '0';
      item.thisClaimPercent = percent?.value ?? '';

      const thisClaim = Math.round(this._thisClaimCents(item)) / 100;
      const previouslyClaimed = parseFloat(item.previouslyClaimed) || 0;
      const contractValue = parseFloat(item.contractValue) || 0;
      const claimedToDate = previouslyClaimed + thisClaim;
      const remaining = contractValue - claimedToDate;

      tr.querySelector('.li-this-claim').textContent = formatAUD(thisClaim);
      tr.querySelector('.li-claimed-to-date').textContent = formatAUD(claimedToDate);
      tr.querySelector('.li-remaining').textContent = formatAUD(remaining);

      this._updateTotals();
    };

    tr.querySelectorAll('.li-input').forEach((el) => {
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });
    tr.querySelector('.li-del-btn').addEventListener('click', () => this._removeRow(index));
  }

  _removeRow(index) {
    this._items.splice(index, 1);
    const tbody = this._el.querySelector('.line-items-body');
    tbody.innerHTML = '';
    this._items.forEach((_, i) => this._renderRow(i));
    if (this._items.length === 0) this.addRow();
    this._updateTotals();
  }

  _updateTotals() {
    const { contractValueTotal, thisClaimTotal, claimedToDateTotal } = this.getItems();
    this._el.querySelector('.li-subtotal').textContent = formatAUD(contractValueTotal);
    this._el.querySelector('.li-gst-total').textContent = formatAUD(thisClaimTotal);
    this._el.querySelector('.li-grand-total').textContent = formatAUD(claimedToDateTotal);
    this._onChange?.();
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
