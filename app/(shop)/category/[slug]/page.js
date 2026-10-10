import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import ProductCard from '@/components/ProductCard';
import CategoryFilters from '@/components/CategoryFilters';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { toCardProduct } from '@/lib/cardProduct';

const PAGE_SIZE = 24;
const MAX_PAGE = 100; // stops bots from creating endless cache entries

// Sort values the <Filters> dropdown can produce -> Mongo sort
const SORT_MAP = {
  newest: { createdAt: -1 },
  priceLow: { basePrice: 1 },
  priceHigh: { basePrice: -1 },
  popular: { soldCount: -1 },
  rating: { rating: -1 },
};

// ASSUMPTION: adjust these field names to match your /api/products route
const FLAG_QUERY = {
  bestseller: { isBestSeller: true },
  topseller: { isTopSeller: true },
  newarrival: { isActiveSeller: true },
};

function flagToSortValue(flag) {
  if (flag === 'bestseller') return 'bestselling';
  if (flag === 'newarrival') return 'newarrival';
  return 'newest';
}

function sortToApiSort(sort) {
  if (sort === 'newarrival') return 'newest';
  if (sort === 'bestselling') return 'popular';
  return SORT_MAP[sort] ? sort : 'newest';
}

// One cached read replaces the two browser -> API calls the old page made.
// The arguments are part of the cache key. Cached for 10 minutes; call
// revalidateTag('products') / revalidateTag('categories') after admin edits.
const getCategoryPageData = unstable_cache(
  async (slug, apiSort, flag, page) => {
    await dbConnect();

    const category = await Category.findOne({ slug, isActive: true })
      .populate('parent', 'name slug')
      .lean();
    if (!category) return null;

    const subs = await Category.find({ parent: category._id, isActive: true })
      .select('name slug image')
      .lean();

    // A main category also shows products from its subcategories
    const categoryIds = [category._id, ...subs.map((s) => s._id)];
    const query = {
      isActive: true,
      category: { $in: categoryIds },
      ...(FLAG_QUERY[flag] || {}),
    };

    const [products, total] = await Promise.all([
      Product.find(query)
        // Only what the card needs, and only the first variant
        .select({ slug: 1, name: 1, basePrice: 1, variants: { $slice: 1 } })
        .sort({ ...SORT_MAP[apiSort], _id: -1 }) // _id keeps page order stable
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Product.countDocuments(query),
    ]);

    // JSON round-trip strips ObjectIds so the data can go to client components
    const plain = JSON.parse(JSON.stringify({ category, subs, products }));
    return {
      category: {
        name: plain.category.name,
        slug: plain.category.slug,
        description: plain.category.description || '',
        parent: plain.category.parent
          ? { name: plain.category.parent.name, slug: plain.category.parent.slug }
          : null,
      },
      subcategories: plain.subs,
      cards: plain.products.map(toCardProduct),
      total,
    };
  },
  ['category-page'],
  { revalidate: 600, tags: ['products', 'categories'] }
);

function parseParams(sp) {
  const flag = FLAG_QUERY[sp?.flag] ? sp.flag : null;
  // ?sort= wins if valid, otherwise the flag decides the sort (as before)
  const sortValue = SORT_MAP[sp?.sort] ? sp.sort : flagToSortValue(flag);
  const page = Math.min(Math.max(parseInt(sp?.page, 10) || 1, 1), MAX_PAGE);
  return { flag, sortValue, apiSort: sortToApiSort(sortValue), page };
}

function buildHeading(flag, name) {
  const suffix = name ? ` in ${name}` : '';
  if (flag === 'bestseller') return `Best Sellers${suffix}`;
  if (flag === 'topseller') return `Top Sellers${suffix}`;
  if (flag === 'newarrival') return `New Arrivals${suffix}`;
  return name || 'Products';
}

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params; // on Next 14 use: const { slug } = params;
  const sp = await searchParams;
  const { flag, apiSort, page } = parseParams(sp);
  const data = await getCategoryPageData(slug, apiSort, flag, page); // cache hit, no extra query
  if (!data) return {};
  return {
    title: buildHeading(flag, data.category.name),
    description: data.category.description || undefined,
  };
}

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params; // on Next 14 use: const { slug } = params;
  const sp = await searchParams;
  const { flag, sortValue, apiSort, page } = parseParams(sp);

  const data = await getCategoryPageData(slug, apiSort, flag, page);
  if (!data) notFound();

  const { category, subcategories, cards, total } = data;
  const heading = buildHeading(flag, category.name);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function pageHref(n) {
    const qs = new URLSearchParams();
    if (flag) qs.set('flag', flag);
    if (SORT_MAP[sp?.sort] && sp.sort !== 'newest') qs.set('sort', sp.sort);
    qs.set('page', String(n));
    return `/category/${slug}?${qs.toString()}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* Back-to-parent breadcrumb, for when we're viewing a subcategory */}
      {category.parent && (
        <Link
          href={`/category/${category.parent.slug}`}
          className="text-sm text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1 mb-3"
        >
          ← {category.parent.name}
        </Link>
      )}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
          {heading}
        </h1>

        {category.description && (
          <p className="text-sm mt-1.5 text-neutral-500">{category.description}</p>
        )}
      </div>

      {/* Subcategory nav: only shown on a main category that has children */}
      {subcategories.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
          {subcategories.map((sub) => (
            <Link
              key={sub._id}
              href={`/category/${sub.slug}`}
              prefetch={false}
              className="flex-shrink-0 w-28 flex flex-col items-center gap-2 group"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden bg-pink-50 border border-neutral-100">
                {sub.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sub.image}
                    alt={sub.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )}
              </div>
              <span className="text-xs font-medium text-neutral-700 text-center leading-tight">
                {sub.name}
              </span>
            </Link>
          ))}
        </div>
      )}

      <CategoryFilters sort={sortValue} />

      {cards.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-4xl">🛍️</span>
          <p className="mt-3 text-base font-medium text-neutral-900">No products found in this category yet.</p>
          <p className="text-sm mt-1 text-neutral-400">Check back soon — new arrivals every week!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {cards.map((p, i) => (
            // First row loads first (it is above the fold)
            <ProductCard key={p._id} product={p} priority={page === 1 && i < 2} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-12 flex items-center justify-center gap-6 text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} prefetch={false} className="text-neutral-900 hover:underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-neutral-300">← Previous</span>
          )}
          <span className="text-neutral-400 text-xs tracking-wide">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} prefetch={false} className="text-neutral-900 hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-neutral-300">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}