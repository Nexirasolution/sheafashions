// Manual weights, all in GRAMS. 0 means "not set" — callers should then fall
// back to their existing weight logic (e.g. pieces x default weight).

export function productWeight(product) {
  const w = Number(product?.weight);
  return w > 0 ? w : 0;
}

// Weight of ONE combo (multi-product) or ONE pack (color-pack).
// packSize is only needed for color packs (number of pieces in the chosen pack).
export function comboWeightGrams(combo, packSize = 0) {
  if (!combo) return 0;

  if (combo.type === 'color-pack') {
    // manual per-piece weight on the combo wins, else the base product's weight
    const perPiece = Number(combo.pieceWeight) > 0
      ? Number(combo.pieceWeight)
      : productWeight(combo.baseProduct);
    return perPiece * (Number(packSize) || 0);
  }

  // multi-product: manual total wins, else sum of the products' own weights
  if (Number(combo.weight) > 0) return Number(combo.weight);
  return (combo.products || []).reduce((sum, p) => sum + productWeight(p.product), 0);
}

// Total grams for a list of cart lines: [{ unitWeight, qty }]
export function totalWeightGrams(lines = []) {
  return lines.reduce((sum, l) => sum + (Number(l.unitWeight) || 0) * (Number(l.qty) || 0), 0);
}