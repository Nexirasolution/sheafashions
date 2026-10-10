'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProductCard from './ProductCard';

// Design tokens — shared teal / gold / cream theme
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL = '#064E4A';
const GOLD = '#C49A45';
const INK_FAINT = '#6B7C7A';
const HAIRLINE = '#E7DCC5';

const TABS = [
  { key: 'new',  label: 'New Arrivals' },
  { key: 'best', label: 'Bestsellers' },
  { key: 'top',  label: 'Top Sellers' },
];

// New Arrivals is a teaser, not the full catalog — cap it at 6 so it reads
// as a curated pick rather than a dumping ground of everything new.
const NEW_ARRIVALS_LIMIT = 6;

export default function ProductTabs({ activeSellers, bestSellers, topSellers }) {
  const [active, setActive] = useState('new');

  const map = { new: activeSellers, best: bestSellers, top: topSellers };
  const rawProducts = map[active] || [];
  const products = active === 'new' ? rawProducts.slice(0, NEW_ARRIVALS_LIMIT) : rawProducts;

  return (
    <section className="max-w-7xl mx-auto px-4 py-14">
      {/* Section heading */}
      <div className="text-center mb-8">
        <h2
          className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6"
          style={{ color: TEAL, fontFamily: 'Georgia, serif' }}
        >
          Featured Collection
        </h2>

        {/* Tab buttons — plain underline style, no fills */}
        <div className="flex items-center justify-center gap-8" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="shrink-0 pb-3 text-[12px] font-normal tracking-[1.5px] uppercase transition-colors border-b-2 -mb-px"
              style={{
                color: active === t.key ? TEAL : INK_FAINT,
                borderColor: active === t.key ? GOLD : 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-[12px] font-normal tracking-[2px] uppercase px-8 py-3 rounded-full transition-colors bg-[#064E4A] hover:bg-[#C49A45] text-[#FFFDF5] hover:text-[#172A29]"
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}