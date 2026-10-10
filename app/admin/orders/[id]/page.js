'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatINR } from '@/lib/utils';
import { buildProductIndex, resolveOrderItem } from '@/lib/orderItemResolver';
import OrderItemModal from '@/components/admin/OrderItemModal';

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
const STORE_NAME = 'Tirupur Clothing Hub';

// Accepts 10-digit numbers, 0-prefixed, or 91-prefixed. Returns null if invalid.
function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

// Builds the pre-filled WhatsApp text for a given status
function buildWhatsAppMessage(order, kind) {
  if (!order) return '';
  const name = order.customer?.name || 'Customer';
  const no = order.orderNumber;

  const itemLines = (order.items || [])
    .map((it) => {
      const variant = [it.color, it.size, it.sleeveType, it.zipType, it.pantOption?.name, it.shawlOption?.name]
        .filter(Boolean)
        .join('/');
      return `• ${it.name}${variant ? ` (${variant})` : ''} x${it.qty}`;
    })
    .join('\n');

  const partner = order.courier?.partner;
  const awb = order.courier?.awbNumber;
  const tracking = order.courier?.trackingId;

  const courierLines = [
    partner && `Courier: ${partner}`,
    awb && `AWB: ${awb}`,
    tracking && `Tracking: ${tracking}`
  ]
    .filter(Boolean)
    .join('\n');

  const footer = `\n\n- ${STORE_NAME}`;

  switch (kind) {
    case 'placed':
      return `Hi ${name}, thank you for your order ${no}! 🎉\n\n${itemLines}\n\nTotal: ${formatINR(order.total)}\n\nWe will confirm it shortly.${footer}`;
    case 'confirmed':
      return `Hi ${name}, your order ${no} has been confirmed ✅\n\n${itemLines}\n\nTotal: ${formatINR(order.total)}${footer}`;
    case 'packed':
      return `Hi ${name}, your order ${no} has been packed 📦 and will be shipped soon.${footer}`;
    case 'shipped':
      return `Hi ${name}, your order ${no} has been shipped 🚚${courierLines ? `\n\n${courierLines}` : ''}\n\nYou will receive it soon.${footer}`;
    case 'delivered':
      return `Hi ${name}, your order ${no} has been delivered ✅\n\nThank you for shopping with us! We hope you love it. 💖${footer}`;
    case 'cancelled':
      return `Hi ${name}, your order ${no} has been cancelled. If you have any questions, please reply to this message.${footer}`;
    case 'returned':
      return `Hi ${name}, we have received the return for your order ${no}. We will process it shortly.${footer}`;
    default:
      return `Hi ${name}, an update on your order ${no}.${footer}`;
  }
}

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courier, setCourier] = useState({ partner: '', trackingId: '', awbNumber: '' });
  const [modalItem, setModalItem] = useState(null); // { item, image, categoryName, productSku }
  const [notFound, setNotFound] = useState(false);

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
      setCourier(data.order?.courier || { partner: '', trackingId: '', awbNumber: '' });
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

  async function updateStatus(status) {
    const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast.success('Status updated'); load(); }
    else toast.error('Failed to update status');
  }

  async function saveCourier() {
    const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courier }) });
    if (res.ok) { toast.success('Courier details saved'); load(); }
    else toast.error('Failed to save courier details');
  }

  function sendWhatsApp() {
    const phone = normalizeIndianPhone(order.customer?.phone);
    if (!phone) return toast.error('Customer phone number is missing or invalid');
    if (!waMessage.trim()) return toast.error('Message is empty');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, '_blank', 'noopener,noreferrer');
  }

  if (notFound) return <p className="text-brand-ink/50">Order not found.</p>;
  if (!order) return <p className="text-brand-ink/50">Loading...</p>;

  const phoneValid = !!normalizeIndianPhone(order.customer?.phone);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-1">Order {order.orderNumber}</h1>
      <p className="text-sm text-brand-ink/50 mb-5">{new Date(order.createdAt).toLocaleString('en-IN')}</p>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Items</h2>
        {order.items.map((item, i) => {
          const resolved = resolveOrderItem(item, index);
          return (
            <button
              key={i}
              onClick={() =>
                setModalItem({ item, image: resolved.image, categoryName: categoryName(resolved.category), productSku: resolved.product?.sku })
              }
              className="w-full flex justify-between items-center text-sm py-2 border-b border-brand-ink/5 last:border-b-0 hover:bg-brand-ink/5 rounded-lg px-2 -mx-2 transition-colors text-left"
            >
              <span className="flex items-center gap-3">
                {resolved.image ? (
                  <img src={resolved.image} alt={item.name} className="w-10 h-10 rounded-md object-cover shrink-0" />
                ) : (
                  <span className="w-10 h-10 rounded-md bg-brand-ink/5 shrink-0" />
                )}
                <span>
                  {item.name} ({[item.color, item.size, item.sleeveType, item.zipType, item.pantOption?.name, item.shawlOption?.name].filter(Boolean).join('/')}) x{item.qty}
                  {resolved.product?.sku && (
                    <span className="block text-xs text-brand-ink/50">Product SKU: {resolved.product.sku}</span>
                  )}
                  {item.sku && (
                    <span className="block text-xs text-brand-ink/40">Size SKU: {item.sku}</span>
                  )}
                </span>
              </span>
              <span>{formatINR(item.price * item.qty)}</span>
            </button>
          );
        })}
        <div className="flex justify-between font-bold mt-2 border-t pt-2"><span>Total</span><span>{formatINR(order.total)}</span></div>
      </div>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Customer & Shipping</h2>
        <p className="text-sm">{order.customer?.name} — {order.customer?.phone}</p>
        <p className="text-sm text-brand-ink/70">{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
        <p className="text-sm text-brand-ink/70">{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
      </div>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Order Status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${order.status === s ? 'bg-brand-pink text-white border-brand-pink' : 'border-brand-ink/15 text-brand-ink/70'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card-soft p-5 mb-4">
        <h2 className="font-semibold mb-2">Courier Details</h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <input placeholder="Courier partner" className="border rounded-lg px-3 py-2 text-sm" value={courier.partner} onChange={(e) => setCourier({ ...courier, partner: e.target.value })} />
          <input placeholder="AWB / Tracking number" className="border rounded-lg px-3 py-2 text-sm" value={courier.awbNumber} onChange={(e) => setCourier({ ...courier, awbNumber: e.target.value })} />
          <input placeholder="Tracking link/ID" className="border rounded-lg px-3 py-2 text-sm" value={courier.trackingId} onChange={(e) => setCourier({ ...courier, trackingId: e.target.value })} />
        </div>
        <button onClick={saveCourier} className="btn-outline text-sm">Save Courier Info</button>
      </div>

      <div className="card-soft p-5 mb-4">
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${waKind === s ? 'bg-brand-magenta text-white border-brand-magenta' : 'border-brand-ink/15 text-brand-ink/70'}`}
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
            No courier details are saved yet. Save them above first to include them in the message.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={sendWhatsApp}
            disabled={!phoneValid}
            className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send WhatsApp update
          </button>
          <button
            onClick={() => setWaMessage(buildWhatsAppMessage(order, waKind))}
            className="text-xs text-brand-ink/60 underline"
          >
            Reset message
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href={`/invoice/${order._id}`} target="_blank" className="btn-outline text-sm">View Invoice</Link>
        <Link href={`/courier-bill/${order._id}`} target="_blank" className="btn-outline text-sm">Print Shipping Label</Link>
      </div>

      <OrderItemModal
        item={modalItem?.item}
        image={modalItem?.image}
        categoryName={modalItem?.categoryName}
        productSku={modalItem?.productSku}
        onClose={() => setModalItem(null)}
      />
    </div>
  );
}