'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus } from 'lucide-react';
import { INDIAN_STATES } from '@/lib/indianStates';

export default function AdminSettingsPage() {
  const [form, setForm] = useState(null);
  const [stateToAdd, setStateToAdd] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setForm({ ...d.settings, stateShipping: d.settings.stateShipping || [] }));
  }, []);

  async function submit(e) {
    e.preventDefault();
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) toast.success('Settings saved');
    else toast.error('Could not save settings');
  }

  function addStateRule() {
    if (!stateToAdd) return;
    if (form.stateShipping.some((r) => r.state === stateToAdd)) {
      toast.error(`${stateToAdd} already has a rule`);
      return;
    }
    setForm((f) => ({
      ...f,
      stateShipping: [
        ...f.stateShipping,
        { state: stateToAdd, enabled: true, pricePerKg: null, defaultShippingCharge: null, freeShippingAbove: null }
      ]
    }));
    setStateToAdd('');
  }

  function updateRule(idx, patch) {
    setForm((f) => ({
      ...f,
      stateShipping: f.stateShipping.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    }));
  }

  function removeRule(idx) {
    setForm((f) => ({ ...f, stateShipping: f.stateShipping.filter((_, i) => i !== idx) }));
  }

  // Empty input = null = "use the global value"
  const numOrNull = (v) => (v === '' ? null : Number(v));

  if (!form) return <p className="text-brand-ink/50">Loading...</p>;

  const availableStates = INDIAN_STATES.filter((s) => !form.stateShipping.some((r) => r.state === s));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-5">Store Settings</h1>
      <form onSubmit={submit} className="card-soft p-5 space-y-3">
        <div>
          <label className="text-sm font-medium">Store Name</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.storeName || ''} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">WhatsApp Number (with country code)</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Instagram Handle</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.instagram || ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">Address</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>

        {/* ───────── Global shipping ───────── */}
        <div className="pt-2">
          <h2 className="font-semibold text-sm">Default shipping (all states)</h2>
          <p className="text-xs text-brand-ink/50">
            Applies to every state that doesn&apos;t have its own rule below. Total weight = pieces in cart × weight per piece.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Weight per Piece (grams)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              value={form.weightPerPiece ?? 0}
              onChange={(e) => setForm({ ...form, weightPerPiece: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Price per Kg (₹)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              value={form.pricePerKg ?? 0}
              onChange={(e) => setForm({ ...form, pricePerKg: Number(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-xs text-brand-ink/50 -mt-1">
          e.g. 250g per piece and ₹60/kg means a 3-piece order (750g) rounds up to 1kg → ₹60 shipping.
        </p>

        <div>
          <label className="text-sm font-medium">Default Shipping Charge (₹)</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            value={form.defaultShippingCharge ?? 0}
            onChange={(e) => setForm({ ...form, defaultShippingCharge: Number(e.target.value) })}
          />
          <p className="text-xs text-brand-ink/50 mt-1">
            Used instead of the weight calculation if Weight per Piece or Price per Kg is 0.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Free Shipping Above (₹)</label>
          <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.freeShippingAbove ?? 0} onChange={(e) => setForm({ ...form, freeShippingAbove: Number(e.target.value) })} />
          <p className="text-xs text-brand-ink/50 mt-1">0 disables free shipping.</p>
        </div>

        {/* ───────── State-wise shipping ───────── */}
        <div className="pt-4 border-t">
          <h2 className="font-semibold text-sm">State-wise shipping</h2>
          <p className="text-xs text-brand-ink/50 mb-3">
            Add a state to override the defaults for it. Leave a field blank to use the default above.
            Untick &quot;Deliver&quot; to stop orders to that state. Weight per piece is always global.
          </p>

          <div className="flex gap-2 mb-3">
            <select
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              value={stateToAdd}
              onChange={(e) => setStateToAdd(e.target.value)}
            >
              <option value="">Select a state…</option>
              {availableStates.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="button" onClick={addStateRule} disabled={!stateToAdd} className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
              <Plus size={14} /> Add state
            </button>
          </div>

          {form.stateShipping.length === 0 ? (
            <p className="text-xs text-brand-ink/50">No state rules yet. All states use the default shipping.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-brand-ink/60 border-b">
                    <th className="py-2 pr-2 font-medium">State</th>
                    <th className="py-2 px-2 font-medium">Deliver</th>
                    <th className="py-2 px-2 font-medium">₹ / kg</th>
                    <th className="py-2 px-2 font-medium">Flat ₹</th>
                    <th className="py-2 px-2 font-medium">Free above ₹</th>
                    <th className="py-2 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {form.stateShipping.map((r, idx) => (
                    <tr key={r.state} className="border-b align-middle" style={{ opacity: r.enabled === false ? 0.6 : 1 }}>
                      <td className="py-2 pr-2 whitespace-nowrap">{r.state}</td>
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={r.enabled !== false}
                          onChange={(e) => updateRule(idx, { enabled: e.target.checked })}
                        />
                      </td>
                      {['pricePerKg', 'defaultShippingCharge', 'freeShippingAbove'].map((field) => (
                        <td key={field} className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="default"
                            disabled={r.enabled === false}
                            className="w-24 border rounded-lg px-2 py-1 text-sm disabled:bg-neutral-50"
                            value={r[field] ?? ''}
                            onChange={(e) => updateRule(idx, { [field]: numOrNull(e.target.value) })}
                          />
                        </td>
                      ))}
                      <td className="py-2 pl-2">
                        <button type="button" onClick={() => removeRule(idx)} className="text-brand-magenta" title="Remove rule">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-4 border-t">
          <label className="text-sm font-medium">SEO Title</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.seoTitle || ''} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium">SEO Description</label>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.seoDescription || ''} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
        </div>
        <button className="btn-primary text-sm">Save Settings</button>
      </form>
    </div>
  );
}