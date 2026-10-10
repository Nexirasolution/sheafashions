'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';

export default function EditProductPage() {
  const { id } = useParams();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // admin=1 -> fresh, uncached read straight from the DB (includes inactive products)
    fetch(`/api/products/${id}?admin=1`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load product');
        setInitial(d.product);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-brand-ink/50">{error}</p>;
  if (!initial) return <p className="text-brand-ink/50">Loading product...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Edit Product</h1>
      <ProductForm initial={initial} productId={id} />
    </div>
  );
}