'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, CheckCircle2, MessageCircle, Search } from 'lucide-react';
import CourierScanner from '@/components/admin/CourierScanner';
import { parseCourierScan, findOrderInScan } from '@/lib/courierScan';
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
 *  onChanged   – called after closing if anything was saved (refresh your list here)
 *  fixedOrder  – optional: lock the scanner to one order (used on the order detail page)
 */
export default function ScanShipModal({ open, onClose, onChanged, fixedOrder = null }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoShip, setAutoShip] = useState(true);
  const [currentOrder, setCurrentOrder] = useState(null); // order chosen by scanning its label
  const [pending, setPending] = useState(null); // courier data waiting for an order
  const [pickQuery, setPickQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState([]);
  const [manual, setManual] = useState('');
  const [flash, setFlash] = useState(null);

  const ordersRef = useRef([]);
  ordersRef.current = orders;
  const busy = useRef(false);
  const changed = useRef(false);
  const lastScan = useRef({ raw: '', at: 0 });

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

  // Orders shown in the "which order is this?" list
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
        const aNeeds = a.courier?.awbNumber ? 1 : 0;
        const bNeeds = b.courier?.awbNumber ? 1 : 0;
        if (aNeeds !== bNeeds) return aNeeds - bNeeds; // orders without an AWB first
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
      const courier = {
        partner: parsed.partner || order.courier?.partner || '',
        awbNumber: parsed.awbNumber || order.courier?.awbNumber || '',
        trackingId: parsed.trackingId || order.courier?.trackingId || '',
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

    // 1. Does the code mention one of our orders?
    const match = findOrderInScan(raw, ordersRef.current);
    if (match) {
      const parsed = parseCourierScan(match.rest);
      if (parsed?.awbNumber) {
        // receipt carries both order number and AWB -> save straight away
        return saveToOrder(match.order, parsed);
      }
      // it was just the order's own label -> wait for the courier receipt
      feedback(true);
      setPending(null);
      setCurrentOrder(match.order);
      return;
    }

    // 2. Otherwise treat it as courier data
    const parsed = parseCourierScan(raw);
    if (!parsed) {
      feedback(false);
      toast.error("Couldn't read this code. Try again or type it below.");
      return;
    }
    if (currentOrder) return saveToOrder(currentOrder, parsed);

    feedback(true);
    setPending(parsed); // ask the admin which order it belongs to
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Scan courier receipt</h3>
            <p className="text-xs text-brand-ink/50">
              {fixedOrder ? `For order ${fixedOrder.orderNumber}` : 'Details are saved automatically after each scan.'}
            </p>
          </div>
          <button onClick={close} className="p-1.5 rounded-md hover:bg-brand-ink/5" aria-label="Close scanner">
            <X size={18} />
          </button>
        </div>

        {/* What to do next */}
        {currentOrder && !fixedOrder ? (
          <div className="mb-3 rounded-lg bg-brand-ink/5 p-3 text-sm flex items-start justify-between gap-3">
            <p>
              Order <b>{currentOrder.orderNumber}</b> ({currentOrder.customer?.name || 'customer'}) selected.
              <br />
              <span className="text-brand-ink/60">Now scan the courier receipt.</span>
            </p>
            <button onClick={() => setCurrentOrder(null)} className="text-xs underline text-brand-magenta shrink-0">
              Change
            </button>
          </div>
        ) : !pending && !fixedOrder ? (
          <p className="mb-3 text-sm text-brand-ink/70">
            Point the camera at the courier receipt. If it shows your order number it saves right away; otherwise
            you'll pick the order.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-brand-ink/50 py-10 text-center">Loading orders…</p>
        ) : (
          <CourierScanner onScan={handleScan} />
        )}

        {/* Saved confirmation */}
        {flash && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 text-green-700 p-3 text-sm">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>
              Saved for <b>{flash.orderNumber}</b>
              {flash.courier?.awbNumber ? ` · AWB ${flash.courier.awbNumber}` : ''}
              {flash.status === 'shipped' ? ' · marked shipped' : ''}
            </span>
          </div>
        )}

        {saving && <p className="mt-3 text-sm text-brand-ink/60">Saving…</p>}

        {/* Pick an order for a scanned receipt */}
        {pending && !fixedOrder && (
          <div className="mt-3 rounded-lg border border-brand-magenta/30 p-3">
            <p className="text-sm mb-2">
              Scanned <b>{pending.awbNumber || 'tracking link'}</b>
              {pending.partner ? ` (${pending.partner})` : ''}. Which order is it for?
            </p>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40" />
              <input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="Search order number, name or phone"
                className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-brand-ink/5">
              {candidates.map((o) => (
                <li key={o._id}>
                  <button
                    disabled={saving}
                    onClick={() => saveToOrder(o, pending)}
                    className="w-full text-left px-2 py-2 text-sm hover:bg-brand-ink/5 rounded-md flex justify-between gap-3 disabled:opacity-50"
                  >
                    <span>
                      <b>{o.orderNumber}</b> · {o.customer?.name}
                      <span className="block text-xs text-brand-ink/50 capitalize">
                        {o.status}
                        {o.courier?.awbNumber ? ` · already has AWB ${o.courier.awbNumber}` : ''}
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
            <button onClick={() => setPending(null)} className="mt-2 text-xs underline text-brand-ink/60">
              Discard this scan
            </button>
          </div>
        )}

        {/* Manual / hardware scanner input */}
        <form onSubmit={submitManual} className="mt-3 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Or type / paste the AWB (USB scanners work here too)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-outline text-sm">Add</button>
        </form>

        {!fixedOrder && (
          <label className="mt-3 flex items-center gap-2 text-sm text-brand-ink/70">
            <input type="checkbox" checked={autoShip} onChange={(e) => setAutoShip(e.target.checked)} />
            Mark the order as shipped after saving
          </label>
        )}
        {fixedOrder && (
          <label className="mt-3 flex items-center gap-2 text-sm text-brand-ink/70">
            <input type="checkbox" checked={autoShip} onChange={(e) => setAutoShip(e.target.checked)} />
            Also mark this order as shipped
          </label>
        )}

        {/* Session log */}
        {log.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-brand-ink/50 mb-1">Saved in this session ({log.length})</h4>
            <ul className="divide-y divide-brand-ink/5 border rounded-lg">
              {log.map(({ id, order }) => {
                const wa = whatsappLink(order, order.status === 'shipped' ? 'shipped' : order.status);
                return (
                  <li key={id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <b>{order.orderNumber}</b>
                      <span className="block text-xs text-brand-ink/50">
                        {[order.courier?.partner, order.courier?.awbNumber].filter(Boolean).join(' · ') || 'No AWB'}
                      </span>
                    </span>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-700 hover:underline shrink-0"
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

        <div className="mt-4 flex justify-end">
          <button onClick={close} className="btn-outline text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}