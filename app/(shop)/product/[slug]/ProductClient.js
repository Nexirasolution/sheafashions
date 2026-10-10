'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Star, ShoppingBag, Zap, Heart, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { getSizeStock, getCombinedStock } from '@/lib/stock';
import { useCart } from '@/components/CartContext';
import { useWishlist } from '@/components/WhishlistContext';
import ColorSizeSelector from '@/components/ColorSizeSelector';
import ProductCard from '@/components/ProductCard';
import { display, body } from '@/lib/fonts';
import toast from 'react-hot-toast';

// Only loaded when the user actually opens them
const SizeChartModal = dynamic(() => import('@/components/SizeChartModal'), { ssr: false });
const Lightbox = dynamic(() => import('@/components/Lightbox'), { ssr: false });

// Design tokens: teal / gold / cream system.
// Theme: #064E4A (deep teal), #C49A45 (gold), #FFFDF5 (cream), #172A29 (dark teal), #E7DCC5 (sand)
const INK = '#172A29';          // primary text
const INK_SOFT = '#6B7F7C';     // muted text (derived teal-gray)
const PEACH = '#C49A45';        // accent (gold) - stars, dots, rings, icons
const PEACH_WASH = '#F4ECD8';   // light sand tint (image placeholder, badges)
const LINE = '#E7DCC5';         // borders (sand)
const PAPER = '#FFFDF5';        // page background (cream)
const NEUTRAL = '#A8A28E';      // strike-through prices, quiet text
const SAGE = '#064E4A';         // deep teal (buttons, labels, discount)
const GOLD_DARK = '#8A6A22';    // darker gold for readable warning text

// Gallery auto-advance. Off by default: with autoplay every visitor downloads
// every product image one after another (more data, more image transformations)
// even if they never look at them. Set to true to turn it back on.
const AUTOPLAY_ENABLED = false;
const AUTOPLAY_MS = 4000;

