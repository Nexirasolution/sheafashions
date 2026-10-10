export function getSizeStock(variant, size) {
  if (!variant || !size) return 0;
  const match = variant.sizes?.find((s) => s.size === size);
  return match?.stock || 0;
}

export function getVariantTotalStock(variant) {
  if (!variant) return 0;
  return variant.sizes?.reduce((sum, s) => sum + (s.stock || 0), 0) || 0;
}

export function getDefaultAvailableSizeEntry(variant) {
  if (!variant) return null;
  const inStock = variant.sizes?.find((s) => (s.stock || 0) > 0);
  return inStock || variant.sizes?.[0] || null;
}

export function isProductInStock(product) {
  const variant = product?.variants?.[0];
  return getVariantTotalStock(variant) > 0;
}

// Pant/shawl add-ons live on the product itself, not per-variant — these
// mirror the variant-size helpers above for that shape.
export function getAddonStock(options, optionId) {
  if (!optionId) return Infinity; // "None" selected — not a stock constraint
  const match = options?.find((o) => String(o._id) === String(optionId));
  return match?.stock || 0;
}

export function getAddonOption(options, optionId) {
  if (!optionId) return null;
  return options?.find((o) => String(o._id) === String(optionId)) || null;
}

// Combined available stock for a chosen size + pant + shawl combination —
// whichever constraint is tightest caps the purchasable quantity. Used on
// the product page to clamp qty and disable "Add to Cart" appropriately.
export function getCombinedStock(variant, size, { pantOptions, pantOptionId, shawlOptions, shawlOptionId } = {}) {
  const caps = [getSizeStock(variant, size)];
  if (pantOptionId) caps.push(getAddonStock(pantOptions, pantOptionId));
  if (shawlOptionId) caps.push(getAddonStock(shawlOptions, shawlOptionId));
  return Math.min(...caps);
}