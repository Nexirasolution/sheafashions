import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';
import { computeBasePrice } from '@/lib/pricing';
import { sanitizeFreeShipping } from '@/lib/freeShipping';

// POST /api/products/bulk
// body: {
//   category, skuPrefix, description, fabric,
//   price, compareAtPrice, sizes: [{ size, stock, price? }],
//   images: [url, url, ...], tags,
//   isReadyToShip, sizeChart: [url, url, ...],
//   sleeveOptions: [ 'Full Sleeve' | 'Half Sleeve' | 'Elbow Sleeve' | 'Sleeveless', ... ],
//   zipOptions: [ 'With Zip' | 'Without Zip', ... ],
//   freeShipping: boolean,            // free in every state
//   freeShippingStates: [ 'Kerala' ]  // free only in these states
// }
// Creates ONE product per image.
// - Title = auto-derived from the CATEGORY name + zero-padded number.
// - SKU = admin-typed short code + zero-padded number.
// - Each size may carry its own optional `price`; blank/0 => the default `price` is used.
// - isReadyToShip / sizeChart / sleeveOptions / zipOptions / free shipping apply to every product in the batch.
export const POST = requireAdmin(async (req) => {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      category,
      skuPrefix,
      description = '',
      fabric = '',
      weight = 0,
      price,
      compareAtPrice = 0,
      sizes = [],
      images = [],
      tags = [],
      isReadyToShip = false,
      sizeChart = [],
      sleeveOptions = [],
      zipOptions = [],
    } = body;

    // Clean free-shipping fields (same rules as single-product create/update)
    const { freeShipping, freeShippingStates } = sanitizeFreeShipping({
      freeShipping: body.freeShipping,
      freeShippingStates: body.freeShippingStates || [],
    });

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }
    if (!skuPrefix?.trim()) {
      return NextResponse.json({ error: 'SKU code is required' }, { status: 400 });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }
    if (!price || Number(price) <= 0) {
      return NextResponse.json({ error: 'Price is required' }, { status: 400 });
    }

    // Per-size price: only kept when it's a positive number, otherwise null (= use default price)
    const sizeEntries = (sizes || [])
      .filter((s) => s.size)
      .map((s) => ({
        size: s.size,
        stock: Number(s.stock) || 0,
        price: Number(s.price) > 0 ? Number(s.price) : null,
      }));
    if (sizeEntries.length === 0) {
      return NextResponse.json({ error: 'At least one size with stock is required' }, { status: 400 });
    }

    const sizeChartImages = Array.isArray(sizeChart)
      ? sizeChart.filter(Boolean)
      : (sizeChart ? [sizeChart] : []);

    const ALLOWED_SLEEVE = ['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'];
    const ALLOWED_ZIP = ['With Zip', 'Without Zip'];
    const sleeveOptionsClean = Array.isArray(sleeveOptions)
      ? sleeveOptions.filter((s) => ALLOWED_SLEEVE.includes(s))
      : [];
    const zipOptionsClean = Array.isArray(zipOptions)
      ? zipOptions.filter((z) => ALLOWED_ZIP.includes(z))
      : [];

    const cat = await Category.findById(category);
    if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    // --- Title code: auto-derived from the category name ---
    const titleCode = (cat.name || 'PRODUCT')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!titleCode) {
      return NextResponse.json(
        { error: 'Category name must contain letters/numbers to generate a title' },
        { status: 400 }
      );
    }

    // --- SKU code: admin-typed short code, e.g. "MT" ---
    const skuCode = skuPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!skuCode) {
      return NextResponse.json({ error: 'SKU code must contain letters/numbers' }, { status: 400 });
    }

    // Continue title numbering from the highest existing TITLECODE### in this category
    const existingTitles = await Product.find({
      category: cat._id,
      name: { $regex: `^${titleCode}\\d+$`, $options: 'i' },
    }).select('name').lean();

    let maxTitleNum = 0;
    const titleNumRe = new RegExp(`^${titleCode}(\\d+)$`, 'i');
    for (const p of existingTitles) {
      const match = p.name.match(titleNumRe);
      if (match) maxTitleNum = Math.max(maxTitleNum, parseInt(match[1], 10));
    }

    // Continue SKU numbering from the highest existing SKUCODE### (global)
    const existingSkus = await Product.find({
      sku: { $regex: `^${skuCode}\\d+$`, $options: 'i' },
    }).select('sku').lean();

    let maxSkuNum = 0;
    const skuNumRe = new RegExp(`^${skuCode}(\\d+)$`, 'i');
    for (const p of existingSkus) {
      const match = p.sku?.match(skuNumRe);
      if (match) maxSkuNum = Math.max(maxSkuNum, parseInt(match[1], 10));
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < images.length; i++) {
      const titleNum = maxTitleNum + i + 1;
      const name = `${titleCode}${String(titleNum).padStart(3, '0')}`; // e.g. SILKSAREES001
      const slug = slugify(name, { lower: true });

      const skuNum = maxSkuNum + i + 1;
      const sku = `${skuCode}${String(skuNum).padStart(3, '0')}`; // e.g. MT001

      try {
        const [slugTaken, skuTaken] = await Promise.all([
          Product.exists({ slug }),
          Product.exists({ sku }),
        ]);
        if (slugTaken) {
          errors.push({ name, error: 'A product with this generated name/slug already exists — skipped' });
          continue;
        }
        if (skuTaken) {
          errors.push({ name, error: `Generated SKU ${sku} already exists — skipped` });
          continue;
        }

        const variant = {
          color: '',
          colorHex: '#000000',
          images: [images[i]],
          price: Number(price),
          compareAtPrice: Number(compareAtPrice) || 0,
          sizes: sizeEntries.map((s) => ({ ...s })),
        };

        const product = await Product.create({
          name,
          slug,
          sku,
          description,
          category: cat._id,
          fabric,
          weight: Math.max(0, Number(weight) || 0), // grams per piece
          tags,
          variants: [variant],
          // lowest of the default price and every per-size price
          basePrice: computeBasePrice([variant]),
          isReadyToShip: !!isReadyToShip,
          sizeChart: sizeChartImages,
          sleeveOptions: sleeveOptionsClean,
          zipOptions: zipOptionsClean,
          freeShipping: !!freeShipping,
          freeShippingStates: freeShipping ? [] : (freeShippingStates || []),
        });

        created.push({ id: product._id, name: product.name, sku: product.sku });
      } catch (err) {
        errors.push({ name, error: err.message });
      }
    }

    if (created.length) revalidateTag('products'); // storefront shows new products immediately

    return NextResponse.json(
      { createdCount: created.length, created, errors },
      { status: created.length ? 201 : 400 }
    );
  } catch (err) {
    console.error('POST /api/products/bulk error:', err);
    return NextResponse.json({ error: err.message || 'Bulk upload failed' }, { status: 500 });
  }
});