import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/apiAuth';

function getPrefix(categoryName) {
  const cleaned = (categoryName || 'PRODUCT')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24);
  return cleaned || 'PRODUCT';
}

// POST /api/products/backfill-sku
// Regenerates SKUs for every product so they all follow CATEGORY-0001 format,
// grouped and numbered per category, ordered by creation date.
export const POST = requireAdmin(async () => {
  await dbConnect();

  const products = await Product.find({}).sort({ createdAt: 1 }).populate('category', 'name');
  const counters = {};
  const updated = [];

  for (const product of products) {
    const prefix = getPrefix(product.category?.name);

    if (!(prefix in counters)) {
      counters[prefix] = 0; // starts fresh per category, in creation order
    }
    counters[prefix] += 1;

    const newSku = `${prefix}-${String(counters[prefix]).padStart(4, '0')}`;
    if (product.sku !== newSku) {
      product.sku = newSku;
      await product.save();
      updated.push({ id: product._id, name: product.name, sku: newSku });
    }
  }

  return NextResponse.json({ total: products.length, updatedCount: updated.length, updated });
});