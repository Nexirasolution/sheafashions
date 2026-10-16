'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ChevronLeft, Pencil, Trash2, Star, ExternalLink } from 'lucide-react';
import { useCouriers } from '@/lib/useCouriers';
import { buildTrackingUrl } from '@/lib/courierUtils';

const COMMON_NAMES = ['ST Courier', 'Postal Courier'];
const EMPTY = { name: '', trackingUrl: '', isDefault: false };

export default function AdminCouriersPage() {
  const { couriers, loading, reload } = useCouriers();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testAwb, setTestAwb] = useState('');

  const testUrl = buildTrackingUrl({ trackingUrl: form.trackingUrl }, testAwb);

  function startEdit(c) {
    setEditingId(c._id);
    setForm({ name: c.name, trackingUrl: c.trackingUrl || '', isDefault: !!c.isDefault });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
    setTestAwb('');
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Enter the courier name');
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/couriers/${editingId}` : '/api/couriers', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save courier');
      toast.success(editingId ? 'Courier updated' : 'Courier added');
      reset();
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(c) {
    const res = await fetch(`/api/couriers/${c._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) { toast.success(`${c.name} is now the default`); reload(); }
    else toast.error('Could not change default');
  }

  async function remove(c) {
    if (!window.confirm(`Delete ${c.name}? Orders that already use it keep their saved details.`)) return;
    const res = await fetch(`/api/couriers/${c._id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Courier deleted'); if (editingId === c._id) reset(); reload(); }
    else toast.error('Could not delete courier');
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-brand-ink/60 mb-3">
        <ChevronLeft size={16} /> Orders
      </Link>
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-1">Couriers</h1>
      <p className="text-sm text-brand-ink/60 mb-5">
        Set these up once. The tracking link is created automatically from each order's AWB number and is
        shared with customers.
      </p>

      {/* Add / edit form */}
      <form onSubmit={save} className="card-soft p-4 sm:p-5 mb-5 space-y-3">
        <h2 className="font-semibold">{editingId ? 'Edit courier' : 'Add a courier'}</h2>

        <label className="block text-sm">
          <span className="text-xs text-brand-ink/60">Courier name</span>
          <input
            list="courier-names"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Delhivery"
            className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm"
          />
          <datalist id="courier-names">
            {COMMON_NAMES.map((n) => <option key={n} value={n} />)}
          </datalist>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-brand-ink/60">Tracking link</span>
          <input
            value={form.trackingUrl}
            onChange={(e) => setForm({ ...form, trackingUrl: e.target.value })}
            placeholder="https://courier-site.com/track?awb={awb}"
            inputMode="url"
            autoCapitalize="none"
            className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm"
          />
        </label>
        <div className="text-xs text-brand-ink/50 space-y-1">
          <p>
            Open the courier's tracking page, track any number, copy the link, and replace the number in it with{' '}
            <code className="bg-brand-ink/5 px-1 rounded">{'{awb}'}</code>.
          </p>
          <button
            type="button"
            onClick={() => setForm({ ...form, trackingUrl: `${form.trackingUrl}{awb}` })}
            className="underline text-brand-magenta"
          >
            Insert {'{awb}'} at the end
          </button>
        </div>

        {form.trackingUrl && (
          <div className="rounded-lg bg-brand-ink/5 p-3 text-sm">
            <p className="text-xs text-brand-ink/60 mb-2">Test it with a real AWB number</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={testAwb}
                onChange={(e) => setTestAwb(e.target.value)}
                placeholder="Sample AWB"
                className="flex-1 border rounded-lg px-3 py-2.5 text-sm bg-white"
              />
              <a
                href={testUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!testUrl}
                className={`btn-outline text-sm inline-flex items-center justify-center gap-1.5 ${testUrl ? '' : 'opacity-50 pointer-events-none'}`}
              >
                Open link <ExternalLink size={14} />
              </a>
            </div>
            {testUrl && <p className="mt-2 text-xs text-brand-ink/50 break-all">{testUrl}</p>}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-brand-ink/70">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          Use as my default courier
        </label>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          {editingId && (
            <button type="button" onClick={reset} className="btn-outline text-sm">Cancel</button>
          )}
          <button type="submit" disabled={saving} className="btn-outline text-sm disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add courier'}
          </button>
        </div>
      </form>

      {/* Saved couriers */}
      <h2 className="font-semibold mb-2">Saved couriers</h2>
      {loading ? (
        <p className="text-sm text-brand-ink/50">Loading…</p>
      ) : couriers.length === 0 ? (
        <p className="text-sm text-brand-ink/50 card-soft p-5">
          No couriers yet. Add the ones you ship with using the form above.
        </p>
      ) : (
        <ul className="space-y-3">
          {couriers.map((c) => (
            <li key={c._id} className="card-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2 flex-wrap">
                    {c.name}
                    {c.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-magenta text-white">Default</span>
                    )}
                  </p>
                  <p className="text-xs text-brand-ink/50 break-all mt-1">
                    {c.trackingUrl || 'No tracking link — enter it by hand on each order'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => startEdit(c)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs">
                  <Pencil size={13} /> Edit
                </button>
                {!c.isDefault && (
                  <button onClick={() => makeDefault(c)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs">
                    <Star size={13} /> Make default
                  </button>
                )}
                <button onClick={() => remove(c)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs text-red-600">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}