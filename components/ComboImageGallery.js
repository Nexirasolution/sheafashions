'use client';

import { useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const GOLD = '#C49A45';
const TEAL = '#064E4A';
const CREAM_GLASS = 'rgba(255,253,245,0.9)';

// `peachLight` and `line` are passed in by the parent (ColorPackSelector).
// The prop name `peachLight` is kept so callers don't need to change.
export default function ComboImageGallery({ images, alt, peachLight, line, badge }) {
  const list = images?.length ? images : [];
  const trackRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const scrollToIdx = useCallback((idx) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(idx, list.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
    setActiveIdx(clamped);
  }, [list.length]);

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  }

  return (
    <div className="w-full">
      <div
        className="relative w-full aspect-[4/5] sm:aspect-square overflow-hidden"
        style={{ border: `1px solid ${line}`, borderRadius: '2px' }}
      >
        {list.length > 0 ? (
          <>
            <div
              ref={trackRef}
              onScroll={handleScroll}
              className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ scrollBehavior: 'smooth' }}
            >
              {list.map((img, i) => (
                <div key={i} className="relative w-full h-full shrink-0 snap-center">
                  <Image
                    src={img}
                    alt={i === 0 ? alt : `${alt} — image ${i + 1}`}
                    fill
                    sizes="(max-width:640px) 100vw, 50vw"
                    className="object-cover"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>

            {list.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollToIdx(activeIdx - 1)}
                  disabled={activeIdx === 0}
                  aria-label="Previous image"
                  className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center disabled:opacity-0 transition-opacity"
                  style={{ background: CREAM_GLASS, color: TEAL, borderRadius: '2px' }}
                >
                  <ChevronLeft size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToIdx(activeIdx + 1)}
                  disabled={activeIdx === list.length - 1}
                  aria-label="Next image"
                  className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center disabled:opacity-0 transition-opacity"
                  style={{ background: CREAM_GLASS, color: TEAL, borderRadius: '2px' }}
                >
                  <ChevronRight size={16} strokeWidth={2} />
                </button>

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {list.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => scrollToIdx(i)}
                      aria-label={`Go to image ${i + 1}`}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: activeIdx === i ? '16px' : '6px',
                        background: activeIdx === i ? GOLD : 'rgba(255,253,245,0.85)',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full" style={{ background: peachLight }} />
        )}
        {badge}
      </div>
    </div>
  );
}