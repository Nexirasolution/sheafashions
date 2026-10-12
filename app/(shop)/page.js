import { dbConnect } from '@/lib/mongodb';
import Banner from '@/models/Banner';
import Product from '@/models/Product';
import Review from '@/models/Review';
import Combo from '@/models/Combo';
import Category from '@/models/Category';
import Settings from '@/models/Settings';
import BannerCarousel from '@/components/BannerCarousel';
import ProductCard from '@/components/ProductCard';
import ReviewSection from '@/components/ReviewSection';
import LiveSection from '@/components/LiveSection';
import Reel from '@/models/Reel';
import ReelsSection from '@/components/ReelsSection';

import Link from 'next/link';
import { formatINR } from '@/lib/utils';
import { toCardProduct } from '@/lib/cardProduct';
import { ArrowRight, Tag } from 'lucide-react';

// ISR: the page is built once and served from the CDN, then regenerated in the
// background at most every 10 minutes. Visitors and bots no longer trigger a
// function + 7 DB queries on every request. (Replaces `force-dynamic`.)
// The admin settings API calls revalidatePath('/') on save, so live-link changes
// show instantly. For other admin changes (products, banners, categories, combos,
// reels, reviews) call revalidatePath('/') in those API routes as well.
export const revalidate = 600;

// Design tokens: shared teal / gold / cream theme
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
// Keep in sync with Navbar and CouponMarquee.
const TEAL = '#064E4A';                       // primary brand / CTA
const INK = '#172A29';                        // primary text
const INK_FAINT = '#6B7C7A';                  // secondary text
const GOLD = '#C49A45';                       // accent / hover / badges
const SAND = '#E7DCC5';                       // hairlines, soft fills, placeholders
const SAND_SOFT = 'rgba(231, 220, 197, 0.35)'; // image placeholder background
const PAPER = '#FFFDF5';                      // page background
const HAIRLINE = SAND;

// Minimalist type: a clean, quiet sans. Headings are bold + tracked out;
// body copy stays light so the boldness reads as intentional, not noisy.
const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
// Premium editorial serif: reserved for the hero headline and tagline only,
// so it reads as a deliberate accent rather than a full type-system change.
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

// Featured Collection shows a teaser, not the full catalog
const FEATURED_LIMIT = 6;

// How many reels to show in the "Shop by Reels" row
const REELS_LIMIT = 10;

async function getData() {
  await dbConnect();
  // Only fetch what the page actually renders.
  const [banners, newArrivals, reviews, combos, categories, reels, settings] = await Promise.all([
    Banner.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Product.find({ isActive: true, isActiveSeller: true })
      .sort({ createdAt: -1 })
      .limit(FEATURED_LIMIT)
      .lean(),
    Review.find({ isApproved: true, isFeatured: true }).populate('product', 'name').limit(10).lean(),
    Combo.find({ isActive: true }).limit(6).lean(),
    // Only main categories here: subcategories are excluded from the
    // homepage "Shop by Category" grid.
    Category.find({ isActive: true, parent: null }).limit(10).lean(),
    // Reels: newest first, with the linked product's name + slug for the
    // caption and "Shop now" link. Remove the isActive filter if your Reel
    // model has no such field.
    Reel.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('product', 'name slug')
      .limit(REELS_LIMIT)
      .lean(),
    // YouTube live links (Yesterday / Today / Tomorrow) set in admin settings
    Settings.findOne({ key: 'global' }).select('liveStreams').lean(),
  ]);

  // Serialize once (ObjectId/Date -> plain values) for client components
  return JSON.parse(
    JSON.stringify({
      banners,
      newArrivals,
      reviews,
      combos,
      categories,
      reels,
      liveStreams: settings?.liveStreams || null,
    })
  );
}

