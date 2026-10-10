// Builds lookup indexes from a product list so order line items (which only
// store name/color/size/sku snapshots) can be matched back to their source
// product — used to pull the product image and category for display.
export function buildProductIndex(products) {
  const bySku = {};   // sku (product-level or size-level) -> { product, variant, size }
  const byName = {};  // lowercased product name -> product

  products.forEach((p) => {
    if (p.name) byName[p.name.toLowerCase()] = p;
    if (p.sku) bySku[p.sku] = { product: p };

    (p.variants || []).forEach((v) => {
      (v.sizes || []).forEach((s) => {
        if (s.sku) bySku[s.sku] = { product: p, variant: v, size: s };
      });
    });
  });

  return { bySku, byName };
}

export function resolveOrderItem(item, index) {
  let product, variant;

  if (item.sku && index.bySku[item.sku]) {
    ({ product, variant } = index.bySku[item.sku]);
  }
  if (!product && item.name) {
    product = index.byName[item.name.toLowerCase()];
  }
  if (product && !variant) {
    variant =
      product.variants?.find((v) => v.color?.toLowerCase() === item.color?.toLowerCase()) ||
      product.variants?.[0];
  }

  const image = variant?.images?.find(Boolean) || product?.variants?.[0]?.images?.find(Boolean) || '';
  const category = product?.category || null;

  return { product, variant, image, category };
}