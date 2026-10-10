import Category from '@/models/Category';
import Product from '@/models/Product';

/**
 * Builds a SKU prefix from a category name.
 * "Silk Sarees" -> "SILK-SAREES"
 */
function getPrefix(categoryName) {
  const cleaned = (categoryName || 'PRODUCT')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24);
  return cleaned || 'PRODUCT';
}

/**
 * Generates the next available SKU for a given category,
 * e.g. SILK-SAREES-0001, SILK-SAREES-0002, ...
 */
export async function generateSku(categoryId) {
  const category = await Category.findById(categoryId).select('name');
  const prefix = getPrefix(category?.name);

  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  const existing = await Product.find({ sku: { $regex: `^${prefix}-` } }).select('sku');

  let max = 0;
  existing.forEach((p) => {
    const m = p.sku?.match(regex);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });

  const next = String(max + 1).padStart(4, '0');
  return `${prefix}-${next}`;
}