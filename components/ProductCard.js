'use client';

import { memo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MoreVertical, Heart } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { getVariantTotalStock } from '@/lib/stock';
import { useWishlist } from '@/components/WhishlistContext'; // adjust path as needed

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL = '#064E4A';
const GOLD = '#C49A45';
const INK = '#172A29';
const INK_FAINT = '#6B7C7A';
const WASH = '#F5EFE0';   // image placeholder (light tint of sand)
const PAPER = '#FFFDF5';
const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const pillBase = { padding: '6px 14px', borderRadius: '999px' };

function ProductCard({ product, priority = false }) {
  const variant = product.variants?.[0];
  const image = variant?.images?.[0] || '/placeholder.png';
  const price = product.basePrice || variant?.price || 0;
  const compareAt = variant?.compareAtPrice || 0;
  const hasOffer = compareAt > price;
  const discountPct = hasOffer ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

  const totalStock = getVariantTotalStock(variant);
  const outOfStock = totalStock <= 0;
  const lowStock = !outOfStock && totalStock <= 5;

  const wishId = product.id ?? product._id ?? product.slug;
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(wishId);

  const handleWishlistClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(wishId);
    },
    [toggleWishlist, wishId]
  );

  return (
    <div className="relative" style={{ background: PAPER, fontFamily: FONT_SANS }}>
      {/* Wishlist button sits outside the Link (valid HTML, better accessibility).
          No backdrop-filter: expensive to paint across a grid on cheap phones */}
      <button
        type="button"
        onClick={handleWishlistClick}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wishlisted}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8 rounded-full transition-transform active:scale-90"
        style={{ background: 'rgba(255,253,245,0.92)' }}
      >
        <Heart
          className="w-4 h-4"
          strokeWidth={2}
          style={{ color: wishlisted ? GOLD : INK }}
          fill={wishlisted ? GOLD : 'none'}
        />
      </button>

      <Link href={`/product/${product.slug}`} prefetch={false} className="block">
        <div className="relative aspect-[3/4] overflow-hidden" style={{ background: WASH }}>
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            quality={75}
            priority={priority}
            className={`object-cover ${outOfStock ? 'grayscale opacity-70' : ''}`}
          />

          <div className="absolute top-4 left-4">
            {outOfStock ? (
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ ...pillBase, color: PAPER, background: INK_FAINT }}>
                Out of stock
              </span>
            ) : lowStock ? (
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ ...pillBase, color: PAPER, background: TEAL }}>
                {totalStock} left
              </span>
            ) : discountPct > 0 ? (
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ ...pillBase, color: INK, background: GOLD }}>
                Sale
              </span>
            ) : null}
          </div>

          <span className="absolute bottom-3.5 right-3.5 flex items-center justify-center w-8 h-8" style={{ color: PAPER }}>
            <MoreVertical className="w-5 h-5" strokeWidth={2} />
          </span>
        </div>

        <div className="pt-3">
          {/* Name wraps to 2 lines max; fixed min height keeps grid rows aligned */}
          <h3
            className="text-sm sm:text-base font-medium leading-snug line-clamp-2 min-h-[2.5rem]"
            style={{ color: INK }}
          >
            {product.name}
          </h3>

          {/* Price + offer */}
          <div className="mt-1 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
            <span className="font-bold text-lg sm:text-xl" style={{ color: TEAL }}>
              {formatINR(price)}
            </span>

            {hasOffer && (
              <>
                <span className="text-sm sm:text-base line-through font-light" style={{ color: INK_FAINT }}>
                  {formatINR(compareAt)}
                </span>
                <span
                  className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                  style={{ color: INK, background: GOLD }}
                >
                  {discountPct}% off
                </span>
              </>
            )}
          </div>

          {hasOffer && (
            <p className="mt-1 text-xs" style={{ color: INK_FAINT }}>
              You save {formatINR(compareAt - price)}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

export default memo(ProductCard);