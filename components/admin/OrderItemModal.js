'use client';

import { X } from 'lucide-react';
import { formatINR } from '@/lib/utils';

// Design tokens — same teal / gold / cream system as the rest of the site.
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';
const WASH = '#F5EFE0';
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';

export default function OrderItemModal({ item, image, categoryName, productSku, onClose }) {
  if (!item) return null;

  const addonImages = [item.pantOption?.image, item.shawlOption?.image].filter(Boolean);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(23,42,41,0.55)' }}
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full p-5"
        style={{ background: PAPER, borderRadius: '6px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium pr-4" style={{ color: TEAL }}>{item.name}</h3>
          <button onClick={onClose} className="shrink-0" style={{ color: INK_SOFT }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {image ? (
          <img src={image} alt={item.name} className="w-full h-56 object-cover mb-3" style={{ borderRadius: '4px' }} />
        ) : (
          <div
            className="w-full h-56 mb-3 flex items-center justify-center text-sm"
            style={{ background: WASH, borderRadius: '4px', color: INK_SOFT }}
          >
            No image available
          </div>
        )}

        {/* Pant/Shawl thumbnails — only rendered when at least one was selected */}
        {addonImages.length > 0 && (
          <div className="flex gap-2 mb-3">
            {item.pantOption?.image && (
              <div className="flex flex-col items-center gap-1">
                <img
                  src={item.pantOption.image}
                  alt={item.pantOption.name}
                  className="w-14 h-14 object-cover"
                  style={{ borderRadius: '4px', border: `1px solid ${LINE}` }}
                />
                <span className="text-[10px]" style={{ color: INK_SOFT }}>Pant</span>
              </div>
            )}
            {item.shawlOption?.image && (
              <div className="flex flex-col items-center gap-1">
                <img
                  src={item.shawlOption.image}
                  alt={item.shawlOption.name}
                  className="w-14 h-14 object-cover"
                  style={{ borderRadius: '4px', border: `1px solid ${LINE}` }}
                />
                <span className="text-[10px]" style={{ color: INK_SOFT }}>Shawl</span>
              </div>
            )}
          </div>
        )}

        <div className="text-sm space-y-1.5" style={{ color: INK }}>
          {categoryName && (
            <p><span style={{ color: INK_SOFT }}>Category:</span> {categoryName}</p>
          )}
          <p><span style={{ color: INK_SOFT }}>Color:</span> {item.color || '—'}</p>
          <p><span style={{ color: INK_SOFT }}>Size:</span> {item.size || '—'}</p>
          {item.sleeveType && (
            <p><span style={{ color: INK_SOFT }}>Sleeve Type:</span> {item.sleeveType}</p>
          )}
          {item.zipType && (
            <p><span style={{ color: INK_SOFT }}>Zip Type:</span> {item.zipType}</p>
          )}
          {item.pantOption?.name && (
            <p>
              <span style={{ color: INK_SOFT }}>Pant:</span> {item.pantOption.name}
              {item.pantOption.price > 0 && ` (+${formatINR(item.pantOption.price)})`}
            </p>
          )}
          {item.shawlOption?.name && (
            <p>
              <span style={{ color: INK_SOFT }}>Shawl:</span> {item.shawlOption.name}
              {item.shawlOption.price > 0 && ` (+${formatINR(item.shawlOption.price)})`}
            </p>
          )}
          <p><span style={{ color: INK_SOFT }}>Quantity ordered:</span> {item.qty}</p>
          <p><span style={{ color: INK_SOFT }}>Price:</span> {formatINR(item.price)} each</p>
          <p><span style={{ color: INK_SOFT }}>Subtotal:</span> {formatINR(item.price * item.qty)}</p>
          {productSku && <p><span style={{ color: INK_SOFT }}>Product SKU:</span> {productSku}</p>}
          {item.sku && <p><span style={{ color: INK_SOFT }}>Size SKU:</span> {item.sku}</p>}
          {item.pantOption?.sku && <p><span style={{ color: INK_SOFT }}>Pant SKU:</span> {item.pantOption.sku}</p>}
          {item.shawlOption?.sku && <p><span style={{ color: INK_SOFT }}>Shawl SKU:</span> {item.shawlOption.sku}</p>}
        </div>
      </div>
    </div>
  );
}