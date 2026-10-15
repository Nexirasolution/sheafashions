'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { totalPiecesOf } from '@/lib/comboPieces';

const CartContext = createContext(null);
const STORAGE_KEY = 'lb_cart_v1';

// ── Brand tokens: teal / gold / cream theme ────────────────
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL  = '#064E4A';
const GOLD  = '#C49A45';
const SAND  = '#E7DCC5';
const PAPER = '#FFFDF5';
const INK   = '#172A29';
const RUST  = '#B0503A'; // kept as-is: out-of-stock / error needs to read as a warning

const toastBase = {
  duration: 2500,
  style: {
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    color: INK,
    background: PAPER,
    borderRadius: '4px',
    padding: '10px 14px',
    boxShadow: '0 2px 12px rgba(23,42,41,0.10)',
    borderLeft: `3px solid ${GOLD}`,
  },
};

function brandToast(message, opts = {}) {
  return toast(
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span>{message}</span>
        <span style={{ fontSize: 9, color: TEAL, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
          Shea Fashions
        </span>
      </div>
    ),
    { ...toastBase, ...opts }
  );
}

const warnStyle = { ...toastBase.style, borderLeftColor: SAND };

// A cart/order line is unique per product+variant+size AND per sleeve/zip/
// pant/shawl selection, and for color-pack combos per pack size + color
// breakdown (packKey) so different packs never merge into one line.
function sameLine(a, b) {
  return (
    a.productId === b.productId &&
    a.variantId === b.variantId &&
    a.size === b.size &&
    a.comboId === b.comboId &&
    (a.packKey || '') === (b.packKey || '') &&
    (a.sleeveType || '') === (b.sleeveType || '') &&
    (a.zipType || '') === (b.zipType || '') &&
    (a.pantOption?.id || '') === (b.pantOption?.id || '') &&
    (a.shawlOption?.id || '') === (b.shawlOption?.id || '')
  );
}

// Pure helper: merges one item into a list and reports what happened.
// status: 'added' | 'clamped' (added, but limited by stock) | 'blocked' (not added)
function mergeLine(list, item) {
  const idx = list.findIndex((i) => sameLine(i, item));
  const stockLimit = typeof item.stock === 'number' ? item.stock : Infinity;

  if (idx > -1) {
    const currentQty = list[idx].qty;
    if (currentQty >= stockLimit) return { list, status: 'blocked' };

    const desiredQty = currentQty + item.qty;
    const finalQty = Math.min(desiredQty, stockLimit);
    const copy = [...list];
    copy[idx] = {
      ...copy[idx],
      qty: finalQty,
      stock: stockLimit,
      price: item.price ?? copy[idx].price, // take the latest price
      pieces: item.pieces ?? copy[idx].pieces,
    };
    return { list: copy, status: finalQty < desiredQty ? 'clamped' : 'added' };
  }

  if (stockLimit <= 0) return { list, status: 'blocked' };

  const finalQty = Math.min(item.qty, stockLimit);
  return {
    list: [...list, { ...item, qty: finalQty }],
    status: finalQty < item.qty ? 'clamped' : 'added',
  };
}
// ───────────────────────────────────────────────────────────────

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Always holds the latest cart so actions can compute the result and show
  // the right toast synchronously.
  const itemsRef = useRef([]);

  const commit = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) commit(parsed);
      }
    } catch {}
    setLoaded(true);
  }, [commit]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage full or blocked (e.g. private mode): keep working in memory
    }
  }, [items, loaded]);

  const addItem = useCallback((item) => {
    const { list, status } = mergeLine(itemsRef.current, item);

    if (status === 'blocked') {
      brandToast('Sorry, this item is out of stock', {
        icon: '⚠️',
        style: { ...toastBase.style, borderLeftColor: RUST },
      });
      return;
    }

    commit(list);

    if (status === 'clamped') {
      brandToast('Only limited stock available. Quantity adjusted', { icon: '⚠️', style: warnStyle });
      return;
    }

    brandToast('Added to cart', { icon: '✓' });
  }, [commit]);

  // Adds several lines at once as a single state update, with one summary toast.
  const addItems = useCallback((newItems) => {
    let next = itemsRef.current;
    let blockedCount = 0;
    let clampedCount = 0;
    let addedCount = 0;

    for (const item of newItems) {
      const { list, status } = mergeLine(next, item);
      next = list;
      if (status === 'blocked') blockedCount++;
      else {
        addedCount++;
        if (status === 'clamped') clampedCount++;
      }
    }

    if (next !== itemsRef.current) commit(next);

    if (addedCount === 0 && blockedCount > 0) {
      brandToast('Sorry, those items are out of stock', {
        icon: '⚠️',
        style: { ...toastBase.style, borderLeftColor: RUST },
      });
      return;
    }

    if (clampedCount > 0 || blockedCount > 0) {
      brandToast('Added to cart. Some quantities were limited by stock', { icon: '⚠️', style: warnStyle });
      return;
    }

    brandToast('Added to cart', { icon: '✓' });
  }, [commit]);

  const updateQty = useCallback((key, qty) => {
    let hitMax = null;

    const next = itemsRef.current.map((i) => {
      if (cartKey(i) !== key) return i;
      const max = typeof i.stock === 'number' ? i.stock : Infinity;
      if (qty > max) hitMax = max;
      return { ...i, qty: Math.max(1, Math.min(qty, max)) };
    });

    commit(next);

    if (hitMax !== null) {
      brandToast(`Only ${hitMax} left in stock`, { icon: '⚠️', style: warnStyle });
    }
  }, [commit]);

  const removeItem = useCallback((key) => {
    commit(itemsRef.current.filter((i) => cartKey(i) !== key));
    brandToast('Removed from cart', { icon: '🗑️', style: warnStyle });
  }, [commit]);

  // Removes several lines at once with one toast (used when the server says
  // some lines no longer exist).
  const removeItems = useCallback((keys) => {
    if (!keys?.length) return;
    const set = new Set(keys);
    commit(itemsRef.current.filter((i) => !set.has(cartKey(i))));
    brandToast('Some items are no longer available and were removed', { icon: '⚠️', style: warnStyle });
  }, [commit]);

  // Applies server prices: updates: [{ key, price }]. Shows one toast if anything changed.
  const syncPrices = useCallback((updates) => {
    if (!updates?.length) return;
    const map = new Map(updates.map((u) => [u.key, u.price]));
    let changed = false;

    const next = itemsRef.current.map((i) => {
      const p = map.get(cartKey(i));
      if (p !== undefined && p !== i.price) {
        changed = true;
        return { ...i, price: p };
      }
      return i;
    });

    if (changed) {
      commit(next);
      brandToast('Some prices were updated', { icon: 'ℹ️', style: warnStyle });
    }
  }, [commit]);

  const setItemStock = useCallback((key, stock) => {
    commit(
      itemsRef.current.map((i) => {
        if (cartKey(i) !== key) return i;
        return { ...i, stock, qty: Math.max(1, Math.min(i.qty, stock)) };
      })
    );
  }, [commit]);

  const clearCart = useCallback(() => {
    commit([]);
    brandToast('Cart cleared', {
      icon: '✕',
      style: { ...toastBase.style, borderLeftColor: TEAL },
    });
  }, [commit]);

  const value = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const count = items.reduce((s, i) => s + i.qty, 0);
    const totalPieces = totalPiecesOf(items);

    return {
      items,
      addItem,
      addItems,
      updateQty,
      removeItem,
      removeItems,
      syncPrices,
      setItemStock,
      clearCart,
      subtotal,
      count,
      totalPieces,
    };
  }, [items, addItem, addItems, updateQty, removeItem, removeItems, syncPrices, setItemStock, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function cartKey(i) {
  return [
    i.productId,
    i.variantId,
    i.size,
    i.comboId,
    i.packKey,
    i.sleeveType,
    i.zipType,
    i.pantOption?.id,
    i.shawlOption?.id,
  ].filter(Boolean).join('-');
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}