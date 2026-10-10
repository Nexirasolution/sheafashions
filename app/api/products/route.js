export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';
import { generateSku } from '@/lib/sku';
import { computeBasePrice } from '@/lib/pricing';
import { sanitizeFreeShipping } from '@/lib/freeShipping';

// GET /api/products?category=slug&size=M&minPrice=0&maxPrice=2000&sort=newest&page=1&limit=20&flag=bestseller
// Pass limit=all to skip pagination entirely and return every matching product.
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const query = { isActive: true };

    const categorySlug = searchParams.get('category');
    if (categorySlug) {
      const cat = await Category.findOne({ slug: categorySlug }).select('_id parent').lean();
      if (!cat) return NextResponse.json({ products: [], total: 0 });

      if (cat.parent) {
        query.category = cat._id;
      } else {
        const subcats = await Category.find({ parent: cat._id }).select('_id').lean();
        query.category = { $in: [cat._id, ...subcats.map((c) => c._id)] };
      }
    }

    const size = searchParams.get('size');
    if (size) query['variants.sizes.size'] = size;

    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    const flag = searchParams.get('flag'); // bestseller | topseller | active | featured | newarrival
    if (flag === 'bestseller') query.isBestSeller = true;
    if (flag === 'topseller') query.isTopSeller = true;
    if (flag === 'active') query.isActiveSeller = true;
    if (flag === 'featured') query.isFeatured = true;

    // "New Arrivals" fallback: 30 days -> 90 days -> no date filter.
    if (flag === 'newarrival') {
      const cutoff30 = new Date();
      cutoff30.setDate(cutoff30.getDate() - 30);
      const cutoff90 = new Date();
      cutoff90.setDate(cutoff90.getDate() - 90);

      const [count30, count90] = await Promise.all([
        Product.countDocuments({ ...query, createdAt: { $gte: cutoff30 } }),
        Product.countDocuments({ ...query, createdAt: { $gte: cutoff90 } }),
      ]);

      if (count30 > 0) query.createdAt = { $gte: cutoff30 };
      else if (count90 > 0) query.createdAt = { $gte: cutoff90 };
    }

    const sort = searchParams.get('sort') || 'newest';
    const sortMap = {
      newest: { createdAt: -1 },
      priceLow: { basePrice: 1 },
      priceHigh: { basePrice: -1 },
      popular: { soldCount: -1 },
      rating: { rating: -1 },
    };

    const limitParam = searchParams.get('limit');
    const fetchAll = limitParam === 'all';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Number(limitParam || 24);

    // sizeChart kept in the populate so quick-view can use the category fallback.
    let productsQuery = Product.find(query)
      .populate('category', 'name slug type sizeChart')
      .sort(sortMap[sort] || sortMap.newest)
      .lean(); // plain objects: much faster than hydrating Mongoose documents

    if (!fetchAll) {
      productsQuery = productsQuery.skip((page - 1) * limit).limit(limit);
    }

    const [products, total] = await Promise.all([
      productsQuery,
      Product.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        products,
        total,
        page: fetchAll ? 1 : page,
        pages: fetchAll ? 1 : Math.ceil(total / limit),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } }
    );
  } catch (err) {
    console.error('GET /api/products error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch products' }, { status: 500 });
  }
}

export const POST = requireAdmin(async (req) => {
  try {
    await dbConnect();
    const body = await req.json();
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Product name and category are required' }, { status: 400 });
    }

    // Clean freeShipping / freeShippingStates coming from the admin form
    sanitizeFreeShipping(body);

    const sku = await generateSku(body.category);

    const slug = body.slug ? slugify(body.slug, { lower: true }) : slugify(body.name, { lower: true });
    const exists = await Product.exists({ slug });
    if (exists) return NextResponse.json({ error: 'A product with this slug already exists' }, { status: 409 });

    // Lowest of every variant price and every per-size price
    const basePrice = body.variants?.length
      ? computeBasePrice(body.variants)
      : body.basePrice || 0;

    const weight = Math.max(0, Number(body.weight) || 0); // grams, manual entry
    const product = await Product.create({ ...body, slug, sku, basePrice, weight });

    revalidateTag('products');
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('POST /api/products error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create product' }, { status: 500 });
  }
});