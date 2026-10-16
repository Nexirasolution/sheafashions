'use client';

import { useCallback, useEffect, useState } from 'react';

// Loads the shared courier list (set once by admin, used everywhere)
export function useCouriers() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/couriers', { cache: 'no-store' });
      const data = res.ok ? await res.json() : { couriers: [] };
      setCouriers(data.couriers || []);
    } catch (err) {
      console.error('Failed to load couriers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const defaultCourier = couriers.find((c) => c.isDefault) || null;
  return { couriers, loading, reload, defaultCourier };
}