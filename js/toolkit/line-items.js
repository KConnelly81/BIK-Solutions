/**
 * LineItemsEditor — Dynamic Pricing Table
 *
 * Manages a dynamic line-items pricing table for Quote Builder and similar tools.
 * Renders inside the form panel and exposes getItems() / setItems() for data access.
 */

import { calcGST, calcTotal, formatAUD } from './calculator.js';

export class LineItemsEditor {

  /**
   * @param {HTMLElement} container — element to render into
   * @param {Object} [opts]
   * @param {Function} [opts.onChange] — fired whenever totals change
   * @param {number}   [opts.maxRows=30]
   * @param {boolean}  [opts.gstByDefault=true]
   */
  constructor(container, { onChange, maxRows = 30, gstByDefault = true } = {}) {
    this._container  = container;
    this._onChange   = onChange  || null;
    this._maxRows    = maxRows;
    this._gstDefault = gstByDefault;
    this._items      = [];
    this._el         = null;
  }

  // ── Public API ────────────────────────────────────────────────

  /** Render the line items table into the container. */
  mount() {
    this._el = document.createElement('div');
    this._el.className = 'line-items-editor';
    this._el.innerHTML = `
      <div class="line-items-header">
        <span class="line-items-title">Line Items</span>
        <button type="button" class="li-add-btn" aria-label="Add line item">+ Add item</button>
      </div>
      <div class="line-items-table-wrap">
        <table class="line-items-table" aria-label="Pricing line items">
          <thead>
            <tr>
              <th class="li-col-desc">Description</th>
              <th class="li-col-qty">Qty</th>
              <th class="li-col-unit">Unit</th>
              <th class="li-col-price">Unit price</th>
              <th class="li-col-gst">GST</th>
              <th class="li-col-total">Total</th>
              <th class="li-col-del" aria-label="Remove"></th>
            </tr>
          </thead>
          <tbody class="line-items-body"></tbody>
        </table>
      </div>
      <div class="line-items-totals">
        <div class="li-total-row"><span>Subtotal (excl. GST)</span><span class="li-subtotal">$0.00</span></div>
        <div class="li-total-row"><span>GST (10%)</span><span class="li-gst-total">$0.00</span></div>
        <div class="li-total-row li-total-row--grand"><span>Total (incl. GST)</span><span class="li-grand-total">$0.00</span></div>
      </div>`;

    this._container.appendChild(this._el);

    this._el.querySelector('.li-add-btn').addEventListener('click', () => this.addRow());
    this.addRow(); // start with one empty row
  }

  /** Add a new row, optionally pre-populated. */
  addRow(data = {}) {
    if (this._items.length >= this._maxRows) return;

    const item = {
      description: data.description || '',
      qty:         data.qty !== undefined ? data.qty : 1,
      unit:        data.unit || 'item',
      unitPrice:   data.unitPrice !== undefined ? data.unitPrice : '',
      gst:         data.gst !== undefined ? data.gst : this._gstDefault
    };
    this._items.push(item);
    this._renderRow(this._items.length - 1);
    this._updateTotals();
  }

  /** Replace all items (e.g. when restoring from history). */
  setItems(items) {
    this._items = [];
    const tbody = this._el?.querySelector('.line-items-body');
    if (tbody) tbody.innerHTML = '';
    for (const item of (items || [])) {
      this.addRow(item);
    }
    if (this._items.length === 0) this.addRow();
  }

  /**
   * Get current line items with computed totals.
   * @returns {{ items: Array, subtotal: number, gst: number, total: number }}
   */
  getItems() {
    const items = this._items.map(it => ({
      description: it.description,
      qty:         parseFloat(it.qty) || 0,
      unit:        it.unit || 'item',
      unitPrice:   parseFloat(it.unitPrice) || 0,
      gst:         !!it.gst,
      lineTotal:   this._lineTotal(it),
      lineGST:     this._lineGST(it)
    }));

    let subtotal = 0, gstTotal = 0;
    for (const it of items) {
      subtotal  += it.lineTotal;
      gstTotal  += it.lineGST;
    }
    return {
      items,
      subtotal:   Math.round(subtotal  * 100) / 100,
      gst:        Math.round(gstTotal  * 100) / 100,
      total:      Math.round((subtotal + gstTotal) * 100) / 100
    };
  }

  // ── Private ───────────────────────────────────────────────────

  _lineTotal(item) {
    const qty = parseFloat(item.qty) || 0;
    const up  = parseFloat(item.unitPrice) || 0;
    return Math.round(qty * up * 100) / 100;
  }

  _lineGST(item) {
    if (!item.gst) return 0;
    return Math.round(this._lineTotal(item) * 0.1 * 100) / 100;
  }

  _renderRow(index) {
    const tbody = this._el.querySelector('.line-items-body');
    const item  = this._items[index];

    const tr = document.createElement('tr');
    tr.className  = 'li-row';
    tr.dataset.idx = String(index);

    tr.innerHTML = `
      <td class="li-col-desc">
        <input type="text" class="li-input li-input--desc" placeholder="Description of work or material"
          value="${esc(item.description)}" aria-label="Description" />
      </td>
      <td class="li-col-qty">
        <input type="number" class="li-input li-input--qty" min="0" step="any"
          value="${item.qty}" aria-label="Quantity" inputmode="decimal" />
      </td>
      <td class="li-col-unit">
        <input type="text" class="li-input li-input--unit" placeholder="item"
          value="${esc(item.unit)}" aria-label="Unit" />
      </td>
      <td class="li-col-price">
        <input type="number" class="li-input li-input--price" min="0" step="0.01"
          value="${item.unitPrice}" placeholder="0.00" aria-label="Unit price" inputmode="decimal" />
      </td>
      <td class="li-col-gst">
        <label class="li-gst-label">
          <input type="checkbox" class="li-gst-check" ${item.gst ? 'checked' : ''} aria-label="Apply GST" />
          <span>10%</span>
        </label>
      </td>
      <td class="li-col-total">
        <span class="li-line-total">${formatAUD(this._lineTotal(item))}</span>
      </td>
      <td class="li-col-del">
        <button type="button" class="li-del-btn" aria-label="Remove this line item">✕</button>
      </td>`;

    tbody.appendChild(tr);
    this._wireRow(tr, index);
  }

  _wireRow(tr, index) {
    const update = () => {
      const desc    = tr.querySelector('.li-input--desc');
      const qty     = tr.querySelector('.li-input--qty');
      const unit    = tr.querySelector('.li-input--unit');
      const price   = tr.querySelector('.li-input--price');
      const gstChk  = tr.querySelector('.li-gst-check');
      const totalEl = tr.querySelector('.li-line-total');

      const item        = this._items[index];
      item.description  = desc?.value  || '';
      item.qty          = qty?.value   || '0';
      item.unit         = unit?.value  || 'item';
      item.unitPrice    = price?.value || '0';
      item.gst          = gstChk?.checked ?? true;

      if (totalEl) totalEl.textContent = formatAUD(this._lineTotal(item));
      this._updateTotals();
    };

    tr.querySelectorAll('.li-input, .li-gst-check').forEach(el => {
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });

    tr.querySelector('.li-del-btn').addEventListener('click', () => {
      this._removeRow(index);
    });
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
    const { subtotal, gst, total } = this.getItems();
    this._el.querySelector('.li-subtotal').textContent   = formatAUD(subtotal);
    this._el.querySelector('.li-gst-total').textContent  = formatAUD(gst);
    this._el.querySelector('.li-grand-total').textContent = formatAUD(total);
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
