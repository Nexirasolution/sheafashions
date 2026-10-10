'use client';

// Design tokens — same teal / gold / cream system as the rest of the storefront.
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';       // selected chips, low-stock notes
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const WASH = '#F5EFE0';       // image placeholder fill (light sand tint)
const DISABLED = '#C9BFA6';   // text on sold-out options

function AddonSelector({ label, options, activeId, onChange, formatINR }) {
  if (!options?.length) return null;
  const active = options.find((o) => o._id === activeId);

  return (
    <div>
      <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>{label}</p>
      <div className="flex gap-2.5 flex-wrap">
        {/* Explicit "None" choice — covers "without pant" / "without shawl" */}
        <button
          type="button"
          onClick={() => onChange('')}
          className="h-9 px-3 text-sm font-medium transition-colors"
          style={{
            borderRadius: '4px',
            border: `1px solid ${!activeId ? TEAL : LINE}`,
            background: !activeId ? TEAL : PAPER,
            color: !activeId ? PAPER : INK,
          }}
        >
          None
        </button>

        {options.map((opt) => {
          const outOfStock = (opt.stock ?? 0) <= 0;
          const isActive = activeId === opt._id;
          return (
            <button
              key={opt._id}
              type="button"
              disabled={outOfStock}
              onClick={() => onChange(opt._id)}
              className="flex items-center gap-2 h-9 pl-1.5 pr-3 text-sm font-medium transition-colors"
              style={{
                borderRadius: '4px',
                border: `1px solid ${outOfStock ? LINE : isActive ? TEAL : LINE}`,
                background: isActive ? TEAL : PAPER,
                color: outOfStock ? DISABLED : isActive ? PAPER : INK,
                textDecoration: outOfStock ? 'line-through' : 'none',
                cursor: outOfStock ? 'not-allowed' : 'pointer',
              }}
            >
              {opt.image && (
                <span
                  className="w-6 h-6 rounded-sm overflow-hidden shrink-0"
                  style={{ background: WASH }}
                >
                  <img src={opt.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </span>
              )}
              {opt.name}
              {opt.price > 0 && (
                <span style={{ opacity: 0.75 }}>+{formatINR(opt.price)}</span>
              )}
            </button>
          );
        })}
      </div>

      {active?.image && (
        <div className="mt-2.5 w-16 h-16 rounded-md overflow-hidden" style={{ background: WASH }}>
          <img src={active.image} alt={active.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </div>
      )}
      {active && active.stock > 0 && active.stock <= 5 && (
        <p className="mt-2 text-xs font-medium" style={{ color: TEAL }}>
          Only {active.stock} left in stock
        </p>
      )}
    </div>
  );
}

export default function ColorSizeSelector({
  variants,
  activeVariant,
  onColorChange,
  activeSize,
  onSizeChange,
  categoryType,
  sizeChartImages,
  onViewSizeChart,
  sleeveOptions,
  activeSleeve,
  onSleeveChange,
  zipOptions,
  activeZip,
  onZipChange,
  pantOptions,
  activePantId,
  onPantChange,
  shawlOptions,
  activeShawlId,
  onShawlChange,
  formatINR,
}) {
  const isJewellery = categoryType === 'jewellery';
  const sizeStock = (size) => activeVariant?.sizes?.find((s) => s.size === size)?.stock ?? 0;

  // Per-size pricing: a size may carry its own price, otherwise the variant price applies.
  const variantPrice = Number(activeVariant?.price) || 0;
  const priceOfSize = (s) => (Number(s?.price) > 0 ? Number(s.price) : variantPrice);
  const showSizePrices = !!activeVariant?.sizes?.some((s) => priceOfSize(s) !== variantPrice);

  const hasColors = variants?.some((v) => v.color && v.color.trim());
  const hasSizeChart = Array.isArray(sizeChartImages) && sizeChartImages.length > 0;
  const hasSleeveOptions = Array.isArray(sleeveOptions) && sleeveOptions.length > 0;
  const hasZipOptions = Array.isArray(zipOptions) && zipOptions.length > 0;

  return (
    <div className="space-y-6">

      {/* Color selector */}
      {hasColors && (
        <div>
          <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>
            {isJewellery ? 'Material/Colour' : 'Color'}
            {' '}
            <span className="font-medium" style={{ color: INK }}>{activeVariant?.color}</span>
          </p>

          <div className="flex gap-2.5 flex-wrap">
            {variants.map((v) => {
              const isActive = activeVariant?._id === v._id;
              return (
                <button
                  key={v._id}
                  onClick={() => onColorChange(v)}
                  title={v.color}
                  aria-label={v.color}
                  aria-pressed={isActive}
                  className="relative w-8 h-8 rounded-full transition-transform"
                  style={{
                    backgroundColor: v.colorHex || '#ccc',
                    border: '1px solid #000', // thin black border
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Jewellery attributes — plain labels separated by a dot, no chips */}
      {isJewellery && (activeVariant?.material || activeVariant?.purity || activeVariant?.weight > 0) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: INK_SOFT }}>
          {[activeVariant?.material, activeVariant?.purity, activeVariant?.weight > 0 ? `${activeVariant.weight}g` : null]
            .filter(Boolean)
            .map((label, i, arr) => (
              <span key={label} className="flex items-center gap-2">
                <span style={{ color: INK }}>{label}</span>
                {i < arr.length - 1 && <span style={{ color: LINE }}>·</span>}
              </span>
            ))}
        </div>
      )}

      {/* Size selector */}
      <div>
        <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>
          {isJewellery ? 'Ring/Bangle Size' : 'Size'}
        </p>

        <div className="flex gap-2 flex-wrap">
          {activeVariant?.sizes?.map((s) => {
            const outOfStock = s.stock <= 0;
            const active = activeSize === s.size;
            return (
              <button
                key={s.size}
                disabled={outOfStock}
                onClick={() => onSizeChange(s.size)}
                className={`${showSizePrices ? 'min-w-[64px] h-[48px] px-3 flex flex-col items-center justify-center leading-tight' : 'min-w-[40px] h-[36px] px-2.5'} text-sm font-medium transition-colors`}
                style={{
                  borderRadius: '4px',
                  border: `1px solid ${outOfStock ? LINE : active ? TEAL : LINE}`,
                  background: active ? TEAL : PAPER,
                  color: outOfStock ? DISABLED : active ? PAPER : INK,
                  textDecoration: outOfStock ? 'line-through' : 'none',
                  cursor: outOfStock ? 'not-allowed' : 'pointer',
                }}
              >
                {s.size}
                {showSizePrices && (
                  <span className="text-[11px] font-normal" style={{ opacity: 0.75 }}>
                    {formatINR(priceOfSize(s))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeSize && sizeStock(activeSize) <= 5 && sizeStock(activeSize) > 0 && (
          <p className="mt-2.5 text-xs font-medium" style={{ color: TEAL }}>
            Only {sizeStock(activeSize)} left in stock
          </p>
        )}

        {/* Size chart — resolved by the parent as product.sizeChart, falling
            back to category.sizeChart. Opens a swipeable carousel when there's
            more than one image. */}
        {hasSizeChart && (
          <button
            type="button"
            onClick={onViewSizeChart}
            className="mt-2.5 text-xs font-medium underline underline-offset-2"
            style={{ color: INK_SOFT }}
          >
            View size chart{sizeChartImages.length > 1 ? ` (${sizeChartImages.length})` : ''}
          </button>
        )}
      </div>

      {/* Sleeve type selector — product-level, shown only if the admin
          picked one or more allowed options for this product. */}
      {hasSleeveOptions && (
        <div>
          <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>Sleeve Type</p>
          <div className="flex gap-2 flex-wrap">
            {sleeveOptions.map((opt) => {
              const active = activeSleeve === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onSleeveChange(opt)}
                  className="h-[36px] px-3 text-sm font-medium transition-colors"
                  style={{
                    borderRadius: '4px',
                    border: `1px solid ${active ? TEAL : LINE}`,
                    background: active ? TEAL : PAPER,
                    color: active ? PAPER : INK,
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Zip type selector — same pattern as sleeve type */}
      {hasZipOptions && (
        <div>
          <p className="text-sm mb-2.5" style={{ color: INK_SOFT }}>Zip Type</p>
          <div className="flex gap-2 flex-wrap">
            {zipOptions.map((opt) => {
              const active = activeZip === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onZipChange(opt)}
                  className="h-[36px] px-3 text-sm font-medium transition-colors"
                  style={{
                    borderRadius: '4px',
                    border: `1px solid ${active ? TEAL : LINE}`,
                    background: active ? TEAL : PAPER,
                    color: active ? PAPER : INK,
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pant selector — optional add-on. "None" covers "without pant". */}
      <AddonSelector
        label="Pant"
        options={pantOptions}
        activeId={activePantId}
        onChange={onPantChange}
        formatINR={formatINR}
      />

      {/* Shawl selector — same pattern as Pant */}
      <AddonSelector
        label="Shawl"
        options={shawlOptions}
        activeId={activeShawlId}
        onChange={onShawlChange}
        formatINR={formatINR}
      />
    </div>
  );
}