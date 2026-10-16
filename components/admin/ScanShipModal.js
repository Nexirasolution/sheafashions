'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { X, CheckCircle2, MessageCircle, Search } from 'lucide-react';
import CourierScanner from '@/components/admin/CourierScanner';
import { parseCourierScan, findOrderInScan } from '@/lib/courierScan';
import { buildTrackingUrl, findCourierByName } from '@/lib/courierUtils';
import { useCouriers } from '@/lib/useCouriers';
import { whatsappLink } from '@/lib/whatsapp';

const FINISHED = ['shipped', 'delivered', 'cancelled', 'returned'];

function feedback(ok = true) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.value = 0.08;
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
      setTimeout(() => ctx.close(), 500);
    }
  } catch { /* sound is optional */ }
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ok ? 80 : [60, 40, 60]);
}

/**
 * Scan courier receipts and save the details automatically.
 *
 * Props
 *  open        – show/hide
 *  onClose     – called when the modal closes
 *  onChanged   – called after saving (refresh your page data here)
 *  fixedOrder  – optional: lock the scanner to one order (order detail page)
 */
export default function ScanShipModal({ open, onClose, onChanged, fixedOrder = null }) {
  const { couriers, defaultCourier } = useCouriers();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoShip, setAutoShip] = useState(true);
  const [courierId, setCourierId] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [pending, setPending] = useState(null);
  const [pickQuery, setPickQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState([]);
  const [manual, setManual] = useState('');
  const [flash, setFlash] = useState(null);

  const ordersRef = useRef([]);
  ordersRef.current = orders;
  const busy = useRef(false);
  const changed = useRef(false);
  const courierTouched = useRef(false);
  const lastScan = useRef({ raw: '', at: 0 });

  // Pre-select the courier: the order's own courier, else the default one
  useEffect(() => {
    if (!open || courierTouched.current) return;
    const own = fixedOrder ? findCourierByName(couriers, fixedOrder.courier?.partner) : null;
    setCourierId(own?._id || defaultCourier?._id || '');
  }, [open, couriers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset + load orders each time the modal opens
  useEffect(() => {
    if (!open) return;
    setLog([]);
    setPending(null);
    setPickQuery('');
    setManual('');
    setFlash(null);
    changed.current = false;
    busy.current = false;
    courierTouched.current = false;
    lastScan.current = { raw: '', at: 0 };

    if (fixedOrder) {
      setOrders([fixedOrder]);
      setCurrentOrder(fixedOrder);
      return;
    }

    setCurrentOrder(null);
    let cancelled = false;
    setLoading(true);
    fetch('/api/orders')
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => { if (!cancelled) setOrders(d.orders || []); })
      .catch((err) => { console.error(err); toast.error('Could not load orders'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock page scroll behind the modal (mobile)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const candidates = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    return orders
      .filter((o) => !['cancelled', 'returned', 'delivered'].includes(o.status))
      .filter((o) => {
        if (!q) return true;
        return [o.orderNumber, o.customer?.name, o.customer?.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const aHas = a.courier?.awbNumber ? 1 : 0;
        const bHas = b.courier?.awbNumber ? 1 : 0;
        if (aHas !== bHas) return aHas - bHas; // orders without an AWB first
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, 8);
  }, [orders, pickQuery]);

  async function saveToOrder(order, parsed) {
    const dup = parsed.awbNumber
      ? ordersRef.current.find((o) => o._id !== order._id && o.courier?.awbNumber === parsed.awbNumber)
      : null;
    if (
      dup &&
      !window.confirm(
        `AWB ${parsed.awbNumber} is already saved on order ${dup.orderNumber}.\nSave it on ${order.orderNumber} as well?`
      )
    ) {
      return;
    }

    busy.current = true;
    setSaving(true);
    try {
      // Courier: one detected from the receipt wins, otherwise the one picked above
      const detected = findCourierByName(couriers, parsed.partner);
      const chosen = detected || couriers.find((c) => c._id === courierId) || null;
      const awb = parsed.awbNumber || order.courier?.awbNumber || '';
      const url = chosen ? buildTrackingUrl(chosen, awb) : '';

      const courier = {
        partner: chosen?.name || parsed.partner || order.courier?.partner || '',
        awbNumber: awb,
        trackingId: url || parsed.trackingId || order.courier?.trackingId || '',
      };

      const res = await fetch(`/api/orders/${order._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier }),
      });
      if (!res.ok) throw new Error(`Could not save courier details for ${order.orderNumber}`);

      let status = order.status;
      if (autoShip && !FINISHED.includes(order.status)) {
        const r2 = await fetch(`/api/orders/${order._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'shipped' }),
        });
        if (r2.ok) status = 'shipped';
        else toast.error('Courier saved, but the status could not be changed to shipped');
      }

      const updated = { ...order, courier, status };
      setOrders((prev) => prev.map((o) => (o._id === order._id ? updated : o)));
      changed.current = true;
      feedback(true);

      if (!courier.partner) toast('Saved without a courier name. Pick a courier above next time.', { icon: '⚠️' });

      if (fixedOrder) {
        toast.success('Courier details saved');
        onChanged?.();
        onClose?.();
        return;
      }

      setLog((prev) => [{ id: `${Date.now()}`, order: updated }, ...prev]);
      setFlash(updated);
      setTimeout(() => setFlash(null), 2500);
      setCurrentOrder(null);
      setPending(null);
      setPickQuery('');
    } catch (err) {
      console.error(err);
      feedback(false);
      toast.error(err.message || 'Failed to save');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function handleScan(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw || busy.current) return;

    // The camera reports the same code many times; ignore repeats for 3 seconds
    const now = Date.now();
    if (lastScan.current.raw === raw && now - lastScan.current.at < 3000) return;
    lastScan.current = { raw, at: now };

    const match = findOrderInScan(raw, ordersRef.current);
    if (match) {
      const parsed = parseCourierScan(match.rest);
      if (parsed?.awbNumber) return saveToOrder(match.order, parsed);
      feedback(true);
      setPending(null);
      setCurrentOrder(match.order);
      return;
    }

    const parsed = parseCourierScan(raw);
    if (!parsed) {
      feedback(false);
      toast.error("Couldn't read this code. Try again or type it below.");
      return;
    }
    if (currentOrder) return saveToOrder(currentOrder, parsed);

    feedback(true);
    setPending(parsed);
  }

  function submitManual(e) {
    e.preventDefault();
    const value = manual.trim();
    if (!value) return;
    lastScan.current = { raw: '', at: 0 };
    handleScan(value);
    setManual('');
  }

  function close() {
    if (changed.current) onChanged?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col sm:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-ink/10">
          <div className="min-w-0">
            <h3 className="font-semibold">Scan courier receipt</h3>
            <p className="text-xs text-brand-ink/50 truncate">
              {fixedOrder ? `For order ${fixedOrder.orderNumber}` : 'Saved automatically after each scan'}
            </p>
          </div>
          <button onClick={close} className="p-2 -mr-2 rounded-md hover:bg-brand-ink/5" aria-label="Close scanner">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Courier choice */}
          <div>
            <label className="block text-xs text-brand-ink/60">
              Courier
              <select
                value={courierId}
                onChange={(e) => { courierTouched.current = true; setCourierId(e.target.value); }}
                className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm text-brand-ink bg-white"
              >
                <option value="">Detect from receipt</option>
                {couriers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}{c.isDefault ? ' (default)' : ''}</option>
                ))}
              </select>
            </label>
            {couriers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No couriers saved yet.{' '}
                <Link href="/admin/couriers" className="underline">Add couriers</Link> so the tracking link is created automatically.
              </p>
            )}
          </div>

          {/* Next step */}
          {currentOrder && !fixedOrder ? (
            <div className="rounded-lg bg-brand-ink/5 p-3 text-sm flex items-start justify-between gap-3">
              <p>
                Order <b>{currentOrder.orderNumber}</b> ({currentOrder.customer?.name || 'customer'}) selected.
                <span className="block text-brand-ink/60">Now scan the courier receipt.</span>
              </p>
              <button onClick={() => setCurrentOrder(null)} className="text-xs underline text-brand-magenta shrink-0 py-1">
                Change
              </button>
            </div>
          ) : !pending && !fixedOrder ? (
            <p className="text-sm text-brand-ink/70">
              Point the camera at the courier receipt. If it shows your order number it saves right away; otherwise
              you'll pick the order.
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-brand-ink/50 py-10 text-center">Loading orders…</p>
          ) : (
            <CourierScanner onScan={handleScan} />
          )}

          {flash && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 text-green-700 p-3 text-sm">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>
                Saved for <b>{flash.orderNumber}</b>
                {flash.courier?.partner ? ` · ${flash.courier.partner}` : ''}
                {flash.courier?.awbNumber ? ` · ${flash.courier.awbNumber}` : ''}
                {flash.status === 'shipped' ? ' · marked shipped' : ''}
              </span>
            </div>
          )}

          {saving && <p className="text-sm text-brand-ink/60">Saving…</p>}

          {/* Pick an order for a scanned receipt */}
          {pending && !fixedOrder && (
            <div className="rounded-lg border border-brand-magenta/30 p-3">
              <p className="text-sm mb-2">
                Scanned <b className="break-all">{pending.awbNumber || 'tracking link'}</b>
                {pending.partner ? ` (${pending.partner})` : ''}. Which order is it for?
              </p>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40" />
                <input
                  value={pickQuery}
                  onChange={(e) => setPickQuery(e.target.value)}
                  placeholder="Search order number, name or phone"
                  className="w-full border rounded-lg pl-8 pr-3 py-2.5 text-sm"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto divide-y divide-brand-ink/5">
                {candidates.map((o) => (
                  <li key={o._id}>
                    <button
                      disabled={saving}
                      onClick={() => saveToOrder(o, pending)}
                      className="w-full text-left px-2 py-3 text-sm hover:bg-brand-ink/5 rounded-md flex justify-between gap-3 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <b>{o.orderNumber}</b> · {o.customer?.name}
                        <span className="block text-xs text-brand-ink/50 capitalize truncate">
                          {o.status}
                          {o.courier?.awbNumber ? ` · has AWB ${o.courier.awbNumber}` : ''}
                        </span>
                      </span>
                      <span className="text-xs text-brand-magenta self-center shrink-0">Use</span>
                    </button>
                  </li>
                ))}
                {candidates.length === 0 && (
                  <li className="py-3 text-center text-xs text-brand-ink/40">No matching open orders.</li>
                )}
              </ul>
              <button onClick={() => setPending(null)} className="mt-2 text-xs underline text-brand-ink/60 py-1">
                Discard this scan
              </button>
            </div>
          )}

          {/* Manual / hardware scanner input */}
          <form onSubmit={submitManual} className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Type or paste the AWB number"
              autoCapitalize="characters"
              className="flex-1 min-w-0 border rounded-lg px-3 py-2.5 text-sm"
            />
            <button type="submit" className="btn-outline text-sm shrink-0">Add</button>
          </form>

          <label className="flex items-center gap-2 text-sm text-brand-ink/70">
            <input type="checkbox" checked={autoShip} onChange={(e) => setAutoShip(e.target.checked)} />
            {fixedOrder ? 'Also mark this order as shipped' : 'Mark the order as shipped after saving'}
          </label>

          {log.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-brand-ink/50 mb-1">Saved in this session ({log.length})</h4>
              <ul className="divide-y divide-brand-ink/5 border rounded-lg">
                {log.map(({ id, order }) => {
                  const wa = whatsappLink(order, order.status);
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <b>{order.orderNumber}</b>
                        <span className="block text-xs text-brand-ink/50 truncate">
                          {[order.courier?.partner, order.courier?.awbNumber].filter(Boolean).join(' · ') || 'No AWB'}
                        </span>
                      </span>
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-green-700 shrink-0 px-2 py-1.5 rounded-md border border-green-200"
                        >
                          <MessageCircle size={14} /> Notify
                        </a>
                      ) : (
                        <span className="text-xs text-brand-ink/30 shrink-0">No phone</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-brand-ink/10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={close} className="btn-outline text-sm w-full sm:w-auto sm:float-right">Done</button>
          <div className="clear-both" />
        </div>
      </div>
    </div>
  );
}