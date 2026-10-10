// lib/cartWeight.js  (FULL FILE)
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import { productWeight, comboWeightGrams } from '@/lib/weight';
import { isFreeShippingFor } from '@/lib/freeShipping';

// Computes the SHIPPABLE cart weight from the DATABASE (never trust client weights).
// Products AND combos use the same rule:
//   manual weight if set (> 0), else pieces x global weightPerPiece.
//
// Lines with free shipping (for the customer's `state`) are skipped, so they
// add nothing to the billable weight. This applies to products AND combos
// (multi-product bundles and color packs, using the combo's own flags).
//
// items: cart lines { productId, comboId, isCombo, qty, packDetails }
// weightPerPiece: global fallback (grams) from Settings
// state: customer's delivery state ('' if not chosen yet)
//
// Returns { totalGrams, totalPieces, usedFallback, allFree }
//   totalPieces = paid pieces only; allFree = every line ships free.
export async function computeCartWeight(items = [], weightPerPiece = 0, state = '') {
  const isComboLine = (i) => i.isCombo || i.comboId;

  const productIds = [
    ...new Set(items.filter((i) => !isComboLine(i) && i.productId).map((i) => String(i.productId))),
  ];
  const comboIds = [
    ...new Set(items.filter((i) => isComboLine(i) && i.comboId).map((i) => String(i.comboId))),
  ];

  const [products, combos] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select('weight freeShipping freeShippingStates').lean()
      : [],
    comboIds.length
      ? Combo.find({ _id: { $in: comboIds } })
          // freeShipping + freeShippingStates are required for the free-shipping check
          .select('type weight pieceWeight piecesPerCombo products baseProduct freeShipping freeShippingStates')
          .populate('products.product', 'weight')
          .populate('baseProduct', 'weight')
          .lean()
      : [],
  ]);

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const comboMap = new Map(combos.map((c) => [String(c._id), c]));

  let totalGrams = 0;
  let totalPieces = 0;
  let usedFallback = false;
  let paidLines = 0;
  let countedLines = 0;

  for (const line of items) {
    const qty = Math.max(0, Number(line.qty) || 0);
    if (qty < 1) continue;
    countedLines++;

    let unitGrams = 0;
    let unitPieces = 1;

    if (isComboLine(line)) {
      const combo = comboMap.get(String(line.comboId));
      // Free-shipping combo / pack: contributes no billable weight
      if (isFreeShippingFor(combo, state)) continue;

      if (combo) {
        const packSize = Number(line.packDetails?.packSize) || 0;
        unitGrams = comboWeightGrams(combo, packSize);
        unitPieces =
          combo.type === 'color-pack'
            ? packSize || 1
            : Number(combo.piecesPerCombo) || combo.products?.length || 1;
      }
    } else {
      const product = productMap.get(String(line.productId));
      // Free-shipping product: contributes no billable weight
      if (isFreeShippingFor(product, state)) continue;
      unitGrams = productWeight(product);
    }

    paidLines++;

    // No manual weight set -> fall back to pieces x global weight per piece
    if (unitGrams <= 0) {
      unitGrams = unitPieces * weightPerPiece;
      usedFallback = true;
    }

    totalGrams += unitGrams * qty;
    totalPieces += unitPieces * qty;
  }

  return {
    totalGrams,
    totalPieces,
    usedFallback,
    allFree: countedLines > 0 && paidLines === 0,
  };
}