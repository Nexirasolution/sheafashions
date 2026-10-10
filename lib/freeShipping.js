// lib/freeShipping.js  (NEW FILE)
// Per-product free shipping.
//   product.freeShipping === true            -> free in EVERY state
//   product.freeShippingStates = ['Kerala']  -> free only when delivering to those states

const norm = (s) => String(s || '').trim().toLowerCase();

export function isFreeShippingFor(product, state) {
  if (!product) return false;
  if (product.freeShipping === true) return true;

  const states = product.freeShippingStates;
  if (!state || !Array.isArray(states) || states.length === 0) return false;

  const target = norm(state);
  return states.some((s) => norm(s) === target);
}

// Cleans the admin payload (used by POST /api/products and PUT /api/products/[id]).
export function sanitizeFreeShipping(body) {
  if ('freeShipping' in body) body.freeShipping = body.freeShipping === true;
  if ('freeShippingStates' in body) {
    body.freeShippingStates = Array.isArray(body.freeShippingStates)
      ? [...new Set(body.freeShippingStates.map((s) => String(s || '').trim()).filter(Boolean))]
      : [];
  }
  return body;
}