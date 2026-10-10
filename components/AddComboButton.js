'use client';

import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Zap } from 'lucide-react';
import { piecesPerUnit } from '@/lib/comboPieces';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL = '#064E4A';
const TEAL_DARK = '#043B38';
const PAPER = '#FFFDF5';

export default function AddComboButton({ combo }) {
  const { addItem } = useCart();
  const router = useRouter();

  const item = {
    productId: combo._id,
    variantId: 'combo',
    comboId: combo._id,
    isCombo: true,
    name: combo.name,
    image: combo.images?.[0],
    color: '-',
    size: 'Combo',
    price: combo.comboPrice,
    qty: 1,
    // Pieces in ONE combo (admin-set piecesPerCombo, else products count)
    pieces: piecesPerUnit(combo),
  };

  function handleAddToCart() {
    addItem(item);
  }

  function handleBuyNow() {
    addItem(item);
    router.push('/checkout');
  }

  return (
    <div className="flex gap-2.5">
      <button
        onClick={handleAddToCart}
        className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full active:scale-[0.98] transition-transform"
        style={{ border: `1px solid ${TEAL}`, color: TEAL, background: PAPER }}
      >
        <ShoppingBag size={16} strokeWidth={1.75} />
        Add to cart
      </button>
      <button
        onClick={handleBuyNow}
        className="flex-1 flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-full transition-colors active:scale-[0.98]"
        style={{ background: TEAL, color: PAPER }}
        onMouseEnter={(e) => (e.currentTarget.style.background = TEAL_DARK)}
        onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
      >
        <Zap size={16} fill="currentColor" strokeWidth={0} />
        Buy now
      </button>
    </div>
  );
}