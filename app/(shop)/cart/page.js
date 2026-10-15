'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart, cartKey } from '@/components/CartContext';
import { useCartQuote } from '@/lib/useCartQuote';
import { formatINR } from '@/lib/utils';
import { Trash2, ShoppingBag } from 'lucide-react';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';
const WASH = '#F5EFE0';
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal } = useCart();
  // Checks the cart against the server and fixes stale prices / removed products.
  const { loading: syncing } = useCartQuote();

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center" style={{ background: PAPER }}>
        <ShoppingBag size={28} strokeWidth={1.5} className="mx-auto mb-4" style={{ color: TEAL, opacity: 0.5 }} />
        <p className="text-[15px] mb-1" style={{ color: INK, fontFamily: FONT_SERIF }}>Your cart is empty</p>
        <p className="text-sm mb-7" style={{ color: INK_SOFT }}>Add something beautiful from our collection.</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 text-sm font-medium transition-colors bg-[#064E4A] hover:bg-[#043B38]"
          style={{ color: PAPER, borderRadius: '4px' }}
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14" style={{ background: PAPER }}>
      <h1 className="text-[24px] sm:text-[28px] mb-8" style={{ fontFamily: FONT_SERIF, color: TEAL }}>
        Your Cart
      </h1>

      <div className="space-y-0">
        {items.map((item, idx) => {
          const key = cartKey(item);
          const details = [
            item.color && `Color: ${item.color}`,
            !item.packDetails && item.size && `Size: ${item.size}`,
            item.sleeveType,
            item.zipType,
            item.pantOption?.name && `Pant: ${item.pantOption.name}`,
            item.shawlOption?.name && `Shawl: ${item.shawlOption.name}`,
          ].filter(Boolean).join(' · ');

          return (
            <div
              key={key}
              className="flex gap-4 py-5"
              style={{ borderTop: idx === 0 ? `1px solid ${LINE}` : 'none', borderBottom: `1px solid ${LINE}` }}
            >
              {/* Product image */}
              <div className="relative shrink-0 w-16 h-20 sm:w-20 sm:h-24 overflow-hidden" style={{ background: WASH, borderRadius: '3px' }}>
                <Image src={item.image || '/placeholder.png'} alt={item.name} fill className="object-cover" />
              </div>

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-1" style={{ color: INK }}>{item.name}</p>
                {details && (
                  <p className="text-xs mt-1" style={{ color: INK_SOFT }}>{details}</p>
                )}
                {item.isCombo && item.pieces > 1 && (
                  <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>
                    {item.pieces} pieces{item.qty > 1 ? ` each · ${item.qty * item.pieces} total` : ''}
                  </p>
                )}
                <p className="text-sm mt-1.5" style={{ color: TEAL }}>{formatINR(item.price)}</p>

                {/* Qty controls + remove */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center" style={{ border: `1px solid ${LINE}`, borderRadius: '3px' }}>
                    <button
                      onClick={() => updateQty(key, item.qty - 1)}
                      className="px-2.5 py-1 text-sm transition-opacity active:opacity-60"
                      style={{ color: INK }}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="px-3 py-1 text-sm" style={{ color: INK, borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}` }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(key, item.qty + 1)}
                      className="px-2.5 py-1 text-sm transition-opacity active:opacity-60"
                      style={{ color: INK }}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(key)}
                    className="transition-opacity active:opacity-60"
                    style={{ color: INK_SOFT }}
                    aria-label="Remove item"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Line total */}
              <p className="text-sm shrink-0 self-start pt-0.5" style={{ color: INK }}>
                {formatINR(item.price * item.qty)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Subtotal */}
      <div className="flex items-center justify-between pt-6 mt-2">
        <span className="text-sm" style={{ color: INK_SOFT }}>
          Subtotal{syncing ? ' · checking prices…' : ''}
        </span>
        <span className="text-lg" style={{ color: TEAL, fontFamily: FONT_SERIF }}>{formatINR(subtotal)}</span>
      </div>

      {/* Checkout CTA */}
      <Link
        href="/checkout"
        className="block w-full text-center mt-6 py-3.5 text-sm font-medium transition-colors bg-[#064E4A] hover:bg-[#043B38]"
        style={{ color: PAPER, borderRadius: '4px' }}
      >
        Proceed to Checkout
      </Link>
    </div>
  );
}