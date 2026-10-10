// Pieces contained in ONE unit of a combo cart line (client side).
// - multi-product: admin-set piecesPerCombo, else number of products
// - color-pack:    the selected pack option's size (e.g. 5 or 10)
export function piecesPerUnit(combo, packSize) {
  if (!combo) return 1;
  if (combo.type === 'color-pack') {
    return Number(packSize) || 1;
  }
  return Number(combo.piecesPerCombo) || combo.products?.length || 1;
}

// Total physical pieces in a list of cart lines.
// Normal products have no `pieces` field, so they count as 1 each.
export function totalPiecesOf(items) {
  return items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.pieces) || 1), 0);
}

// SERVER SIDE: total pieces for one order line, computed from the DB combo
// (never trust `pieces` from the client).
// Returns null if a color-pack line references a pack size that doesn't exist.
export function piecesForOrderLine(combo, item) {
  const qty = Number(item.qty) || 0;
  if (!item.isCombo || !combo) return qty;

  if (combo.type === 'color-pack') {
    const pack = (combo.packOptions || []).find(
      (p) => Number(p.size) === Number(item.packDetails?.packSize)
    );
    if (!pack) return null;
    return qty * Number(pack.size);
  }

  const perCombo = Number(combo.piecesPerCombo) || combo.products?.length || 1;
  return qty * perCombo;
}