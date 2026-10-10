import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import ProductCard from '@/components/ProductCard';
import Filters from '@/components/Filters';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import { toCardProduct } from '@/lib/cardProduct';

const PAGE_SIZE = 24;
const MAX_PAGE = 100; // stops bots from creating endless cache entries

const SORT_MAP = {
  newest: { createdAt: -1 },
  priceLow: { basePrice: 1 },
  priceHigh: { basePrice: -1 },
  popular: { soldCount: -1 },
  rating: { rating: -1 },
};

// Cached for 10 minutes per (sort, page). The arguments are part of the cache key.
// Call revalidateTag('products') when admin saves a product to refresh it at once.
const getProducts = unstable_cache(
  async (sort, page) => {
    await dbConnect();

    const query = { isActive: true };
    const sortStage = { ...SORT_MAP[sort], _id: -1 }; // _id keeps page order stable

    const [products, total] = await Promise.all([
      Product.find(query)
        // Only what the card needs, and only the first variant
        .select({ slug: 1, name: 1, basePrice: 1, variants: { $slice: 1 } })
        .sort(sortStage)
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Product.countDocuments(query),
    ]);

    return {
      // JSON round-trip strips ObjectIds so the data can go to client components
      cards: JSON.parse(JSON.stringify(products)).map(toCardProduct),
      total,
    };
  },
  ['products-list'],
  { revalidate: 600, tags: ['products'] }
);

export const metadata = {
  title: 'All Products | Shea Fashions',
};

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams; // Next.js 15: searchParams is a Promise

  // Only accept known sort values and sane page numbers (keeps the cache small)
  const sort = SORT_MAP[sp?.sort] ? sp.sort : 'newest';
  const page = Math.min(Math.max(parseInt(sp?.page, 10) || 1, 1), MAX_PAGE);

  let cards = [];
  let total = 0;
  try {
    ({ cards, total } = await getProducts(sort, page));
  } catch {}

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n) => `/products?sort=${sort}&page=${n}`;

  return (
    <section className="max-w-6xl mx-auto px-5 py-16 bg-white">
      <div className="mb-10 flex items-baseline justify-between flex-wrap gap-3">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900">
          All Products
        </h1>
        <span className="text-xs tracking-wide text-neutral-400">
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      </div>

      <Filters sort={sort} />

      {cards.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Nothing here yet — check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-10 mt-6">
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
    </section>
  );
}