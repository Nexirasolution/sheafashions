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
        MOBILE: the image is shown at full width with its natural height, so the
        WHOLE image is visible (nothing cropped, no gaps). All slides sit in the
        same grid cell, so the box is as tall as the image.
        DESKTOP (sm and up): fixed aspect-ratio box, image fills it (object-cover).
      */}
      <div className="relative w-full grid sm:block sm:aspect-[16/7] lg:aspect-[2.4/1]">

        {banners.map((b, i) => {
          const isActive = i === index;
          const isFirst = i === 0;
          const shouldLoad = isActive || seen.has(i);

          return (
            <Link
              key={b._id}
              href={b.link || '#'}
              className={`col-start-1 row-start-1 block w-full sm:absolute sm:inset-0 transition-opacity duration-700 ${
                isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              } ${!b.link ? 'pointer-events-none' : ''}`}
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
            >
              {shouldLoad && (
                <img
                  src={b.image}
                  alt={b.title || 'Banner'}
                  // First slide is the LCP element: load it first. Others are lazy.
                  loading={isFirst ? 'eager' : 'lazy'}
                  fetchPriority={isFirst ? 'high' : 'auto'}
                  decoding={isFirst ? 'sync' : 'async'}
                  className="block w-full h-auto sm:absolute sm:inset-0 sm:h-full object-cover object-center"
                />
              )}
            </Link>
          );
        })}

        {count > 1 && (
          <>
            {/* Arrows */}
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
            <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
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