// lib/cartItems.js  (NEW FILE)
// Converts a cart line into the shape the server APIs expect.
// No price is sent: the server always uses database prices.
export function toOrderItem(i) {
  return {
    productId: i.productId,
    variantId: i.variantId,
    size: i.size,
    sleeveType: i.sleeveType || '',
    zipType: i.zipType || '',
    pantOption: i.pantOption,
    shawlOption: i.shawlOption,
    qty: i.qty,
    isCombo: i.isCombo || false,
    comboId: i.comboId,
    ...(i.packDetails ? { packDetails: i.packDetails } : {}),
  };
}