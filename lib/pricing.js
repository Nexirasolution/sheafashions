// Per-size pricing helpers (shared by API routes).
// A size can carry its own `price`. If it's blank/0, the variant's price is used.

export function effectiveSizePrice(variant, size) {
  const sizePrice = Number(size?.price);
  return sizePrice > 0 ? sizePrice : Number(variant?.price) || 0;
}

// lib/pricing.js  (NEW FILE)
// Single source of truth for a product line's unit price.
// A size can have its own price; null/0 means "use the variant price".
// Use this on the product page (add-to-cart) AND on the server.
export function sizeUnitPrice(variant, sizeEntry) {
  const sp = Number(sizeEntry?.price);
  return sp > 0 ? sp : Number(variant?.price) || 0;
}

// Lowest price a customer could pay for this product (used for listing / sorting / "From").
export function computeBasePrice(variants = []) {
  const prices = [];
  for (const v of variants || []) {
    if (v.sizes?.length) {
      for (const s of v.sizes) prices.push(effectiveSizePrice(v, s));
    } else {
      prices.push(Number(v.price) || 0);
    }
  }
  const valid = prices.filter((p) => Number.isFinite(p));
  return valid.length ? Math.min(...valid) : 0;
}