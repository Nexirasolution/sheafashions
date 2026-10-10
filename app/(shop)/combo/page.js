export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Combo from '@/models/Combo';
import Link from 'next/link';
import { formatINR } from '@/lib/utils';
import { Tag } from 'lucide-react';

// Theme: #064E4A (deep teal), #C49A45 (gold), #FFFDF5 (cream), #172A29 (dark teal), #E7DCC5 (sand)
const INK = '#172A29';          // primary text
const INK_SOFT = '#6B7F7C';     // muted text (derived teal-gray)
const PEACH = '#C49A45';        // accent (gold)
const PEACH_LIGHT = '#E7DCC5';  // accent background (sand)
const LINE = '#E7DCC5';         // borders (sand)
const PAPER = '#FFFDF5';        // page background (cream)
const SAGE = '#064E4A';         // deep teal (badges, prices)
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

async function getCombos() {
  await dbConnect();
  const combos = await Combo.find({ isActive: true }).sort({ createdAt: -1 }).lean();
  return JSON.parse(JSON.stringify(combos));
}

export default async function CombosPage() {
  const combos = await getCombos();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 min-h-[60vh]" style={{ background: PAPER }}>
      <div className="flex flex-col items-center text-center mb-10 sm:mb-12">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: PEACH }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>Save more</span>
        </div>
        <h1
          className="text-[28px] sm:text-4xl leading-tight"
          style={{ color: INK, fontFamily: FONT_SERIF }}
        >
          Combo Offers
        </h1>
        <p className="text-sm mt-2" style={{ color: INK_SOFT }}>Buy together, save together</p>
      </div>

      {combos.length === 0 ? (
        <div className="text-center py-20" style={{ color: INK_SOFT }}>
          <Tag size={32} className="mx-auto mb-3" style={{ color: PEACH, opacity: 0.4 }} strokeWidth={1.5} />
          <p className="text-sm">No combo offers available right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {combos.map((c) => {
            const isColorPack = c.type === 'color-pack';
            const cheapestPack = isColorPack && c.packOptions?.length
              ? c.packOptions.reduce((min, p) => (p.price < min.price ? p : min), c.packOptions[0])
              : null;

            const displayPrice = isColorPack ? cheapestPack?.price ?? 0 : c.comboPrice;
            const displayOriginal = isColorPack ? cheapestPack?.originalPrice ?? 0 : c.originalPrice;
            const savings = displayOriginal > displayPrice ? displayOriginal - displayPrice : 0;
            const pct = displayOriginal > 0 ? Math.round((savings / displayOriginal) * 100) : 0;

            return (
              <Link
                key={c._id}
                href={`/combo/${c.slug}`}
                className="group block"
              >
                <div
                  className="relative w-full aspect-[4/5] overflow-hidden"
                  style={{ background: PEACH_LIGHT, border: `1px solid ${LINE}`, borderRadius: '2px' }}
                >
                  {c.images?.[0] && (
                    <img
                      src={c.images[0]}
                      alt={c.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  {pct > 0 && (
                    <div
                      className="absolute top-2 left-2 text-[10px] font-medium px-2 py-1 flex items-center gap-1"
                      style={{ background: SAGE, color: PAPER, borderRadius: '2px' }}
                    >
                      <Tag size={10} strokeWidth={2} /> {pct}% off
                    </div>
                  )}
                  {isColorPack && (
                    <div
                      className="absolute top-2 right-2 text-[10px] font-medium px-2 py-1"
                      style={{ background: INK, color: PAPER, borderRadius: '2px' }}
                    >
                      Color pack
                    </div>
                  )}
                </div>

                <div className="pt-2.5 sm:pt-3">
                  <p className="text-[13px] sm:text-sm leading-snug line-clamp-1" style={{ color: INK }}>{c.name}</p>
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: SAGE }}>
                      {isColorPack && 'From '}{formatINR(displayPrice)}
                    </span>
                    {savings > 0 && (
                      <span className="text-[11px] line-through" style={{ color: INK_SOFT, opacity: 0.7 }}>{formatINR(displayOriginal)}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}