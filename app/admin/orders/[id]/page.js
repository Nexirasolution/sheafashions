'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ScanLine, ChevronLeft, Phone, MessageCircle, ExternalLink, Copy } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { buildProductIndex, resolveOrderItem } from '@/lib/orderItemResolver';
import { normalizeIndianPhone, buildWhatsAppMessage } from '@/lib/whatsapp';
import { buildTrackingUrl } from '@/lib/courierUtils';
import { useCouriers } from '@/lib/useCouriers';
import OrderItemModal from '@/components/admin/OrderItemModal';
import ScanShipModal from '@/components/admin/ScanShipModal';
import StatusBadge from '@/components/admin/StatusBadge';

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const EMPTY_COURIER = { partner: '', trackingId: '', awbNumber: '' };

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const { couriers } = useCouriers();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courier, setCourier] = useState(EMPTY_COURIER);
  const [modalItem, setModalItem] = useState(null); // { item, image, categoryName, productSku }
  const [notFound, setNotFound] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [savingCourier, setSavingCourier] = useState(false);

  // WhatsApp update state
  const [waKind, setWaKind] = useState('placed');
  const [waMessage, setWaMessage] = useState('');

  async function load() {
    if (!id) return; // guard: params not ready yet, avoids /api/orders/undefined
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) {
        if (res.status === 404) { setNotFound(true); return; }
        const text = await res.text().catch(() => '');
        throw new Error(`Order fetch failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      setOrder(data.order);
      setCourier({ ...EMPTY_COURIER, ...(data.order?.courier || {}) });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to load order');
    }
  }
  useEffect(() => { load(); }, [id]);

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

  // Default the template to the order's current status whenever the status changes
  useEffect(() => {
    if (order?.status) setWaKind(order.status);
  }, [order?.status]);

  // Rebuild the message when the order data (e.g. saved courier info) or template changes
  useEffect(() => {
    if (order) setWaMessage(buildWhatsAppMessage(order, waKind));
  }, [order, waKind]);

  function categoryName(catRef) {
    const cid = catRef?._id || catRef;
    return categories.find((c) => c._id === cid)?.name || catRef?.name || '';
  }

  // ── Courier picking ──
  const selectedCourier = couriers.find((c) => c.name === courier.partner) || null;
  const hasTemplate = !!selectedCourier?.trackingUrl;
  const savedElsewhere = courier.partner && !selectedCourier; // courier no longer in the saved list

  // Change courier / AWB and keep the tracking link in sync when the courier has a template
  function applyCourier(next) {
    const c = couriers.find((x) => x.name === next.partner);
    const url = c?.trackingUrl ? buildTrackingUrl(c, next.awbNumber) : next.trackingId;
    setCourier({ ...next, trackingId: url });
  }

  async function updateStatus(status) {
    const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast.success('Status updated'); load(); }
    else toast.error('Failed to update status');
  }

  async function saveCourier() {
    setSavingCourier(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courier }) });
      if (res.ok) { toast.success('Courier details saved'); load(); }
      else toast.error('Failed to save courier details');
    } finally {
      setSavingCourier(false);
    }
  }

  function copyLink() {
    if (!courier.trackingId) return;
    navigator.clipboard?.writeText(courier.trackingId).then(
      () => toast.success('Tracking link copied'),
      () => toast.error('Could not copy')
    );
  }

  function sendWhatsApp() {
    const phone = normalizeIndianPhone(order.customer?.phone);
    if (!phone) return toast.error('Customer phone number is missing or invalid');
    if (!waMessage.trim()) return toast.error('Message is empty');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, '_blank', 'noopener,noreferrer');
  }

  if (notFound) return <p className="text-brand-ink/50">Order not found.</p>;
  if (!order) return <p className="text-brand-ink/50">Loading...</p>;

  const waPhone = normalizeIndianPhone(order.customer?.phone);
  const phoneValid = !!waPhone;

  return (
    <div className="max-w-2xl pb-8">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-brand-ink/60 mb-3">
        <ChevronLeft size={16} /> Orders
      </Link>

      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-2xl font-bold text-brand-magenta break-all">Order {order.orderNumber}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-sm text-brand-ink/50 mb-5">{new Date(order.createdAt).toLocaleString('en-IN')}</p>

      {/* Items */}
      <div className="card-soft p-4 sm:p-5 mb-4">
        <h2 className="font-semibold mb-2">Items</h2>
        {order.items.map((item, i) => {
          const resolved = resolveOrderItem(item, index);
          return (
            <button
              key={i}
              onClick={() =>
                setModalItem({ item, image: resolved.image, categoryName: categoryName(resolved.category), productSku: resolved.product?.sku })
              }
              className="w-full flex justify-between items-start gap-3 text-sm py-3 border-b border-brand-ink/5 last:border-b-0 hover:bg-brand-ink/5 rounded-lg px-2 -mx-2 transition-colors text-left"
            >
              <span className="flex items-start gap-3 min-w-0">
                {resolved.image ? (
                  <img src={resolved.image} alt={item.name} className="w-12 h-12 rounded-md object-cover shrink-0" />
                ) : (
                  <span className="w-12 h-12 rounded-md bg-brand-ink/5 shrink-0" />
                )}
                <span className="min-w-0">
                  {item.name}
                  {[item.color, item.size, item.sleeveType, item.zipType, item.pantOption?.name, item.shawlOption?.name].filter(Boolean).length > 0 && (
                    <span className="block text-xs text-brand-ink/60">
                      {[item.color, item.size, item.sleeveType, item.zipType, item.pantOption?.name, item.shawlOption?.name].filter(Boolean).join(' / ')}
                    </span>
                  )}
                  <span className="block text-xs text-brand-ink/60">Qty {item.qty}</span>
                  {resolved.product?.sku && (
                    <span className="block text-xs text-brand-ink/50">Product SKU: {resolved.product.sku}</span>
                  )}
                  {item.sku && (
                    <span className="block text-xs text-brand-ink/40">Size SKU: {item.sku}</span>
                  )}
                </span>
              </span>
              <span className="shrink-0">{formatINR(item.price * item.qty)}</span>
            </button>
          );
        })}
        <div className="flex justify-between font-bold mt-2 border-t pt-2"><span>Total</span><span>{formatINR(order.total)}</span></div>
      </div>

      {/* Customer */}
      <div className="card-soft p-4 sm:p-5 mb-4">
        <h2 className="font-semibold mb-2">Customer & Shipping</h2>
        <p className="text-sm">{order.customer?.name} — {order.customer?.phone}</p>
        <p className="text-sm text-brand-ink/70">{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
        <p className="text-sm text-brand-ink/70">{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
        {order.customer?.phone && (
          <div className="flex gap-2 mt-3">
            <a href={`tel:${order.customer.phone}`} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm">
              <Phone size={14} /> Call
            </a>
            {phoneValid && (
              <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm text-green-700">
                <MessageCircle size={14} /> Chat
              </a>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="card-soft p-4 sm:p-5 mb-4">
        <h2 className="font-semibold mb-2">Order Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium capitalize border ${order.status === s ? 'bg-brand-pink text-white border-brand-pink' : 'border-brand-ink/15 text-brand-ink/70'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Courier */}
      <div className="card-soft p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold">Courier Details</h2>
          <Link href="/admin/couriers" className="text-xs underline text-brand-magenta">Manage couriers</Link>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-brand-ink/60">
            Courier
            <select
              value={courier.partner}
              onChange={(e) => applyCourier({ ...courier, partner: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm text-brand-ink bg-white"
            >
              <option value="">Select courier</option>
              {savedElsewhere && <option value={courier.partner}>{courier.partner} (not in your list)</option>}
              {couriers.map((c) => (
                <option key={c._id} value={c.name}>{c.name}{c.isDefault ? ' (default)' : ''}</option>
              ))}
            </select>
          </label>
          {couriers.length === 0 && (
            <p className="text-xs text-amber-600">
              No couriers saved yet. <Link href="/admin/couriers" className="underline">Add your couriers once</Link> and pick them here.
            </p>
          )}

          <label className="block text-xs text-brand-ink/60">
            AWB / Tracking number
            <input
              placeholder="Scan or type the number"
              className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm text-brand-ink"
              value={courier.awbNumber}
              onChange={(e) => applyCourier({ ...courier, awbNumber: e.target.value })}
            />
          </label>

          {hasTemplate ? (
            <div className="rounded-lg bg-brand-ink/5 p-3 text-sm">
              <p className="text-xs text-brand-ink/60 mb-1">Tracking link (made automatically, customers can use it)</p>
              {courier.trackingId ? (
                <>
                  <p className="break-all text-xs text-brand-ink/80">{courier.trackingId}</p>
                  <div className="flex gap-2 mt-2">
                    <a href={courier.trackingId} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs bg-white">
                      <ExternalLink size={13} /> Open
                    </a>
                    <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs bg-white">
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-brand-ink/50">Enter the AWB number to create the link.</p>
              )}
            </div>
          ) : (
            <label className="block text-xs text-brand-ink/60">
              Tracking link (optional)
              <input
                placeholder="Paste a tracking link"
                inputMode="url"
                autoCapitalize="none"
                className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm text-brand-ink"
                value={courier.trackingId}
                onChange={(e) => setCourier({ ...courier, trackingId: e.target.value })}
              />
              {selectedCourier && !selectedCourier.trackingUrl && (
                <span className="block mt-1 text-amber-600">
                  {selectedCourier.name} has no tracking link saved. <Link href="/admin/couriers" className="underline">Add it once</Link> to skip this field.
                </span>
              )}
            </label>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button onClick={() => setScanOpen(true)} className="btn-outline text-sm inline-flex items-center justify-center gap-2">
            <ScanLine size={16} />
            Scan receipt
          </button>
          <button onClick={saveCourier} disabled={savingCourier} className="btn-outline text-sm disabled:opacity-50">
            {savingCourier ? 'Saving…' : 'Save Courier Info'}
          </button>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="card-soft p-4 sm:p-5 mb-4">
        <h2 className="font-semibold mb-1">WhatsApp Update</h2>
        <p className="text-xs text-brand-ink/50 mb-3">
          Opens WhatsApp with the message below pre-filled for {order.customer?.name || 'the customer'}
          {order.customer?.phone ? ` (${order.customer.phone})` : ''}. Review it, then tap send in WhatsApp.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setWaKind(s)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium capitalize border ${waKind === s ? 'bg-brand-magenta text-white border-brand-magenta' : 'border-brand-ink/15 text-brand-ink/70'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <textarea
          value={waMessage}
          onChange={(e) => setWaMessage(e.target.value)}
          rows={8}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        />

        {!phoneValid && (
          <p className="text-xs text-red-600 mb-2">
            The customer's phone number is missing or invalid, so WhatsApp can't be opened.
          </p>
        )}
        {waKind === 'shipped' && !order.courier?.partner && !order.courier?.awbNumber && !order.courier?.trackingId && (
          <p className="text-xs text-amber-600 mb-2">
            No courier details are saved yet. Scan the receipt or save them above first to include them in the message.
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={sendWhatsApp}
            disabled={!phoneValid}
            className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send WhatsApp update
          </button>
          <button
            onClick={() => setWaMessage(buildWhatsAppMessage(order, waKind))}
            className="text-xs text-brand-ink/60 underline py-1"
          >
            Reset message
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Link href={`/invoice/${order._id}`} target="_blank" className="btn-outline text-sm text-center">View Invoice</Link>
        <Link href={`/courier-bill/${order._id}`} target="_blank" className="btn-outline text-sm text-center">Print Shipping Label</Link>
      </div>

      <OrderItemModal
        item={modalItem?.item}
        image={modalItem?.image}
        categoryName={modalItem?.categoryName}
        productSku={modalItem?.productSku}
        onClose={() => setModalItem(null)}
      />

      <ScanShipModal
        open={scanOpen}
        fixedOrder={order}
        onClose={() => setScanOpen(false)}
        onChanged={load}
      />
    </div>
  );
}