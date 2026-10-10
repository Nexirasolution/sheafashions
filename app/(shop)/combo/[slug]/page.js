export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Combo from '@/models/Combo';
import { formatINR } from '@/lib/utils';
import AddComboButton from '@/components/AddComboButton';
import ColorPackSelector from '@/components/ColorPackSelector';
import ComboImageGallery from '@/components/ComboImageGallery';
import { Package, Tag, CheckCircle2, RotateCcw, Shield } from 'lucide-react';

// Theme: #064E4A (deep teal), #C49A45 (gold), #FFFDF5 (cream), #172A29 (dark teal), #E7DCC5 (sand)
const INK = '#172A29';          // primary text
const INK_SOFT = '#6B7F7C';     // muted text (derived teal-gray)
const PEACH = '#C49A45';        // accent (gold) - name kept so other components don't break
const PEACH_LIGHT = '#E7DCC5';  // accent background (sand)
const LINE = '#E7DCC5';         // borders (sand)
const PAPER = '#FFFDF5';        // page background (cream)
const SAGE = '#064E4A';         // savings / success (deep teal)
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default async function ComboPage({ params }) {
  await dbConnect();
  const combo = await Combo.findOne({ slug: params.slug, isActive: true })
    .populate('products.product', 'name slug variants')
    .populate('baseProduct', 'name slug variants')
    .lean();

  if (!combo) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-sm" style={{ color: INK_SOFT }}>Combo not found.</div>;
  }

  const plain = JSON.parse(JSON.stringify(combo));
  const isColorPack = plain.type === 'color-pack';

  const cheapestPack = isColorPack && plain.packOptions?.length
    ? plain.packOptions.reduce((min, p) => (p.price < min.price ? p : min), plain.packOptions[0])
    : null;

  const bannerSavings = isColorPack
    ? Math.max((cheapestPack?.originalPrice || 0) - (cheapestPack?.price || 0), 0)
    : Math.max((plain.originalPrice || 0) - (plain.comboPrice || 0), 0);
  const bannerOriginal = isColorPack ? cheapestPack?.originalPrice || 0 : plain.originalPrice || 0;
  const savingsPct = bannerOriginal > 0 ? Math.round((bannerSavings / bannerOriginal) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 sm:pb-10" style={{ background: PAPER }}>

      {savingsPct > 0 && (
        <div
          className="text-center text-xs py-2 mb-5 sm:mb-8"
          style={{ color: SAGE, background: PEACH_LIGHT, borderRadius: '2px' }}
        >
          Limited combo offer — save {savingsPct}% when you bundle
        </div>
      )}

      {isColorPack ? (
        <ColorPackSelector combo={plain} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-6 sm:gap-10">
          <ComboImageGallery
            images={plain.images}
            alt={plain.name}
            peachLight={PEACH_LIGHT}
            line={LINE}
            badge={
              savingsPct > 0 && (
                <div
                  className="absolute top-3 left-3 text-xs px-2.5 py-1"
                  style={{ background: SAGE, color: PAPER, borderRadius: '2px' }}
                >
                  {savingsPct}% off
                </div>
              )
            }
          />

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: PEACH }} />
              <span className="text-xs" style={{ color: INK_SOFT }}>Exclusive bundle</span>
            </div>
            <h1
              className="text-[26px] sm:text-[34px] leading-[1.1]"
              style={{ color: INK, fontFamily: FONT_SERIF }}
            >
              {plain.name}
            </h1>
            {plain.description && (
              <p className="text-sm mt-3 leading-relaxed max-w-[42ch]" style={{ color: INK_SOFT }}>{plain.description}</p>
            )}

            <div className="mt-5 sm:mt-6 py-4" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
              <div className="flex items-baseline gap-3">
                <span className="text-[26px] font-semibold" style={{ color: INK }}>{formatINR(plain.comboPrice)}</span>
                {plain.originalPrice > plain.comboPrice && (
                  <span className="line-through text-base" style={{ color: INK_SOFT, opacity: 0.6 }}>{formatINR(plain.originalPrice)}</span>
                )}
              </div>
              {plain.originalPrice - plain.comboPrice > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Tag size={13} style={{ color: SAGE }} strokeWidth={2} />
                  <p className="text-sm" style={{ color: SAGE }}>You save {formatINR(plain.originalPrice - plain.comboPrice)} with this combo</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Package size={15} style={{ color: PEACH }} strokeWidth={1.75} />
                <h3 className="text-sm" style={{ color: INK }}>What&rsquo;s included <span style={{ color: INK_SOFT }}>({plain.products?.length})</span></h3>
              </div>
              <div className="space-y-2">
                {plain.products?.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-3 py-2.5"
                    style={{ border: `1px solid ${LINE}`, borderRadius: '2px' }}
                  >
                    <CheckCircle2 size={15} style={{ color: SAGE }} className="shrink-0" strokeWidth={1.75} />
                    <span className="text-sm" style={{ color: INK }}>{p.product?.name || 'Product unavailable'}</span>
                    {p.size && (
                      <span
                        className="ml-auto text-xs px-2 py-0.5"
                        style={{ background: PEACH_LIGHT, color: INK, borderRadius: '2px' }}
                      >
                        Size {p.size}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop / tablet inline CTA */}
            <div className="hidden sm:block mt-8">
              <AddComboButton combo={plain} />
              <p className="text-xs text-center mt-2.5" style={{ color: INK_SOFT }}>
                Combo price applies automatically at checkout
              </p>
            </div>
          </div>
        </div>
      )}

      {/* <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="flex gap-3 items-start py-3" style={{ borderTop: `1px solid ${LINE}` }}>
          <RotateCcw size={18} style={{ color: PEACH }} className="shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm" style={{ color: INK }}>7-day returns</p>
            <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Not satisfied? Return within 7 days for a full refund.</p>
          </div>
        </div>
        <div className="flex gap-3 items-start py-3" style={{ borderTop: `1px solid ${LINE}` }}>
          <Shield size={18} style={{ color: PEACH }} className="shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm" style={{ color: INK }}>100% genuine</p>
            <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Every piece is quality-checked before dispatch.</p>
          </div>
        </div>
      </div> */}

      {!isColorPack && plain.originalPrice > plain.comboPrice && (
        <div className="mt-8 sm:mt-10 pt-6 text-center" style={{ borderTop: `1px solid ${LINE}` }}>
          <p className="text-sm" style={{ color: INK_SOFT }}>
            Buying individually would cost{' '}
            <span className="line-through">{formatINR(plain.originalPrice)}</span> — get this combo for just{' '}
            <span className="font-semibold" style={{ color: SAGE }}>{formatINR(plain.comboPrice)}</span>
          </p>
        </div>
      )}

      {!isColorPack && (
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
          style={{ background: PAPER, borderTop: `1px solid ${LINE}` }}
        >
          <AddComboButton combo={plain} />
        </div>
      )}

    </div>
  );
}