export default function ProductClient({ data }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { product, reviews, related } = data;

  const [activeVariant, setActiveVariant] = useState(product.variants?.[0] ?? null);
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState('');
  const [activeSleeve, setActiveSleeve] = useState('');
  const [activeZip, setActiveZip] = useState('');
  const [activePantId, setActivePantId] = useState('');
  const [activeShawlId, setActiveShawlId] = useState('');
  const [qty, setQty] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  // Same id the product cards use, so the heart state matches everywhere
  const wished = isWishlisted(product._id);

  useEffect(() => { setMounted(true); }, []);

  const images = activeVariant?.images || [];
  // Per-size pricing: a size may have its own price, otherwise the variant price applies.
  const variantPrice = activeVariant?.price || 0;
  const sizeEffectivePrice = (s) => (Number(s?.price) > 0 ? Number(s.price) : variantPrice);
  const selectedSizeObj = activeVariant?.sizes?.find((s) => s.size === activeSize);
  const sizePrices = (activeVariant?.sizes || []).map(sizeEffectivePrice);
  const pricesVary = sizePrices.some((p) => p !== sizePrices[0]);
  // Before a size is picked, show the lowest price with a "From" label
  const showFrom = !selectedSizeObj && pricesVary;
  const currentBasePrice = selectedSizeObj
    ? sizeEffectivePrice(selectedSizeObj)
    : pricesVary ? Math.min(...sizePrices) : variantPrice;
  const compareBase = activeVariant?.compareAtPrice > currentBasePrice ? activeVariant.compareAtPrice : 0;
  const discount = compareBase ? Math.round(((compareBase - currentBasePrice) / compareBase) * 100) : 0;

  // Product's own size chart wins; otherwise fall back to the category's.
  const sizeChartImages = product.sizeChart?.length ? product.sizeChart : (product.category?.sizeChart || []);

  const selectedSizeStock = getSizeStock(activeVariant, activeSize);
  const sizeOutOfStock = !!activeSize && selectedSizeStock <= 0;

  const selectedPant = useMemo(
    () => product.pantOptions?.find((p) => p._id === activePantId) || null,
    [product.pantOptions, activePantId]
  );
  const selectedShawl = useMemo(
    () => product.shawlOptions?.find((s) => s._id === activeShawlId) || null,
    [product.shawlOptions, activeShawlId]
  );
  const addonTotal = (selectedPant?.price || 0) + (selectedShawl?.price || 0);
  const unitPrice = currentBasePrice + addonTotal;
  const unitCompareAtPrice = compareBase ? compareBase + addonTotal : 0;

  const computeStock = useCallback(
    (variant, size, pantId, shawlId) =>
      getCombinedStock(variant, size, {
        pantOptions: product.pantOptions,
        pantOptionId: pantId,
        shawlOptions: product.shawlOptions,
        shawlOptionId: shawlId,
      }),
    [product.pantOptions, product.shawlOptions]
  );

  // Computed once per relevant change instead of ~5x per render
  const stock = useMemo(
    () => computeStock(activeVariant, activeSize, activePantId, activeShawlId),
    [computeStock, activeVariant, activeSize, activePantId, activeShawlId]
  );
  const finiteStock = stock !== Infinity;
  const plusDisabled = !!activeSize && finiteStock && qty >= stock;
  const lowStockLeft = !!activeSize && finiteStock && stock > 0 && stock <= 5 ? stock : null;

  const prevImage = () => setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1));
  const nextImage = () => setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1));

  // ── Auto carousel (see AUTOPLAY_ENABLED above) ──
  // Pauses while the user hovers, touches, or has a modal open, and is skipped
  // for reduced-motion users. Depending on activeImage restarts the timer
  // after any manual change.
  const imageCount = images.length;
  const modalOpen = !!lightboxImg || sizeChartOpen;
  useEffect(() => {
    if (!AUTOPLAY_ENABLED || imageCount < 2 || paused || modalOpen) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      if (document.hidden) return; // don't spin in background tabs
      setActiveImage((i) => (i + 1) % imageCount);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [imageCount, paused, modalOpen, activeImage]);

  // Swipe left/right on the gallery (phones have no hover arrows)
  const touchStartX = useRef(null);
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e) => {
    setPaused(false);
    if (touchStartX.current == null || images.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 40) (dx < 0 ? nextImage() : prevImage());
  };

  function handleWish() {
    toggleWishlist(product._id);
    toast.success(wished ? 'Removed from wishlist' : 'Added to wishlist');
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: product.name, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  }

  function handleColorChange(v) {
    setActiveVariant(v);
    setActiveImage(0);
    setActiveSize('');
    setQty(1);
  }

  function handleSizeChange(size) {
    setActiveSize(size);
    const s = computeStock(activeVariant, size, activePantId, activeShawlId);
    setQty((q) => (s > 0 && s !== Infinity ? Math.min(q, s) : 1));
  }

  function handlePantChange(id) {
    setActivePantId(id);
    const s = computeStock(activeVariant, activeSize, id, activeShawlId);
    if (s !== Infinity) setQty((q) => Math.min(q, Math.max(s, 1)));
  }

  function handleShawlChange(id) {
    setActiveShawlId(id);
    const s = computeStock(activeVariant, activeSize, activePantId, id);
    if (s !== Infinity) setQty((q) => Math.min(q, Math.max(s, 1)));
  }

  function buildCartPayload() {
    return {
      productId: product._id,
      variantId: activeVariant._id,
      comboId: null,
      name: product.name,
      image: activeVariant.images?.[0],
      color: activeVariant.color,
      size: activeSize,
      sleeveType: activeSleeve,
      zipType: activeZip,
      pantOption: selectedPant
        ? { id: selectedPant._id, name: selectedPant.name, price: selectedPant.price, image: selectedPant.image, sku: selectedPant.sku }
        : null,
      shawlOption: selectedShawl
        ? { id: selectedShawl._id, name: selectedShawl.name, price: selectedShawl.price, image: selectedShawl.image, sku: selectedShawl.sku }
        : null,
      price: unitPrice,
      weight: product.weight || 0, // grams per piece
      qty,
      stock,
    };
  }

  // Shared validation for Add to Cart and Buy Now
  function validateAndAdd() {
    if (!activeSize) { toast.error('Please select a size'); return false; }
    if (product.sleeveOptions?.length && !activeSleeve) { toast.error('Please select a sleeve type'); return false; }
    if (product.zipOptions?.length && !activeZip) { toast.error('Please select a zip type'); return false; }
    if (stock <= 0) { toast.error('This combination is out of stock'); return false; }
    if (qty > stock) {
      toast.error(`Only ${stock} left in stock`);
      setQty(stock);
      return false;
    }
    addItem(buildCartPayload());
    return true;
  }

  const handleAddToCart = () => { validateAndAdd(); };
  const handleBuyNow = () => { if (validateAndAdd()) router.push('/checkout'); };

  return (
    <div className={`${body.className} ${display.variable}`} style={{ background: PAPER }}>
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-4 sm:pt-16 pb-24 sm:pb-20">
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-16">

          {/* ── Gallery ── */}
          <div className="sm:sticky sm:top-10 sm:self-start">
            {/* Mobile: edge-to-edge (-mx-5 cancels page padding), 4:5 ratio capped
                at 65vh so the whole photo shows without pushing the buy options
                too far down. Desktop: same 4:5 box with rounded corners. */}
            <div
              className="relative -mx-5 sm:mx-0 w-auto sm:w-full aspect-[4/5] max-h-[65vh] sm:max-h-none overflow-hidden sm:rounded-[4px] touch-pan-y"
              style={{ background: PEACH_WASH }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {images[activeImage] && (
                <Image
                  key={images[activeImage]}
                  src={images[activeImage]}
                  alt={product.name}
                  fill
                  sizes="(max-width:640px) 100vw, 48vw"
                  quality={75}
                  className="object-cover"
                  priority={activeImage === 0}
                />
              )}

              {/* Like / share, overlaid top-right on the image (all screen sizes) */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                <button
                  onClick={handleWish}
                  aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
                  aria-pressed={wished}
                  className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
                  style={{ background: 'rgba(255,253,245,0.92)' }}
                >
                  <Heart size={17} strokeWidth={1.6} style={{ color: wished ? PEACH : INK }} fill={wished ? PEACH : 'none'} />
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share"
                  className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
                  style={{ background: 'rgba(255,253,245,0.92)' }}
                >
                  <Share2 size={16} strokeWidth={1.6} style={{ color: INK }} />
                </button>
              </div>

              {images.length > 1 && (
                <>
                  {/* Prev / next: always visible round buttons, turn gold on hover/press */}
                  <button
                    onClick={prevImage}
                    className="group absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shadow-md transition active:scale-90 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: 'rgba(255,253,245,0.95)', outlineColor: PEACH }}
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={20} strokeWidth={2} className="transition-colors group-hover:text-[#C49A45] group-active:text-[#C49A45]" style={{ color: INK }} />
                  </button>
                  <button
                    onClick={nextImage}
                    className="group absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shadow-md transition active:scale-90 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: 'rgba(255,253,245,0.95)', outlineColor: PEACH }}
                    aria-label="Next image"
                  >
                    <ChevronRight size={20} strokeWidth={2} className="transition-colors group-hover:text-[#C49A45] group-active:text-[#C49A45]" style={{ color: INK }} />
                  </button>

                  <div
                    className="hidden sm:block absolute bottom-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide"
                    style={{ color: INK, background: 'rgba(255,253,245,0.85)' }}
                  >
                    {String(activeImage + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
                  </div>

                  {/* Dots: tappable, active one is a long gold pill */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(i)}
                        aria-label={`Go to image ${i + 1}`}
                        aria-current={i === activeImage}
                        className="py-2 px-0.5"
                      >
                        <span
                          className="block rounded-full"
                          style={{
                            width: i === activeImage ? 20 : 7,
                            height: 7,
                            background: i === activeImage ? PEACH : 'rgba(255,253,245,0.85)',
                            boxShadow: '0 0 0 1px rgba(23,42,41,0.15)',
                            transition: 'width .25s, background .25s',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="hidden sm:flex gap-3 mt-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === activeImage}
                    className="relative w-12 h-[60px] overflow-hidden shrink-0 transition-all hover:opacity-100"
                    style={{
                      opacity: i === activeImage ? 1 : 0.5,
                      borderRadius: '3px',
                      boxShadow: i === activeImage ? `0 0 0 2px ${PEACH}` : 'none',
                    }}
                  >
                    <Image src={img} alt="" fill sizes="48px" quality={50} className="object-cover" />
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* ── Details ── */}
          <div className="flex flex-col">
            {product.category?.name && (
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] mb-1.5 sm:mb-2" style={{ color: SAGE }}>
                {product.category.name}
              </p>
            )}

            <h1
              className={`${display.className} text-[20px] sm:text-[32px] leading-[1.15]`}
              style={{ color: INK, fontWeight: 400, letterSpacing: '-0.01em' }}
            >
              {product.name}
            </h1>

            {product.isReadyToShip && (
              <span
                className="inline-block mt-2 sm:mt-2.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide w-fit"
                style={{ background: PEACH_WASH, color: SAGE, borderRadius: '4px' }}
              >
                Ready to Ship
              </span>
            )}

            <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2.5 text-sm" style={{ color: INK_SOFT }}>
              <Star size={13} strokeWidth={1.5} style={{ fill: PEACH, color: PEACH }} />
              <span style={{ color: INK }}>{product.rating?.toFixed?.(1) ?? product.rating}</span>
              <span>· {product.reviewCount} reviews</span>
            </div>

            <div className="flex items-baseline gap-3 mt-3 sm:mt-6">
              <span className={`${display.className} text-[22px] sm:text-[26px]`} style={{ color: INK, fontWeight: 500 }}>
                {showFrom && <span className="text-xs font-normal mr-1.5" style={{ color: INK_SOFT }}>From</span>}
                {formatINR(unitPrice)}
              </span>
              {unitCompareAtPrice > unitPrice && (
                <span className="line-through text-sm" style={{ color: NEUTRAL }}>
                  {formatINR(unitCompareAtPrice)}
                </span>
              )}
              {discount > 0 && (
                <span className="text-xs font-medium" style={{ color: SAGE }}>
                  {discount}% off
                </span>
              )}
            </div>
            {addonTotal > 0 && (
              <p className="text-xs mt-1" style={{ color: INK_SOFT }}>
                Includes {formatINR(addonTotal)} for selected add-ons
              </p>
            )}

            {product.fabric && (
              <p className="hidden sm:block text-sm mt-3" style={{ color: INK_SOFT }}>
                Fabric <span style={{ color: INK }}>— {product.fabric}</span>
              </p>
            )}

            <div className="mt-4 pt-4 sm:mt-8 sm:pt-8" style={{ borderTop: `1px solid ${LINE}` }}>
              <ColorSizeSelector
                variants={product.variants}
                activeVariant={activeVariant}
                onColorChange={handleColorChange}
                activeSize={activeSize}
                onSizeChange={handleSizeChange}
                categoryType={product.category?.type}
                sizeChartImages={sizeChartImages}
                onViewSizeChart={() => setSizeChartOpen(true)}
                sleeveOptions={product.sleeveOptions}
                zipOptions={product.zipOptions}
                activeSleeve={activeSleeve}
                onSleeveChange={setActiveSleeve}
                activeZip={activeZip}
                onZipChange={setActiveZip}
                pantOptions={product.pantOptions}
                activePantId={activePantId}
                onPantChange={handlePantChange}
                shawlOptions={product.shawlOptions}
                activeShawlId={activeShawlId}
                onShawlChange={handleShawlChange}
                formatINR={formatINR}
              />
            </div>

            <div className="flex items-center gap-4 mt-4 sm:mt-6">
              <p className="text-sm" style={{ color: INK_SOFT }}>Qty</p>
              <div className="flex items-center gap-4">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-base leading-none" style={{ color: INK }} aria-label="Decrease quantity">
                  −
                </button>
                <span className="text-sm font-medium w-4 text-center" style={{ color: INK }}>{qty}</span>
                <button
                  onClick={() => setQty((q) => (stock > 0 && finiteStock ? Math.min(stock, q + 1) : q + 1))}
                  disabled={plusDisabled}
                  className="text-base leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: INK }}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              {lowStockLeft && (
                <span className="text-xs font-medium" style={{ color: GOLD_DARK }}>Only {lowStockLeft} left</span>
              )}
              {sizeOutOfStock && (
                <span className="text-xs" style={{ color: INK_SOFT }}>Out of stock</span>
              )}
            </div>

            {/* Desktop CTAs: mobile uses the sticky bar */}
            <div className="hidden sm:flex flex-col gap-2.5 mt-8">
              <button
                onClick={handleBuyNow}
                disabled={sizeOutOfStock}
                className="w-full flex items-center justify-center gap-2 font-medium py-3.5 transition-opacity active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: SAGE, color: PAPER, borderRadius: '4px' }}
              >
                <Zap size={16} fill={PAPER} /> {sizeOutOfStock ? 'Out of Stock' : 'Buy Now'}
              </button>
              <button
                onClick={handleAddToCart}
                disabled={sizeOutOfStock}
                className="w-full flex items-center justify-center gap-2 font-medium py-3.5 transition-opacity active:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ border: `1px solid ${INK}`, color: INK, background: PAPER, borderRadius: '4px' }}
              >
                <ShoppingBag size={15} /> {sizeOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>

            {product.description && (
              <div className="mt-6 pt-6 sm:mt-8 sm:pt-8 text-sm leading-relaxed" style={{ color: INK_SOFT, borderTop: `1px solid ${LINE}` }}>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] mb-3" style={{ color: INK }}>
                  Description
                </h3>
                <p className="whitespace-pre-wrap break-words">{product.description}</p>
              </div>
            )}

            <div className="h-4 sm:h-0" />
          </div>
        </div>

        {/* Reviews: content-visibility skips rendering work until scrolled near */}
        {reviews?.length > 0 && (
          <div className="mt-20 sm:mt-28" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' }}>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] mb-8" style={{ color: INK }}>
              Customer Reviews
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-8">
              {reviews.map((r) => (
                <div key={r._id} className="pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
                  <div className="flex items-center gap-1 mb-2 text-xs" style={{ color: INK_SOFT }}>
                    <Star size={12} strokeWidth={1.5} style={{ fill: PEACH, color: PEACH }} />
                    <span style={{ color: INK }}>{r.rating}</span>
                    {r.isVerifiedPurchase && (
                      <span className="ml-1" style={{ color: NEUTRAL }}>· Verified purchase</span>
                    )}
                  </div>

                  <p className={`${display.className} text-sm leading-relaxed`} style={{ color: INK }}>
                    {r.comment}
                  </p>

                  {r.images?.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {r.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxImg(img)}
                          className="relative w-14 h-14 overflow-hidden shrink-0"
                          style={{ borderRadius: '3px', background: PEACH_WASH }}
                        >
                          <Image src={img} alt="" fill className="object-cover" sizes="56px" quality={50} />
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs mt-3" style={{ color: INK_SOFT }}>{r.customerName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        {related?.length > 0 && (
          <div className="mt-20 sm:mt-28" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] mb-8" style={{ color: INK }}>
              You may also like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
              {related.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      {/* Sticky mobile buy bar: portaled to <body> so no ancestor breaks fixed positioning */}
      {mounted && createPortal(
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 flex items-center gap-3 px-5 py-3"
          style={{ background: PAPER, borderTop: `1px solid ${LINE}`, zIndex: 9999 }}
        >
          <div className="shrink-0">
            <p className="text-base font-medium leading-none" style={{ color: INK }}>
              {showFrom && <span className="text-[11px] font-normal mr-1" style={{ color: INK_SOFT }}>From</span>}
              {formatINR(unitPrice)}
            </p>
            {unitCompareAtPrice > unitPrice && (
              <p className="text-[11px] line-through leading-none mt-1" style={{ color: NEUTRAL }}>
                {formatINR(unitCompareAtPrice)}
              </p>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={sizeOutOfStock}
            className="flex-1 flex items-center justify-center gap-1.5 font-medium py-2.5 text-sm disabled:opacity-40"
            style={{ border: `1px solid ${INK}`, color: INK, background: PAPER, borderRadius: '4px' }}
          >
            <ShoppingBag size={15} /> Cart
          </button>
          <button
            onClick={handleBuyNow}
            disabled={sizeOutOfStock}
            className="flex-1 flex items-center justify-center gap-1.5 font-medium py-2.5 text-sm disabled:opacity-40"
            style={{ background: SAGE, color: PAPER, borderRadius: '4px' }}
          >
            <Zap size={15} fill={PAPER} /> {sizeOutOfStock ? 'Sold out' : 'Buy now'}
          </button>
        </div>,
        document.body
      )}

      {/* Lazy-loaded modals: no JS cost until opened */}
      {mounted && lightboxImg && <Lightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />}
      {mounted && sizeChartOpen && sizeChartImages.length > 0 && (
        <SizeChartModal images={sizeChartImages} onClose={() => setSizeChartOpen(false)} />
      )}
    </div>
  );
}