export default async function HomePage() {
  const {
    banners,
    newArrivals: plainNewArrivals,
    reviews,
    combos: plainCombos,
    categories: plainCategories,
    reels,
    liveStreams,
  } = await getData();

  return (
    <div className="overflow-x-hidden" style={{ background: PAPER }}>

      {/* Intro / hero copy: premium editorial opener */}
      {/* <section className="max-w-2xl mx-auto px-6 pt-16 sm:pt-24 pb-10 sm:pb-14 text-center">
        <span
          className="inline-block text-[10px] sm:text-[11px] font-semibold uppercase tracking-[4px]"
          style={{ color: INK_FAINT, fontFamily: FONT_SANS }}
        >
          The Tirupur Clothing Hub Edit
        </span>

        <h1
          className="mt-5 text-[26px] sm:text-[38px] leading-[1.2]"
          style={{ color: INK, fontFamily: FONT_SERIF, fontWeight: 400, letterSpacing: '-0.01em' }}
        >
          Crafted for the Trendsetters of Today
        </h1> */}

        {/* Thin center divider: a quiet, premium separator instead of a rule */}
        {/* <div className="flex items-center justify-center gap-3 mt-6 sm:mt-7">
          <span style={{ width: '28px', height: '1px', background: HAIRLINE }} />
          <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
          <span style={{ width: '28px', height: '1px', background: HAIRLINE }} />
        </div>

        <p
          className="mt-6 sm:mt-7 text-[13.5px] sm:text-[15px] leading-[1.8] font-light max-w-[46ch] mx-auto"
          style={{ color: INK_FAINT, fontFamily: FONT_SANS }}
        >
          Experience the perfect blend of comfort, quality, and timeless fashion.
          Sourced directly from India&rsquo;s textile capital, our collections offer
          high-end craftsmanship at prices that fit your daily lifestyle.
        </p>

        <p
          className="mt-5 sm:mt-6 text-sm sm:text-base tracking-[0.5px] italic"
          style={{ color: INK, fontFamily: FONT_SERIF }}
        >
          Wrap yourself in beauty every time you step out.
        </p>
      </section> */}

      {/* Banner */}
      <BannerCarousel banners={banners} />

      {/* YouTube live: Yesterday / Today / Tomorrow (hidden if no links set) */}
      <LiveSection streams={liveStreams} />

      {/* Shop by Category */}
      {plainCategories?.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-14 pb-6">
          {/* h2 (was a second h1): a page should have only one h1 for SEO */}
          <h2
            className="text-xl sm:text-2xl font-bold tracking-[3px] uppercase mb-6 text-center"
            style={{ color: TEAL, fontFamily: FONT_SANS }}
          >
            Shop by Category
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-6">
            {plainCategories.map((c) => (
              <Link
                key={c._id}
                href={`/category/${c.slug}`}
                className="group flex flex-col items-center text-center"
              >
                {/* Circular image */}
                <div
                  className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{ border: `1px solid ${HAIRLINE}`, background: SAND_SOFT }}
                >
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full" style={{ background: SAND }} />
                  )}
                </div>

                {/* Label */}
                <span
                  className="mt-2 text-[10.5px] sm:text-[11px] font-bold tracking-wide leading-tight line-clamp-2 max-w-[80px]"
                  style={{ color: INK, fontFamily: FONT_SANS }}
                >
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured collection: centered copy, up to 6 New Arrivals, CTA */}
      <section className="max-w-6xl mx-auto px-4 pt-6 pb-16 text-center">
        <h3
          className="text-lg sm:text-xl font-bold tracking-[3px] uppercase"
          style={{ color: TEAL, fontFamily: FONT_SANS }}
        >
          Featured Collection
        </h3>

        {/* 2/3/4 columns so each ProductCard renders large */}
        {plainNewArrivals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 mt-8 text-left">
            {plainNewArrivals.map((p) => (
              <ProductCard key={p._id} product={toCardProduct(p)} />
            ))}
          </div>
        )}

        <Link
          href="/products"
          className="inline-block mt-10 px-8 py-3 text-[12px] font-bold tracking-[2px] uppercase transition-colors bg-[#064E4A] hover:bg-[#C49A45] text-[#FFFDF5] hover:text-[#172A29]"
          style={{ fontFamily: FONT_SANS }}
        >
          Shop the collection
        </Link>
      </section>

      {/* Combo Offers */}
      {plainCombos?.length > 0 && (
        <section className="py-16 border-t" style={{ background: PAPER, borderColor: HAIRLINE }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col items-center text-center mb-8">
              <span
                className="text-[11px] font-bold uppercase tracking-[3px] mb-3 px-3 py-1"
                style={{ color: INK, background: SAND, fontFamily: FONT_SANS }}
              >
                Save More
              </span>
              <h2
                className="text-xl sm:text-2xl font-bold tracking-[1px]"
                style={{ color: TEAL, fontFamily: FONT_SANS }}
              >
                Combo Offers
              </h2>
              <p className="text-sm mt-1 font-light" style={{ color: INK_FAINT, fontFamily: FONT_SANS }}>
                Buy together, save together
              </p>
              <Link
                href="/combos"
                className="hidden sm:flex items-center gap-1 text-sm font-bold hover:gap-2 transition-all mt-3"
                style={{ color: TEAL, fontFamily: FONT_SANS }}
              >
                View all <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {plainCombos.map((c) => {
                const isColorPack = c.type === 'color-pack';
                const cheapestPack = isColorPack && c.packOptions?.length
                  ? c.packOptions.reduce((min, p) => (p.price < min.price ? p : min), c.packOptions[0])
                  : null;

                // Support both the current `images[]` array and, defensively, a
                // legacy singular `image` field on older documents.
                const cover = c.images?.[0] || c.image;

                const displayPrice = isColorPack ? cheapestPack?.price ?? 0 : c.comboPrice;
                const displayOriginal = isColorPack ? cheapestPack?.originalPrice ?? 0 : c.originalPrice;
                const savings = displayOriginal > displayPrice ? displayOriginal - displayPrice : 0;
                const pct = displayOriginal > 0 ? Math.round((savings / displayOriginal) * 100) : 0;

                return (
                  <Link
                    key={c._id}
                    href={`/combo/${c.slug}`}
                    className="group relative overflow-hidden transition-colors"
                    style={{ background: PAPER, border: `1px solid ${HAIRLINE}` }}
                  >
                    {/* Image */}
                    <div
                      className="relative w-full aspect-square overflow-hidden"
                      style={{ background: SAND_SOFT }}
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={c.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: SAND }} />
                      )}
                      {pct > 0 && (
                        <div
                          className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1"
                          style={{ color: INK, background: GOLD, fontFamily: FONT_SANS }}
                        >
                          <Tag size={9} /> {pct}% off
                        </div>
                      )}
                      {isColorPack && (
                        <div
                          className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5"
                          style={{ background: TEAL, color: PAPER }}
                        >
                          Color Pack
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                      <p
                        className="text-[13px] font-bold tracking-wide line-clamp-1"
                        style={{ color: INK, fontFamily: FONT_SANS }}
                      >
                        {c.name}
                      </p>
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="font-bold text-sm" style={{ color: TEAL, fontFamily: FONT_SANS }}>
                          {isColorPack && 'From '}{formatINR(displayPrice)}
                        </span>
                        {savings > 0 && (
                          <span
                            className="text-[11px] line-through font-light"
                            style={{ color: INK_FAINT, fontFamily: FONT_SANS }}
                          >
                            {formatINR(displayOriginal)}
                          </span>
                        )}
                      </div>
                      {savings > 0 && (
                        <p
                          className="text-[10.5px] font-bold mt-1 tracking-wide uppercase"
                          style={{ color: INK_FAINT, fontFamily: FONT_SANS }}
                        >
                          Save {formatINR(savings)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link href="/combo" className="text-sm font-bold" style={{ color: TEAL, fontFamily: FONT_SANS }}>
                View all combos →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <ReviewSection reviews={reviews} />

      {/* Reels */}
      <ReelsSection reels={reels} />

    </div>
  );
}