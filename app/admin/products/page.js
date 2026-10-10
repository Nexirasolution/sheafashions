'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, X, UploadCloud } from 'lucide-react';
import { formatINR } from '@/lib/utils';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // newest | category | name | priceLow | priceHigh

  async function load() {
    setLoading(true);
    const res = await fetch('/api/products?limit=100');
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  async function remove(id) {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Product deleted');
      load();
    } else toast.error('Failed to delete');
  }

  const filtered = useMemo(() => {
    let list = [...products];

    // Search by product name or SKU
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      list = list.filter((p) => (p.category?._id || p.category) === categoryFilter);
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'category':
          return (a.category?.name || '').localeCompare(b.category?.name || '');
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'priceLow':
          return (a.basePrice || 0) - (b.basePrice || 0);
        case 'priceHigh':
          return (b.basePrice || 0) - (a.basePrice || 0);
        case 'newest':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return list;
  }, [products, search, categoryFilter, sortBy]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Link href="/admin/products/bulk" className="btn-secondary flex items-center gap-1 text-sm">
          <UploadCloud size={16} /> Bulk Add
        </Link>
        <Link href="/admin/products/new" className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-ink/40"
            >
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
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
        >
          <option value="newest">Sort: Newest</option>
          <option value="category">Sort: Category (A–Z)</option>
          <option value="name">Sort: Name (A–Z)</option>
          <option value="priceLow">Sort: Price (Low to High)</option>
          <option value="priceHigh">Sort: Price (High to Low)</option>
        </select>
      </div>

      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : (
        <div className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Category</th>
                <th className="p-3">Price</th>
                <th className="p-3">Variants</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id} className="border-b border-brand-ink/5">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-brand-ink/60">
                    {p.sku || <span className="text-brand-ink/30">—</span>}
                  </td>
                  <td className="p-3 text-brand-ink/60">{p.category?.name}</td>
                  <td className="p-3">{formatINR(p.basePrice)}</td>
                  <td className="p-3">{p.variants?.length}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${p.isActive ? 'bg-brand-green/15 text-brand-deepgreen' : 'bg-brand-ink/10 text-brand-ink/50'}`}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="p-3 flex gap-2 justify-end">
                    <Link href={`/admin/products/${p._id}/edit`} className="p-1.5 text-brand-magenta"><Pencil size={16} /></Link>
                    <button onClick={() => remove(p._id)} className="p-1.5 text-brand-magenta"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-brand-ink/40 py-10">
              {products.length === 0
                ? 'No products yet. Add your first product!'
                : 'No products match your filters.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}