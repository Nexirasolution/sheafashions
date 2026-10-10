'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, Search, X, ChevronDown, ChevronRight } from 'lucide-react';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [collapsed, setCollapsed] = useState({}); // parentId -> bool

  // --- Image zoom modal state ---
  const [zoomImage, setZoomImage] = useState(null); // { src, alt } | null

  async function load() {
    setLoading(true);
    const res = await fetch('/api/products?limit=200');
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  // Close zoom modal on Escape
  useEffect(() => {
    if (!zoomImage) return;
    function onKey(e) {
      if (e.key === 'Escape') setZoomImage(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomImage]);

  function editKey(productId, variantId, size) { return `${productId}-${variantId}-${size}`; }

  function setStock(productId, variantId, size, value) {
    setEdits((e) => ({ ...e, [editKey(productId, variantId, size)]: value }));
  }

  async function saveRow(product, variant, sizeObj) {
    const key = editKey(product._id, variant._id, sizeObj.size);
    const newStock = edits[key];
    if (newStock === undefined) return;

    const updatedVariants = product.variants.map((v) =>
      v._id === variant._id
        ? { ...v, sizes: v.sizes.map((s) => (s.size === sizeObj.size ? { ...s, stock: Number(newStock) } : s)) }
        : v
    );
    const res = await fetch(`/api/products/${product._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variants: updatedVariants })
    });
    if (res.ok) {
      toast.success('Stock updated');
      load();
    } else toast.error('Failed to update stock');
  }

  function catId(c) { return c?._id || c; }
  function parentId(c) { return c?.parent?._id || c?.parent || null; }

  // Get the best available image for a variant, falling back to the product image
  function variantImage(product, variant) {
    return variant?.images?.[0] || product?.images?.[0] || null;
  }

  const catMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c._id] = c; });
    return map;
  }, [categories]);

  // --- Search + category filter ---
  const filteredProducts = useMemo(() => {
    let list = [...products];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      list = list.filter((p) => {
        const pCatId = catId(p.category);
        if (pCatId === categoryFilter) return true;
        // also match if selected filter is a parent category and product belongs to a child of it
        const pCat = catMap[pCatId];
        return parentId(pCat) === categoryFilter;
      });
    }

    return list;
  }, [products, search, categoryFilter, catMap]);

  // --- Category product counts (for summary cards, based on ALL products, not filtered) ---
  const categoryCounts = useMemo(() => {
    const direct = {};
    categories.forEach((c) => { direct[c._id] = 0; });
    products.forEach((p) => {
      const cid = catId(p.category);
      if (direct[cid] !== undefined) direct[cid] += 1;
    });
    const total = { ...direct };
    categories.forEach((c) => {
      const pid = parentId(c);
      if (pid && total[pid] !== undefined) total[pid] += direct[c._id] || 0;
    });
    return { direct, total };
  }, [categories, products]);

  function productStock(p) {
    return p.variants.reduce(
      (sum, v) =>
        sum +
        v.sizes.reduce((s, sz) => {
          const key = editKey(p._id, v._id, sz.size);
          const val = edits[key] !== undefined ? Number(edits[key]) : sz.stock;
          return s + (Number(val) || 0);
        }, 0),
      0
    );
  }

  // --- Group filtered products by parent category -> child category ---
  const grouped = useMemo(() => {
    const parents = categories.filter((c) => !c.parent);

    return parents
      .map((parent) => {
        const children = categories.filter((c) => parentId(c) === parent._id);

        const childGroups = children
          .map((child) => ({
            category: child,
            products: filteredProducts.filter((p) => catId(p.category) === child._id),
          }))
          .filter((g) => g.products.length > 0);

        const directProducts = filteredProducts.filter((p) => catId(p.category) === parent._id);

        return { parent, directProducts, childGroups };
      })
      .filter((g) => g.directProducts.length > 0 || g.childGroups.length > 0);
  }, [categories, filteredProducts]);

  function toggleCollapse(id) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  function ProductStockTable({ list }) {
    return (
      <table className="w-full text-sm mb-2">
        <thead>
          <tr className="text-left border-b border-brand-ink/10 text-brand-ink/40 text-xs">
            <th className="p-2">Image</th>
            <th className="p-2">Product</th>
            <th className="p-2">Product SKU</th>
            <th className="p-2">Color</th>
            <th className="p-2">Size</th>
            <th className="p-2">Size SKU</th>
            <th className="p-2">Stock</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.flatMap((p) =>
            p.variants.flatMap((v) =>
              v.sizes.map((s) => {
                const key = editKey(p._id, v._id, s.size);
                const value = edits[key] !== undefined ? edits[key] : s.stock;
                const img = variantImage(p, v);
                return (
                  <tr key={key} className="border-b border-brand-ink/5">
                    <td className="p-2">
                      {img ? (
                        <button
                          type="button"
                          onClick={() => setZoomImage({ src: img, alt: `${p.name} - ${v.color}` })}
                          className="block w-12 h-12 rounded-lg overflow-hidden border border-brand-ink/10 hover:opacity-80 transition-opacity"
                          title="Click to zoom"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`${p.name} - ${v.color}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-brand-ink/5 flex items-center justify-center text-[10px] text-brand-ink/30">
                          No image
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/product/${p.slug || p._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-brand-magenta hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-2 text-xs text-brand-ink/50">{p.sku || '—'}</td>
                    <td className="p-2">{v.color}</td>
                    <td className="p-2">{s.size}</td>
                    <td className="p-2 text-xs text-brand-ink/50">{s.sku || '—'}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        className={`w-20 border rounded-lg px-2 py-1 text-sm ${value <= 5 ? 'border-brand-magenta text-brand-magenta' : ''}`}
                        value={value}
                        onChange={(e) => setStock(p._id, v._id, s.size, e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <button onClick={() => saveRow(p, v, s)} className="text-brand-magenta">
                        <Save size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Inventory</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-ink/40">
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
        >
          <option value="all">All Categories</option>
          {categories.filter((c) => !c.parent).map((parent) => (
            <optgroup key={parent._id} label={parent.name}>
              <option value={parent._id}>{parent.name} (all)</option>
              {categories
                .filter((c) => parentId(c) === parent._id)
                .map((child) => (
                  <option key={child._id} value={child._id}>— {child.name}</option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Category summary cards */}
      {!loading && (
        <div className="flex flex-wrap gap-2 mb-6">
          {categories
            .filter((c) => !c.parent)
            .map((parent) => (
              <div
                key={parent._id}
                className="px-3 py-2 rounded-lg text-xs border border-brand-ink/10 bg-white"
              >
                <span className="font-semibold text-brand-magenta">{parent.name}</span>
                <span className="text-brand-ink/50"> — {categoryCounts.total[parent._id] || 0} products</span>
              </div>
            ))}
        </div>
      )}

      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-center text-brand-ink/40 py-10">No products match your filters.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ parent, directProducts, childGroups }) => {
            const isCollapsed = collapsed[parent._id];
            const parentStock =
              directProducts.reduce((sum, p) => sum + productStock(p), 0) +
              childGroups.reduce((sum, g) => sum + g.products.reduce((s, p) => s + productStock(p), 0), 0);
            const parentProductCount =
              directProducts.length + childGroups.reduce((sum, g) => sum + g.products.length, 0);

            return (
              <div key={parent._id} className="card-soft">
                <button
                  onClick={() => toggleCollapse(parent._id)}
                  className="w-full flex items-center justify-between p-3"
                >
                  <span className="flex items-center gap-2 font-display font-bold text-brand-magenta">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    {parent.name}
                  </span>
                  <span className="text-xs text-brand-ink/50">
                    {parentProductCount} products &middot; {parentStock} units in stock
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="px-3 pb-3">
                    {directProducts.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-brand-ink/40 mb-1">Uncategorized within {parent.name}</p>
                        <ProductStockTable list={directProducts} />
                      </div>
                    )}

                    {childGroups.map(({ category, products: childProducts }) => {
                      const childStock = childProducts.reduce((s, p) => s + productStock(p), 0);
                      return (
                        <div key={category._id} className="mb-4">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-brand-ink/70">{category.name}</p>
                            <p className="text-xs text-brand-ink/40">
                              {childProducts.length} products &middot; {childStock} units in stock
                            </p>
                          </div>
                          <ProductStockTable list={childProducts} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Image zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomImage.src}
            alt={zoomImage.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
}