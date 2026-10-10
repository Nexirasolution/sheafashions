'use client';

import Image from 'next/image';
import { Star, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

// Design tokens — shared teal / gold / cream theme
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL = '#064E4A';
const GOLD = '#C49A45';
const INK = '#172A29';
const INK_FAINT = '#6B7C7A';
const HAIRLINE = '#E7DCC5';
const WASH = '#F5EFE0';
const PAPER = '#FFFDF5';

const FONT_SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default function ReviewSection({ reviews }) {
  const scrollerRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // { src, customerName }

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => e.key === 'Escape' && setLightbox(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox]);

  if (!reviews?.length) return null;

  const scrollByAmount = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('[data-review-card]')?.offsetWidth || 280;
    el.scrollBy({ left: dir * (cardWidth + 32), behavior: 'smooth' });
  };

  return (
    <section
      className="py-16 border-t"
      style={{ background: PAPER, borderColor: HAIRLINE, fontFamily: FONT_SANS }}
    >
      <div className="max-w-6xl mx-auto px-4">

        {/* Heading — quiet eyebrow, serif title, thin divider (matches Reels section) */}
        <div className="flex flex-col items-center text-center mb-10">
          <p
            className="text-[11px] font-semibold uppercase tracking-[4px]"
            style={{ color: INK_FAINT }}
          >
            Real Customers
          </p>
          <h2
            className="mt-3 text-2xl sm:text-3xl font-normal tracking-tight"
            style={{ color: TEAL, fontFamily: FONT_SERIF }}
          >
            What They&rsquo;re Saying
          </h2>

          <div className="flex items-center justify-center gap-3 mt-5">
            <span style={{ width: '28px', height: '1px', background: HAIRLINE }} />
            <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
            <span style={{ width: '28px', height: '1px', background: HAIRLINE }} />
          </div>

          <p className="text-[13px] mt-5 font-light" style={{ color: INK_FAINT }}>
            A few words from people who&rsquo;ve already ordered
          </p>

          {/* Nav arrows — desktop only, mobile relies on native swipe */}
          <div className="hidden sm:flex items-center gap-2 mt-5">
            <button
              onClick={() => scrollByAmount(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#E7DCC5]"
              style={{ background: 'transparent', color: TEAL, border: `1px solid ${HAIRLINE}` }}
              aria-label="Previous reviews"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => scrollByAmount(1)}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-[#E7DCC5]"
              style={{ background: 'transparent', color: TEAL, border: `1px solid ${HAIRLINE}` }}
              aria-label="Next reviews"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Horizontal scrollable row: open cards, just a top rule, no boxes */}
        <div
          ref={scrollerRef}
          className="flex gap-8 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {reviews.map((r) => (
            <div
              key={r._id}
              data-review-card
              className="snap-start shrink-0 w-[250px] sm:w-[290px] pt-5"
              style={{ borderTop: `1px solid ${TEAL}` }}
            >
              {/* Rating */}
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    size={12}
                    strokeWidth={1.5}
                    style={
                      s < r.rating
                        ? { fill: GOLD, color: GOLD }
                        : { fill: 'none', color: HAIRLINE }
                    }
                  />
                ))}
              </div>

              {/* Comment */}
              <p
                className="text-[14px] line-clamp-5 mb-5"
                style={{ color: INK, fontFamily: FONT_SERIF, lineHeight: 1.7 }}
              >
                &ldquo;{r.comment}&rdquo;
              </p>

              {/* Review image — zoomable thumbnail */}
              {r.images?.[0] && (
                <button
                  type="button"
                  onClick={() => setLightbox({ src: r.images[0], customerName: r.customerName })}
                  className="group relative w-16 h-16 mb-5 overflow-hidden block"
                  style={{ border: `1px solid ${HAIRLINE}`, background: WASH }}
                  aria-label="View full review photo"
                >
                  <Image
                    src={r.images[0]}
                    alt="Review photo"
                    fill
                    sizes="64px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(23,42,41,0.4)' }}
                  >
                    <ZoomIn size={16} color={PAPER} strokeWidth={1.75} />
                  </span>
                </button>
              )}

              {/* Footer */}
              <p
                className="text-[11px] font-bold tracking-[1.5px] uppercase"
                style={{ color: TEAL }}
              >
                {r.customerName}
              </p>
              {r.product?.name && (
                <p
                  className="text-[11px] mt-1 font-light line-clamp-1"
                  style={{ color: INK_FAINT }}
                >
                  {r.product.name}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox — minimal, image-first */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(23,42,41,0.85)' }}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 p-2 transition-colors"
            style={{ color: PAPER }}
            aria-label="Close"
          >
            <X size={22} strokeWidth={1.5} />
          </button>

          <div
            className="relative w-full max-w-xl"
            style={{ background: PAPER, border: `1px solid ${HAIRLINE}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-square" style={{ background: WASH }}>
              <Image
                src={lightbox.src}
                alt={`${lightbox.customerName || 'Customer'} review photo`}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 100vw, 576px"
                priority
              />
            </div>
            {lightbox.customerName && (
              <div className="px-4 py-3 text-center" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <p
                  className="text-[11px] font-bold tracking-[1.5px] uppercase"
                  style={{ color: TEAL }}
                >
                  {lightbox.customerName}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}