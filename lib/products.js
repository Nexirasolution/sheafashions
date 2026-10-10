import { unstable_cache } from 'next/cache';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Review from '@/models/Review';
import '@/models/Category'; // makes sure the model is registered for populate()

export function getFilter(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
}

// Single source of truth for the product page AND GET /api/products/[id].
// Cached for 60s, and tagged so admin writes can bust it instantly with
// revalidateTag('products').
export const getProductPageData = unstable_cache(
  async (idOrSlug) => {
    await dbConnect();

    const product = await Product.findOne({ ...getFilter(idOrSlug), isActive: true })
      .populate('category', 'name slug sizes type sizeChart')
      .lean();
    if (!product) return null;

    // Reviews and related products don't depend on each other: run in parallel
    const [reviews, related] = await Promise.all([
      Review.find({ product: product._id, isApproved: true })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      product.category?._id
        ? Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isActive: true,
          })
            // ProductCard only reads variants[0], so slice the array
            .select({ name: 1, slug: 1, basePrice: 1, rating: 1, variants: { $slice: 1 } })
            .limit(8)
            .lean()
        : [],
    ]);

    // Strip ObjectIds/Dates so it can cross the server -> client boundary
    return JSON.parse(JSON.stringify({ product, reviews, related }));
  },
  ['product-page'],
  { revalidate: 60, tags: ['products'] }
);