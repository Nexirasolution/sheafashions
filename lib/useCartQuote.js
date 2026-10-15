'use client';
// lib/useCartQuote.js  (NEW FILE)
// Asks the server for the real totals of the current cart, ignores
// out-of-order responses, and heals the cart (fixes stale prices, removes
// lines that no longer exist).
import { useState, useEffect, useCallback, useRef } from 'react';
import { useCart, cartKey } from '@/components/CartContext';
import { toOrderItem } from '@/lib/cartItems';

export function useCartQuote({ couponCode = '', state = '' } = {}) {
  const { items, syncPrices, removeItems } = useCart();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Price is not part of this key, so syncing prices does not trigger another quote.
  const itemsKey = JSON.stringify(items.map(toOrderItem));

  const refresh = useCallback(async () => {
    const snapshot = itemsRef.current;
    if (!snapshot.length) {
      reqId.current++;
      setQuote(null);
      setError('');
      setLoading(false);
      return null;
    }

    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch('/api/cart/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: snapshot.map(toOrderItem), couponCode, state }),
      });
      const data = await res.json();
      if (id !== reqId.current) return null; // a newer request superseded this one

      if (!res.ok) {
        setQuote(null);
        setError(data.error || 'Could not calculate your total');
        return null;
      }

      const result = { ...data, requestedCoupon: couponCode };
      setError('');
      setQuote(result);

      const priceUpdates = [];
      (data.lines || []).forEach((l) => {
        const it = snapshot[l.index];
        if (it && it.price !== l.price) priceUpdates.push({ key: cartKey(it), price: l.price });
      });
      if (priceUpdates.length) syncPrices(priceUpdates);

      if (data.skipped?.length) {
        removeItems(data.skipped.map((i) => snapshot[i]).filter(Boolean).map(cartKey));
      }
      return result;
    } catch {
      if (id === reqId.current) {
        setQuote(null);
        setError('Could not calculate your total');
      }
      return null;
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [couponCode, state, syncPrices, removeItems]);

  useEffect(() => {
    refresh();
  }, [refresh, itemsKey]);

  return { quote, loading, error, refresh };
}