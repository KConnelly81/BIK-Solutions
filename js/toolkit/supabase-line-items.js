/**
 * Supabase Line Items Sync (Sprint 5a)
 *
 * Generic "replace this parent record's line items with the current set"
 * helper for any Supabase-backed tool with a typed line-items child table
 * (quote_line_items, progress_claim_line_items) — the database owns the
 * calculated columns on every row (see 012/015's compute_*_line_item_
 * amounts() triggers); this module never computes a total itself, it only
 * ships the client-entered fields.
 *
 * Delete-then-reinsert, not a diff/patch: line items have no identity a
 * user would recognise or need preserved across saves (no id is ever shown
 * in the editor), and `position` is reassigned fresh from array order on
 * every call anyway. This is only reachable while the parent is draft —
 * once issued, enforce_*_line_item_draft_only() (012/015) rejects both the
 * DELETE and the INSERT with the same "cannot be changed once issued"
 * error a plain edit would get, so this function surfaces that rejection
 * exactly like any other save error rather than needing special handling.
 */

import { supabase } from '../supabase/client.js';

/**
 * @param {Object} cfg
 * @param {string} cfg.table            — e.g. 'quote_line_items'
 * @param {string} cfg.parentColumn     — e.g. 'quote_id'
 * @param {string} cfg.parentId
 * @param {Array}  cfg.items            — current in-memory items (from LineItemsEditor.getItems().items)
 * @param {(item: Object, index: number) => Object} cfg.mapItemToRow —
 *   builds one row's insertable columns (excluding cfg.parentColumn, added
 *   here) from one in-memory item and its 0-based position.
 * @returns {Promise<Object[]>} the freshly inserted rows (empty array if `items` was empty)
 */
export async function syncLineItems({ table, parentColumn, parentId, items, mapItemToRow }) {
  const { error: deleteError } = await supabase.from(table).delete().eq(parentColumn, parentId);
  if (deleteError) throw deleteError;

  if (!items || items.length === 0) return [];

  const rows = items.map((item, index) => ({
    ...mapItemToRow(item, index),
    [parentColumn]: parentId
  }));

  const { data, error: insertError } = await supabase.from(table).insert(rows).select();
  if (insertError) throw insertError;
  return data;
}
