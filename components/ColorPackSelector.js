'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/utils';
import ComboImageGallery from './ComboImageGallery';
import { ShoppingBag, Zap, Ruler, Minus, Plus, PackageCheck, AlertCircle, ChevronDown } from 'lucide-react';
import { piecesPerUnit } from '@/lib/comboPieces';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
// Keep in sync with the rest of the storefront.
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';      // primary actions, prices, active states
const GOLD = '#C49A45';      // small decorative accent only (gold text on cream is low contrast)
const WASH = '#F5EFE0';      // light sand tint for selected / soft fills
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

const GENERIC_SIZE_CHART = [
  { size: 'S', chest: '34-36', waist: '28-30', length: '27' },
  { size: 'M', chest: '38-40', waist: '32-34', length: '28' },
  { size: 'L', chest: '42-44', waist: '36-38', length: '29' },
  { size: 'XL', chest: '46-48', waist: '40-42', length: '30' },
  { size: 'XXL', chest: '50-52', waist: '44-46', length: '31' },
];

const SEP = '||';
const keyOf = (name, size) => `${name}${SEP}${size}`;

export default function ColorPackSelector({ combo }) {
  const { addItem } = useCart();
  const router = useRouter();

  const baseProduct = combo.baseProduct;
  const variants = baseProduct?.variants || [];

  const colorOptions = useMemo(
    () =>
      (combo.colors || []).map((c) => {
        const variant =
          variants.find((v) => v._id === c.variantId) ||
          variants.find((v) => v.color?.toLowerCase().trim() === c.name?.toLowerCase().trim());
        return { ...c, variant };
      }),
    [combo.colors, variants]
  );

  // Fallback size list for colors whose variant could not be matched:
  // the combo's own size chart (server still validates real stock).
  const fallbackSizes = useMemo(() => {
    const set = new Set();
    colorOptions.forEach((c) => c.variant?.sizes?.forEach((s) => set.add(s.size)));
    if (set.size === 0 && combo.sizeChart?.length) {
      combo.sizeChart.forEach((row) => row.size && set.add(row.size));
    }
    return Array.from(set);
  }, [colorOptions, combo.sizeChart]);

  // selection: { 'Red||M': 2, 'Red||L': 1, 'Blue||L': 2 }
  const [selection, setSelection] = useState({});
  const [selectedPackIdx, setSelectedPackIdx] = useState(0);
  const [activeColor, setActiveColor] = useState('');
  const [showSizeChart, setShowSizeChart] = useState(false);

  useEffect(() => {
    if (!activeColor && colorOptions.length) setActiveColor(colorOptions[0].name);
  }, [colorOptions, activeColor]);

  const pack = combo.packOptions?.[selectedPackIdx];
  const packSize = pack?.size || 0;

  const entries = useMemo(
    () =>
      Object.entries(selection).map(([k, qty]) => {
        const [name, size] = k.split(SEP);
        return { name, size, qty };
      }),
    [selection]
  );

  const totalSelected = entries.reduce((s, e) => s + e.qty, 0);
  const remaining = packSize - totalSelected;
  const savings = pack ? Math.max((pack.originalPrice || 0) - pack.price, 0) : 0;
  const savingsPct = pack?.originalPrice > 0 ? Math.round((savings / pack.originalPrice) * 100) : 0;

  function colorTotal(name) {
    return entries.filter((e) => e.name === name).reduce((s, e) => s + e.qty, 0);
  }

  // Sizes offered for a color, with live stock for each (null = unknown/unlimited)
  function sizesFor(colorOpt) {
    if (colorOpt.variant?.sizes?.length) {
      return colorOpt.variant.sizes.map((s) => ({ size: s.size, stock: s.stock ?? 0 }));
    }
    return fallbackSizes.map((size) => ({ size, stock: null }));
  }

  function handlePackChange(idx) {
    setSelectedPackIdx(idx);
    setSelection({});
  }

  function updateQty(colorName, size, delta) {
    setSelection((prev) => {
      const key = keyOf(colorName, size);
      const cur = prev[key] || 0;
      const opt = colorOptions.find((c) => c.name === colorName);
      let next = Math.max(0, cur + delta);

      // 1) live stock of this color in this size
      const sizeStock = sizesFor(opt).find((s) => s.size === size)?.stock;
      if (sizeStock != null) next = Math.min(next, sizeStock);

      // 2) admin-set stock caps the color across ALL sizes
      const prevEntries = Object.entries(prev).filter(([k]) => k !== key);
      const colorOthers = prevEntries
        .filter(([k]) => k.split(SEP)[0] === colorName)
        .reduce((s, [, q]) => s + q, 0);
      if (opt?.stock != null) next = Math.min(next, Math.max(0, opt.stock - colorOthers));

      // 3) never exceed the pack size
      const othersTotal = prevEntries.reduce((s, [, q]) => s + q, 0);
      next = Math.min(next, Math.max(0, packSize - othersTotal));

      const copy = { ...prev };
      if (next <= 0) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }

  const activeVariant =
    colorOptions.find((c) => c.name === activeColor)?.variant || colorOptions[0]?.variant;

  // Combo's own uploaded images take priority; variant images are only a
  // fallback for combos where the admin uploaded nothing.
  const images = combo.images?.length ? combo.images : activeVariant?.images?.length ? activeVariant.images : [];

  const canAdd = packSize > 0 && remaining === 0;

  function buildItem() {
    const picked = entries
      .filter((e) => e.qty > 0)
      .sort((a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size));
    const distinctSizes = [...new Set(picked.map((e) => e.size))];

    // Unique per pack size + color/size mix, so different packs never merge in the cart.
    const packKey = [
      `p${packSize}`,
      ...picked.map((e) => `${e.name.replace(/\s+/g, '_')}-${e.size.replace(/\s+/g, '_')}${e.qty}`),
    ].join('_');

    return {
      productId: baseProduct?._id,
      comboId: combo._id,
      variantId: 'color-pack',
      isCombo: true,
      name: `${combo.name} (Pack of ${packSize})`,
      image: images[0] || combo.images?.[0],
      color: picked.map((e) => `${e.name} (${e.size}) x${e.qty}`).join(', '),
      size: distinctSizes.join(', '),
      price: pack?.price || 0,
      qty: 1, // number of packs
      pieces: piecesPerUnit(combo, packSize), // pieces in ONE pack (drives shipping weight fallback)
      packKey,
      packDetails: {
        packSize,
        size: distinctSizes.join(', '),
        colors: picked.map((e) => ({ name: e.name, size: e.size, qty: e.qty })),
      },
      // Cap the number of packs by the pack option's own stock when set
      ...(pack?.stock != null ? { stock: pack.stock } : {}),
    };
  }

  function handleAddToCart() {
    if (!canAdd) return;
    addItem(buildItem());
  }
  function handleBuyNow() {
    if (!canAdd) return;
    addItem(buildItem());
    router.push('/checkout');
  }

  const helperText = packSize === 0
    ? 'This combo has no pack options set up yet'
    : remaining > 0
    ? `Pick ${remaining} more piece${remaining === 1 ? '' : 's'} to continue`
    : '';

  const sizeChartRows = combo.sizeChart?.length ? combo.sizeChart : GENERIC_SIZE_CHART;

  return (
    <div className="grid sm:grid-cols-2 gap-6 sm:gap-10">
      {/* Gallery (prop name `peachLight` is kept so ComboImageGallery needs no change) */}
      <ComboImageGallery
        images={images}
        alt={activeColor || combo.name}
        peachLight={WASH}
        line={LINE}
        badge={
          savingsPct > 0 && (
            <div
              className="absolute top-3 left-3 text-xs px-2.5 py-1"
              style={{ background: PAPER, color: TEAL, borderRadius: '2px' }}
            >
              {savingsPct}% off
            </div>
          )
        }
      />

      <div className="flex flex-col pb-24 sm:pb-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>Exclusive bundle</span>
        </div>
        <h1
          className="text-[26px] sm:text-[34px] leading-[1.1]"
          style={{ color: INK, fontFamily: FONT_SERIF }}
        >
          {combo.name}
        </h1>
        {combo.description && (
          <p className="text-sm mt-3 leading-relaxed max-w-[42ch]" style={{ color: INK_SOFT }}>{combo.description}</p>
        )}

        {/* Price */}
        <div className="mt-5 py-4" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
          {pack ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-[26px] font-semibold" style={{ color: TEAL }}>{formatINR(pack.price || 0)}</span>
                {pack.originalPrice > pack.price && (
                  <span className="line-through text-base" style={{ color: INK_SOFT, opacity: 0.8 }}>{formatINR(pack.originalPrice)}</span>
                )}
              </div>
              {savings > 0 && (
                <p className="text-sm mt-1.5" style={{ color: TEAL }}>
                  You save {formatINR(savings)} ({savingsPct}% off)
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: INK_SOFT }}>No pack options configured yet.</p>
          )}
        </div>

        {/* Pack option */}
        <div className="mt-6">
          <h3 className="text-sm mb-3" style={{ color: INK }}>Choose pack</h3>
          {combo.packOptions?.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {combo.packOptions.map((p, i) => {
                const pctOff = p.originalPrice > 0 ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
                const active = selectedPackIdx === i;
                const outOfStock = p.stock != null && p.stock <= 0;
                return (
                  <button
                    key={i}
                    onClick={() => !outOfStock && handlePackChange(i)}
                    disabled={outOfStock}
                    className="p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderRadius: '2px',
                      border: `1px solid ${active ? TEAL : LINE}`,
                      background: active ? WASH : PAPER,
                    }}
                  >
                    <p className="text-sm" style={{ color: INK }}>Pack of {p.size}</p>
                    <p className="font-semibold text-sm mt-0.5" style={{ color: TEAL }}>{formatINR(p.price)}</p>
                    {outOfStock ? (
                      <p className="text-[11px] mt-0.5" style={{ color: INK_SOFT }}>Out of stock</p>
                    ) : (
                      pctOff > 0 && <p className="text-[11px] mt-0.5" style={{ color: TEAL }}>{pctOff}% off</p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs" style={{ color: INK_SOFT }}>No pack sizes available yet.</p>
          )}
        </div>

        {/* Colors + sizes */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm" style={{ color: INK }}>
              Choose colors &amp; sizes <span style={{ color: INK_SOFT }}>({totalSelected}/{packSize})</span>
            </h3>
            {packSize > 0 && (
              remaining > 0 ? (
                <span className="text-xs flex items-center gap-1" style={{ color: TEAL }}>
                  <AlertCircle size={12} strokeWidth={2} /> {remaining} more
                </span>
              ) : (
                <span className="text-xs flex items-center gap-1" style={{ color: TEAL }}>
                  <PackageCheck size={12} strokeWidth={2} /> Complete
                </span>
              )
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Mix any colors and sizes — e.g. 2 in M and 3 in L.
          </p>

          {/* Size chart trigger */}
          <button
            onClick={() => setShowSizeChart((v) => !v)}
            className="flex items-center gap-1 text-xs mb-3"
            style={{ color: TEAL }}
          >
            <Ruler size={13} strokeWidth={1.75} /> Size chart
            <ChevronDown
              size={12}
              strokeWidth={2}
              style={{
                transform: showSizeChart ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
            />
          </button>

          {showSizeChart && (
            <div className="mb-4 p-4" style={{ border: `1px solid ${LINE}`, borderRadius: '2px', background: WASH }}>
              <p className="text-xs mb-3" style={{ color: INK_SOFT }}>All measurements in inches.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                    <th className="py-2 font-normal">Size</th>
                    <th className="py-2 font-normal">Chest</th>
                    <th className="py-2 font-normal">Waist</th>
                    <th className="py-2 font-normal">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeChartRows.map((row) => (
                    <tr key={row.size} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td className="py-2" style={{ color: INK }}>{row.size}</td>
                      <td className="py-2" style={{ color: INK_SOFT }}>{row.chest}</td>
                      <td className="py-2" style={{ color: INK_SOFT }}>{row.waist}</td>
                      <td className="py-2" style={{ color: INK_SOFT }}>{row.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {colorOptions.length > 0 ? (
            <div className="space-y-2.5">
              {colorOptions.map((c) => {
                const sizes = sizesFor(c);
                const total = colorTotal(c.name);
                const isActive = activeColor === c.name;
                const colorSoldOut = c.stock != null && c.stock <= 0;
                return (
                  <div
                    key={c.name}
                    onClick={() => setActiveColor(c.name)}
                    className="p-3 transition-colors"
                    style={{
                      borderRadius: '2px',
                      border: `1px solid ${isActive ? TEAL : LINE}`,
                      opacity: colorSoldOut ? 0.45 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span
                        className="w-6 h-6 rounded-full shrink-0"
                        style={{
                          backgroundColor: c.hex || '#ddd',
                          boxShadow: isActive ? `0 0 0 2px ${PAPER}, 0 0 0 3.5px ${TEAL}` : `0 0 0 1px ${LINE}`,
                        }}
                        title={c.name}
                      />
                      <p className="text-sm flex-1 truncate" style={{ color: INK }}>{c.name}</p>
                      <span className="text-[11px]" style={{ color: total > 0 ? TEAL : INK_SOFT }}>
                        {colorSoldOut ? 'Out of stock' : total > 0 ? `${total} selected` : c.stock != null ? `${c.stock} left` : ''}
                      </span>
                    </div>

                    {sizes.length > 0 ? (
                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {sizes.map(({ size, stock }) => {
                          const qty = selection[keyOf(c.name, size)] || 0;
                          const sizeSoldOut = stock != null && stock <= 0;
                          const disabledPlus = colorSoldOut || sizeSoldOut || remaining === 0;
                          return (
                            <div
                              key={size}
                              className="flex flex-col items-center px-2 py-1.5"
                              style={{
                                borderRadius: '2px',
                                border: `1px solid ${qty > 0 ? TEAL : LINE}`,
                                background: qty > 0 ? WASH : PAPER,
                                opacity: sizeSoldOut ? 0.4 : 1,
                                minWidth: '88px',
                              }}
                            >
                              <span className="text-xs font-medium" style={{ color: INK }}>{size}</span>
                              <span className="text-[10px] h-3" style={{ color: INK_SOFT }}>
                                {sizeSoldOut ? 'Sold out' : stock != null && stock <= 5 ? `${stock} left` : ''}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <button
                                  disabled={qty === 0}
                                  onClick={() => updateQty(c.name, size, -1)}
                                  aria-label={`Decrease ${c.name} ${size}`}
                                  className="w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-30"
                                  style={{ border: `1px solid ${LINE}`, color: INK, background: PAPER }}
                                >
                                  <Minus size={11} strokeWidth={2} />
                                </button>
                                <span className="w-4 text-center text-xs font-medium" style={{ color: INK }}>{qty}</span>
                                <button
                                  disabled={disabledPlus}
                                  onClick={() => updateQty(c.name, size, 1)}
                                  aria-label={`Increase ${c.name} ${size}`}
                                  className="w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-30"
                                  style={{ border: `1px solid ${LINE}`, color: INK, background: PAPER }}
                                >
                                  <Plus size={11} strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: INK_SOFT }}>No sizes available for this color.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs" style={{ color: INK_SOFT }}>No colors available for this combo yet.</p>
          )}

          {/* Summary of the current mix */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {entries
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size))
                .map((e) => (
                  <span
                    key={keyOf(e.name, e.size)}
                    className="text-[11px] px-2 py-0.5"
                    style={{ background: WASH, color: INK, borderRadius: '2px' }}
                  >
                    {e.name} · {e.size} × {e.qty}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden sm:block mt-8">
          <div className="flex gap-2.5">
            <button
              onClick={handleAddToCart}
              disabled={!canAdd}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full active:scale-[0.98] transition-transform disabled:cursor-not-allowed"
              style={{
                border: `1px solid ${canAdd ? TEAL : LINE}`,
                color: canAdd ? TEAL : INK_SOFT,
                background: PAPER,
              }}
            >
              <ShoppingBag size={16} strokeWidth={1.75} /> Add to cart
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!canAdd}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full transition-transform active:scale-[0.98] disabled:cursor-not-allowed"
              style={{
                background: canAdd ? TEAL : LINE,
                color: canAdd ? PAPER : INK_SOFT,
              }}
            >
              <Zap size={16} fill="currentColor" strokeWidth={0} /> Buy now
            </button>
          </div>
          {helperText && (
            <p className="text-xs text-center mt-2.5" style={{ color: INK_SOFT }}>{helperText}</p>
          )}
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
        style={{ background: PAPER, borderTop: `1px solid ${LINE}` }}
      >
        {helperText && (
          <p className="text-xs text-center mb-2" style={{ color: INK_SOFT }}>{helperText}</p>
        )}
        <div className="flex gap-2.5">
          <button
            onClick={handleAddToCart}
            disabled={!canAdd}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full active:scale-[0.98] transition-transform disabled:cursor-not-allowed"
            style={{
              border: `1px solid ${canAdd ? TEAL : LINE}`,
              color: canAdd ? TEAL : INK_SOFT,
              background: PAPER,
            }}
          >
            <ShoppingBag size={16} strokeWidth={1.75} /> Add
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!canAdd}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full transition-transform active:scale-[0.98] disabled:cursor-not-allowed"
            style={{
              background: canAdd ? TEAL : LINE,
              color: canAdd ? PAPER : INK_SOFT,
            }}
          >
            <Zap size={16} fill="currentColor" strokeWidth={0} /> Buy now
          </button>
        </div>
      </div>
    </div>
  );
}