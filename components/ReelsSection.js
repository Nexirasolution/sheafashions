'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Instagram } from 'lucide-react';

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

// Only direct video files can go in a <video> tag (not Instagram embed URLs)
const isDirectVideoUrl = (url) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url || '');

function ReelMedia({ reel }) {
  const videoRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false); // attach src once, when first visible
  const [isVisible, setIsVisible] = useState(false);

  const canPlay = isDirectVideoUrl(reel.videoUrl);

  // Track visibility of the tile
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) setShouldLoad(true);
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [canPlay]);

  // Play while visible (after src is attached), pause otherwise
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true; // React's `muted` prop doesn't always set the attribute; iOS needs it
    if (shouldLoad && isVisible) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [shouldLoad, isVisible]);

  if (canPlay) {
    return (
      <video
        ref={videoRef}
        src={shouldLoad ? reel.videoUrl : undefined}
        poster={reel.thumbnail || undefined}
        muted
        loop
        playsInline
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  }

  // Fallback: thumbnail only
  return (
    <Image
      src={reel.thumbnail || '/placeholder.png'}
      alt={reel.title || 'Reel'}
      fill
      sizes="(max-width: 640px) 150px, 180px"
      className="object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}

export default function ReelsSection({ reels }) {
  if (!reels?.length) return null;

  return (
    <section
      className="py-16 border-t"
      style={{ background: PAPER, borderColor: HAIRLINE, fontFamily: FONT_SANS }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Heading: quiet eyebrow, serif title, thin divider, text link */}
        <div className="text-center mb-10">
          <p
            className="text-[11px] font-semibold uppercase tracking-[4px]"
            style={{ color: INK_FAINT }}
          >
            Watch &amp; Shop
          </p>
          <h2
            className="mt-3 text-2xl sm:text-3xl font-normal tracking-tight"
            style={{ color: TEAL, fontFamily: FONT_SERIF }}
          >
            Shop by Reels
          </h2>

          <div className="flex items-center justify-center gap-3 mt-5">
            <span style={{ width: '28px', height: '1px', background: HAIRLINE }} />
            <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
            <span style={{ width: '28px', height: '1px', background: HAIRLINE }} />
          </div>

          {/* <a
            href="https://instagram.com/ssrkcollections"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-5 text-[12px] tracking-[1.5px] uppercase transition-colors hover:opacity-70"
            style={{ color: INK }}
          >
            <Instagram size={14} strokeWidth={1.5} />
            <span style={{ borderBottom: `1px solid ${GOLD}` }}>Follow us on Instagram</span>
          </a> */}
        </div>

        {/* Reels row: square-cornered tiles, caption sits below the media */}
        <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
          {reels.map((reel) => {
            const hasVideo = isDirectVideoUrl(reel.videoUrl);
            return (
              <div
                key={reel._id}
                className="min-w-[150px] sm:min-w-[180px] shrink-0 snap-start group"
              >
                <div
                  className="relative aspect-[9/16] overflow-hidden"
                  style={{ background: WASH, border: `1px solid ${HAIRLINE}` }}
                >
                  <ReelMedia reel={reel} />

                  {/* Clickable overlay: opens the reel on Instagram */}
                  <a
                    href={reel.instagramLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Watch ${reel.title || 'reel'}`}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    {/* Play icon only when there's no autoplaying video */}
                    {!hasVideo && (
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: 'rgba(255,253,245,0.92)', color: TEAL }}
                      >
                        <Play size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
                      </span>
                    )}
                  </a>
                </div>

                {/* Caption + text CTA */}
                <div className="pt-3 text-center">
                  {reel.product?.name && (
                    <p
                      className="text-[12px] font-medium tracking-wide line-clamp-1"
                      style={{ color: INK }}
                    >
                      {reel.product.name}
                    </p>
                  )}
                  {reel.product?.slug && (
                    <Link
                      href={`/product/${reel.product.slug}`}
                      className="inline-block mt-1.5 text-[11px] font-bold tracking-[1.5px] uppercase transition-colors hover:opacity-70"
                      style={{ color: TEAL, borderBottom: `1px solid ${GOLD}` }}
                    >
                      Shop now
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}