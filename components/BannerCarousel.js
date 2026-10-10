'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Design tokens: shared with Navbar / CouponMarquee for a consistent system
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL = '#064E4A';
const GOLD = '#C49A45';
const HAIRLINE = '#E7DCC5';
const PAPER = '#FFFDF5';

export default function BannerCarousel({ banners }) {
  const [index, setIndex] = useState(0);
  // Slides whose images have been (or are about to be) shown. Images for the
  // rest are not requested at all, so the browser only downloads what it needs.
  const [seen, setSeen] = useState(() => new Set([0]));

  const count = banners?.length || 0;

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 4500);
    return () => clearInterval(t);
  }, [count]);

  useEffect(() => {
    if (!count) return;
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(index);
      next.add((index + 1) % count); // preload the upcoming slide
      return next;
    });
  }, [index, count]);

  if (!count) return null;

  return (
    <section className="relative w-full overflow-hidden" style={{ background: PAPER }}>
      {/*
        Image-only banner. Mobile gets a tall fixed-height box that the image
        fully fills (object-cover). Desktop keeps the wide aspect-ratio box.
        The box has a fixed size, so there is no layout shift while images load.
      */}
      <div className="relative w-full h-[500px] sm:h-0 sm:pb-[42.1%]">

        {banners.map((b, i) => {
          const mobileSrc = b.mobileImage || b.image;
          const isActive = i === index;
          const isFirst = i === 0;
          const shouldLoad = isActive || seen.has(i);

          return (
            <Link
              key={b._id}
              href={b.link || '#'}
              className={`absolute inset-0 block transition-opacity duration-700 ${
                isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${!b.link ? 'pointer-events-none' : ''}`}
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
            >
              {shouldLoad && (
                /*
                  <picture> makes the browser download ONE image (mobile or
                  desktop). Before, both <img> tags were requested for every
                  slide, so each visitor downloaded about 2x the banner images.
                */
                <picture>
                  <source media="(min-width: 640px)" srcSet={b.image} />
                  <img
                    src={mobileSrc}
                    alt={b.title || 'Banner'}
                    // First slide is the LCP element: load it first. Others are lazy.
                    loading={isFirst ? 'eager' : 'lazy'}
                    fetchPriority={isFirst ? 'high' : 'auto'}
                    decoding={isFirst ? 'sync' : 'async'}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </picture>
              )}
            </Link>
          );
        })}

        {count > 1 && (
          <>
            {/* Arrows: flat, quiet until hovered */}
            <button
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full transition z-10"
              style={{ background: PAPER, color: TEAL, border: `1px solid ${HAIRLINE}` }}
              aria-label="Previous"
            >
              <ChevronLeft size={15} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full transition z-10"
              style={{ background: PAPER, color: TEAL, border: `1px solid ${HAIRLINE}` }}
              aria-label="Next"
            >
              <ChevronRight size={15} strokeWidth={1.5} />
            </button>

            {/* Thin dash indicators */}
            <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className="rounded-full transition-all"
                  style={{
                    height: '3px',
                    width: i === index ? '22px' : '10px',
                    background: i === index ? GOLD : 'rgba(255,253,245,0.7)',
                    boxShadow: i === index ? `0 0 0 1px ${TEAL}40` : '0 0 0 1px rgba(23,42,41,0.15)',
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}