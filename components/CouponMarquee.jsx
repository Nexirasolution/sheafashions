'use client';

import { useEffect, useState } from 'react';
import { Tag, Truck } from 'lucide-react';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
// Keep these tokens in sync with Navbar if you tweak the palette.
const BG = '#064E4A';                       // deep teal bar
const TEXT = '#FFFDF5';                     // cream text
const TEXT_FAINT = 'rgba(255, 253, 245, 0.65)';
const ACCENT = '#C49A45';                   // gold icons / coupon code underline

// A quiet serif, matched to the wordmark used elsewhere on the site,
// so the marquee reads as part of the same brand rather than generic UI text.
const FONT = "Georgia, 'Times New Roman', serif";

export default function CouponMarquee() {
  const [coupons, setCoupons] = useState([]);
  const [freeShippingAbove, setFreeShippingAbove] = useState(null);

  useEffect(() => {
    fetch('/api/coupons?active=true')
      .then((r) => r.json())
      .then((d) => setCoupons(d.coupons || []))
      .catch(() => {});

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setFreeShippingAbove(d.settings?.freeShippingAbove ?? null))
      .catch(() => {});
  }, []);

  const freeShippingItem =
    freeShippingAbove != null ? { type: 'freeshipping', minOrderValue: freeShippingAbove } : null;

  const allItems = freeShippingItem ? [...coupons, freeShippingItem] : coupons;
  if (!allItems.length) return null;

  const items = [...allItems, ...allItems];

  return (
    <div className="relative overflow-hidden py-2" style={{ background: BG }}>
      {/* Fade edges */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10"
        style={{ background: `linear-gradient(to right, ${BG}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10"
        style={{ background: `linear-gradient(to left, ${BG}, transparent)` }}
      />

      <div className="flex animate-marquee whitespace-nowrap w-max">
        {items.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 mx-8 text-[12px] tracking-[0.3px]"
            style={{ color: TEXT, fontFamily: FONT }}
          >
            {i > 0 && <span className="mr-4" style={{ color: ACCENT }}>—</span>}

            {c.type === 'freeshipping' ? (
              <>
                <Truck size={12} strokeWidth={1.25} className="shrink-0" style={{ color: ACCENT }} />
                Free shipping on orders above ₹{c.minOrderValue}
              </>
            ) : (
              <>
                <Tag size={12} strokeWidth={1.25} className="shrink-0" style={{ color: ACCENT }} />
                Use{' '}
                <span
                  className="italic px-1.5"
                  style={{ color: ACCENT, borderBottom: `1px solid ${ACCENT}` }}
                >
                  {c.code}
                </span>
                {' '}for{' '}
                {c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}
                {c.minOrderValue > 0 && (
                  <span style={{ color: TEXT_FAINT }}> on orders above ₹{c.minOrderValue}</span>
                )}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}