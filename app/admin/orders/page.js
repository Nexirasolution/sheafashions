'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ScanLine, Truck, Phone } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { buildProductIndex, resolveOrderItem } from '@/lib/orderItemResolver';
import OrderItemModal from '@/components/admin/OrderItemModal';
import ScanShipModal from '@/components/admin/ScanShipModal';
import StatusBadge from '@/components/admin/StatusBadge';

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const PAGE_SIZES = [10, 25, 50, 100];

// Local-time YYYY-MM-DD, the format <input type="date"> uses
function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toInputDate(d);
}

const DATE_PRESETS = [
  { label: 'Today', range: () => [toInputDate(new Date()), toInputDate(new Date())] },
  { label: 'Yesterday', range: () => [daysAgo(1), daysAgo(1)] },
  { label: 'Last 7 days', range: () => [daysAgo(6), toInputDate(new Date())] },
  { label: 'Last 30 days', range: () => [daysAgo(29), toInputDate(new Date())] },
  {
    label: 'This month',
    range: () => {
      const now = new Date();
      return [toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), toInputDate(now)];
    },
  },
];

// Builds [1, '…', 4, 5, 6, '…', 20] style page lists
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) { pages.add(2); pages.add(3); pages.add(4); }
  if (current >= total - 2) { pages.add(total - 1); pages.add(total - 2); pages.add(total - 3); }
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null); // { item, image, categoryName, productSku }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dateFrom, setDateFrom] = useState(''); // YYYY-MM-DD (inclusive)
  const [dateTo, setDateTo] = useState('');     // YYYY-MM-DD (inclusive)
  const [scanOpen, setScanOpen] = useState(false);

  function setRange(from, to) {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Orders fetch failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      setOrders(data.orders || []);
      setPage(1);
    } catch (err) {
      console.error(err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  useEffect(() => {
    fetch('/api/products?limit=200')
      .then(async (r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products || []))
      .catch((err) => console.error('Failed to load products', err));

    fetch('/api/categories')
      .then(async (r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories || []))
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  const index = useMemo(() => buildProductIndex(products), [products]);

  function catId(c) { return c?._id || c; }
  function parentId(c) {
    const full = categories.find((cat) => cat._id === catId(c));
    return full?.parent?._id || full?.parent || null;
  }

  // Resolve each order's items to categories once, for filtering + display
  const enrichedOrders = useMemo(() => {
    return orders.map((o) => {
      const resolvedItems = (o.items || []).map((item) => ({
        item,
        ...resolveOrderItem(item, index),
      }));
      const categoryIds = new Set(
        resolvedItems.map((r) => catId(r.category)).filter(Boolean)
      );
      return { ...o, resolvedItems, categoryIds };
    });
  }, [orders, index]);

  const filteredOrders = useMemo(() => {
    // Date range is inclusive of both days, in the admin's local time
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return enrichedOrders.filter((o) => {
      if (fromTs !== null || toTs !== null) {
        const ts = new Date(o.createdAt).getTime();
        if (Number.isNaN(ts)) return false;
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
      }

      if (categoryFilter === 'all') return true;
      for (const cid of o.categoryIds) {
        if (cid === categoryFilter || parentId(cid) === categoryFilter) return true;
      }
      return false;
    });
  }, [enrichedOrders, categoryFilter, categories, dateFrom, dateTo]);

  // ── Pagination (applied after the filters) ──
  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const currentPage = Math.min(page, totalPages); // clamp if data shrinks
  const startIdx = (currentPage - 1) * pageSize;
  const pagedOrders = useMemo(
    () => filteredOrders.slice(startIdx, startIdx + pageSize),
    [filteredOrders, startIdx, pageSize]
  );
  const showingFrom = totalOrders === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + pageSize, totalOrders);

  function goTo(p) {
    setPage(Math.min(Math.max(1, p), totalPages));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function categoryName(catRef) {
    const cid = catId(catRef);
    return categories.find((c) => c._id === cid)?.name || catRef?.name || '';
  }

  function openItem(r) {
    setModalItem({ item: r.item, image: r.image, categoryName: categoryName(r.category), productSku: r.product?.sku });
  }

  function itemVariant(item) {
    return [item.sleeveType, item.zipType, item.pantOption?.name, item.shawlOption?.name].filter(Boolean).join('/');
  }

  const hasFilters = !!(status || search || categoryFilter !== 'all' || dateFrom || dateTo);

  return (
    <div className="pb-24 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Orders</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/couriers" className="btn-outline text-sm inline-flex items-center gap-2">
            <Truck size={16} />
            <span className="hidden sm:inline">Couriers</span>
          </Link>
          <button
            onClick={() => setScanOpen(true)}
            className="hidden md:inline-flex btn-outline text-sm items-center gap-2"
          >
            <ScanLine size={16} />
            Scan courier receipt
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <input
            placeholder="Search order number, name, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            className="border rounded-lg px-3 py-2.5 text-sm flex-1 min-w-0"
          />
          <button onClick={load} className="btn-outline text-sm shrink-0">Search</button>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm bg-white">
            <option value="">All status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            <option value="all">All categories</option>
            {categories.filter((c) => !c.parent).map((parent) => (
              <optgroup key={parent._id} label={parent.name}>
                <option value={parent._id}>{parent.name} (all)</option>
                {categories
                  .filter((c) => (c.parent?._id || c.parent) === parent._id)
                  .map((child) => (
                    <option key={child._id} value={child._id}>— {child.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-brand-ink/60">
            <span className="w-8 shrink-0">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="border rounded-lg px-2.5 py-2 text-sm text-brand-ink w-full min-w-0"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-brand-ink/60">
            <span className="w-8 shrink-0">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="border rounded-lg px-2.5 py-2 text-sm text-brand-ink w-full min-w-0"
            />
          </label>
        </div>

        {/* Quick date ranges: one scrolling row on phones */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
          {DATE_PRESETS.map((p) => {
            const [f, t] = p.range();
            const active = dateFrom === f && dateTo === t;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRange(f, t)}
                className={`text-xs px-3 py-2 rounded-full border whitespace-nowrap transition-colors ${
                  active ? 'bg-brand-magenta text-white border-brand-magenta' : 'text-brand-ink/70 hover:border-brand-magenta'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => setRange('', '')} className="text-xs px-3 py-2 underline text-brand-magenta whitespace-nowrap">
              Clear dates
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-brand-ink/50">Loading...</p>
      ) : totalOrders === 0 ? (
        <div className="card-soft text-center py-12 px-4">
          <p className="text-brand-ink/50">{hasFilters ? 'No orders match these filters.' : 'No orders yet.'}</p>
        </div>
      ) : (
        <>
          {/* ── Phones: one card per order ── */}
          <ul className="md:hidden space-y-3">
            {pagedOrders.map((o) => (
              <li key={o._id} className="card-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{o.orderNumber}</p>
                    <p className="text-xs text-brand-ink/50">{new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <p className="min-w-0 truncate">{o.customer?.name || 'Customer'}</p>
                  {o.customer?.phone && (
                    <a href={`tel:${o.customer.phone}`} className="inline-flex items-center gap-1 text-xs text-brand-magenta shrink-0">
                      <Phone size={13} /> {o.customer.phone}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {o.resolvedItems.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => openItem(r)}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-brand-ink/5 text-brand-ink/70 text-left"
                    >
                      {r.item.name}
                      {itemVariant(r.item) && <span className="opacity-70"> · {itemVariant(r.item)}</span>} x{r.item.qty}
                    </button>
                  ))}
                </div>

                <div className="flex items-end justify-between gap-3 mt-3">
                  <div className="text-xs text-brand-ink/60 min-w-0">
                    <p className="capitalize">Payment: {o.paymentStatus || '—'}</p>
                    {o.courier?.awbNumber && (
                      <p className="truncate">
                        <Truck size={12} className="inline -mt-0.5 mr-1" />
                        {[o.courier?.partner, o.courier.awbNumber].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold shrink-0">{formatINR(o.total)}</p>
                </div>

                <Link
                  href={`/admin/orders/${o._id}`}
                  className="mt-3 block text-center text-sm font-medium text-brand-magenta border border-brand-magenta/30 rounded-lg py-2.5"
                >
                  View order
                </Link>
              </li>
            ))}
          </ul>

          {/* ── Tablets / desktops: table ── */}
          <div className="hidden md:block card-soft overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-brand-ink/10 text-brand-ink/50">
                  <th className="p-3">Order #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Product SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Courier</th>
                  <th className="p-3">Date</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((o) => (
                  <tr key={o._id} className="border-b border-brand-ink/5">
                    <td className="p-3 font-medium">{o.orderNumber}</td>
                    <td className="p-3">{o.customer?.name}<br /><span className="text-xs text-brand-ink/50">{o.customer?.phone}</span></td>
                    <td className="p-3 max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {o.resolvedItems.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => openItem(r)}
                            className="text-xs px-2 py-1 rounded-full bg-brand-ink/5 text-brand-ink/70 hover:bg-brand-magenta hover:text-white transition-colors"
                            title={[r.item.sku, r.item.sleeveType, r.item.zipType, r.item.pantOption?.name, r.item.shawlOption?.name].filter(Boolean).join(' · ') || r.item.name}
                          >
                            {r.item.name}
                            {itemVariant(r.item) && <span className="opacity-70"> · {itemVariant(r.item)}</span>}
                            {' '}x{r.item.qty}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-brand-ink/60 max-w-[160px] truncate" title={o.resolvedItems.map((r) => r.product?.sku || r.item.sku).filter(Boolean).join(', ')}>
                      {o.resolvedItems.map((r) => r.product?.sku || r.item.sku).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="p-3 text-xs text-brand-ink/60">
                      {[...o.categoryIds].map((cid) => categoryName(cid)).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="p-3">{formatINR(o.total)}</td>
                    <td className="p-3 capitalize">{o.paymentStatus}</td>
                    <td className="p-3"><StatusBadge status={o.status} /></td>
                    <td className="p-3 text-xs text-brand-ink/60">
                      {o.courier?.awbNumber ? (
                        <>
                          {o.courier?.partner && <span className="block">{o.courier.partner}</span>}
                          <span className="block text-brand-ink/50">{o.courier.awbNumber}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-xs text-brand-ink/50">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="p-3"><Link href={`/admin/orders/${o._id}`} className="text-brand-magenta font-medium">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3 text-brand-ink/60">
              <span className="text-xs sm:text-sm">
                <b>{showingFrom}</b>–<b>{showingTo}</b> of <b>{totalOrders}</b>
              </span>
              <label className="flex items-center gap-1.5 text-xs">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border rounded-md px-2 py-1.5 text-xs bg-white"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => goTo(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md border disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-magenta"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Phones: simple "Page x of y" */}
              <span className="sm:hidden px-2 text-xs text-brand-ink/60">Page {currentPage} of {totalPages}</span>

              {/* Larger screens: numbered pages */}
              <div className="hidden sm:flex items-center gap-1">
                {pageList(currentPage, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`dots-${i}`} className="px-1.5 text-brand-ink/40">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goTo(p)}
                      className={`min-w-[32px] px-2 py-1 rounded-md border text-xs ${
                        p === currentPage ? 'bg-brand-magenta text-white border-brand-magenta' : 'hover:border-brand-magenta'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => goTo(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-magenta"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Phones: floating scan button within thumb reach */}
      <button
        onClick={() => setScanOpen(true)}
        className="md:hidden fixed right-4 z-40 flex items-center gap-2 px-5 py-3.5 rounded-full bg-brand-magenta text-white shadow-lg text-sm font-medium bottom-[max(1rem,env(safe-area-inset-bottom))]"
        aria-label="Scan courier receipt"
      >
        <ScanLine size={18} />
        Scan receipt
      </button>

      <OrderItemModal
        item={modalItem?.item}
        image={modalItem?.image}
        categoryName={modalItem?.categoryName}
        productSku={modalItem?.productSku}
        onClose={() => setModalItem(null)}
      />

      <ScanShipModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onChanged={load}
      />
    </div>
  );
}