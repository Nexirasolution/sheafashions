'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Upload, Loader2, Pencil } from 'lucide-react';
import ColorPackFields from '@/components/admin/ColorPackFields';
import { INDIAN_STATES } from '@/lib/indianStates';

const emptyForm = {
  type: 'multi-product',
  name: '', images: [], description: '',
  comboPrice: '', originalPrice: '', piecesPerCombo: '', productIds: [],
  weight: '',       // grams — total weight of ONE multi-product combo
  pieceWeight: '',  // grams — weight of ONE piece in a color pack
  freeShipping: false,      // free shipping in every state
  freeShippingStates: [],   // free shipping only to these states
  baseProduct: '', colors: [], packOptions: [], sizeChart: [],
};

export default function AdminCombosPage() {
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef();

  async function load() {
    const [r1, r2] = await Promise.all([fetch('/api/combos?all=true'), fetch('/api/products?limit=200')]);
    setCombos((await r1.json()).combos || []);
    setProducts((await r2.json()).products || []);
  }
  useEffect(() => { load(); }, []);

  // Sum of the manual weights of the products ticked for this combo (helper for the admin)
  const selectedWeightSum = form.productIds.reduce(
    (sum, id) => sum + (Number(products.find((p) => p._id === id)?.weight) || 0),
    0
  );

  function toggleProduct(id) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter((p) => p !== id) : [...f.productIds, id],
    }));
  }

  function toggleFreeState(state) {
    setForm((f) => ({
      ...f,
      freeShippingStates: f.freeShippingStates.includes(state)
        ? f.freeShippingStates.filter((s) => s !== state)
        : [...f.freeShippingStates, state],
    }));
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  function openCreateForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(combo) {
    setForm({
      type: combo.type || 'multi-product',
      name: combo.name || '',
      images: combo.images?.length ? combo.images : (combo.image ? [combo.image] : []),
      description: combo.description || '',
      comboPrice: combo.comboPrice ?? '',
      originalPrice: combo.originalPrice ?? '',
      piecesPerCombo: combo.piecesPerCombo || '',
      productIds: (combo.products || []).map((p) => (typeof p.product === 'object' ? p.product?._id : p.product) || p._id || p),
      weight: combo.weight > 0 ? combo.weight : '',
      pieceWeight: combo.pieceWeight > 0 ? combo.pieceWeight : '',
      freeShipping: combo.freeShipping === true,
      freeShippingStates: combo.freeShippingStates || [],
      baseProduct: (typeof combo.baseProduct === 'object' ? combo.baseProduct?._id : combo.baseProduct) || '',
      colors: combo.colors || [],
      packOptions: combo.packOptions || [],
      sizeChart: combo.sizeChart || [],
    });
    setEditingId(combo._id);
    setShowForm(true);
  }

  async function handleFilesChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        uploaded.push(data.url);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
      toast.success(uploaded.length > 1 ? `${uploaded.length} images uploaded` : 'Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removeImage(idx) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  async function submit(e) {
    e.preventDefault();
    const isColorPack = form.type === 'color-pack';

    // Shared by both combo types. "All states" wins over the per-state list.
    const shippingPayload = {
      freeShipping: form.freeShipping === true,
      freeShippingStates: form.freeShipping ? [] : form.freeShippingStates,
    };

    const payload = isColorPack
      ? {
          type: 'color-pack',
          name: form.name,
          images: form.images,
          description: form.description,
          baseProduct: form.baseProduct,
          colors: form.colors,
          packOptions: form.packOptions,
          sizeChart: form.sizeChart,
          // grams per piece; blank = use the base product's weight
          pieceWeight: Math.max(0, Number(form.pieceWeight) || 0),
          ...shippingPayload,
        }
      : {
          type: 'multi-product',
          name: form.name,
          images: form.images,
          description: form.description,
          comboPrice: Number(form.comboPrice),
          originalPrice: Number(form.originalPrice) || 0,
          piecesPerCombo: Number(form.piecesPerCombo) || form.productIds.length,
          products: form.productIds.map((id) => ({ product: id })),
          sizeChart: form.sizeChart,
          // grams for ONE combo; blank = sum of the products' own weights
          weight: Math.max(0, Number(form.weight) || 0),
          ...shippingPayload,
        };

    const isEditing = Boolean(editingId);
    const url = isEditing ? `/api/combos/${editingId}` : '/api/combos';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) {
      toast.success(isEditing ? 'Combo updated' : 'Combo created');
      closeForm();
      load();
    } else {
      toast.error(data.error || 'Failed');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this combo?')) return;
    await fetch(`/api/combos/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Combo Offers</h1>
        <button onClick={openCreateForm} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Combo
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">{editingId ? 'Edit Combo' : 'New Combo'}</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {['multi-product', 'color-pack'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 text-sm py-2 rounded-lg border ${form.type === t ? 'bg-brand-magenta text-white border-brand-magenta' : 'border-neutral-200 text-neutral-500'}`}
              >
                {t === 'multi-product' ? 'Multi-Product Bundle' : 'Color Pack (single product)'}
              </button>
            ))}
          </div>

          {/* Multi-image upload */}
          <div>
            <p className="text-sm font-medium mb-1">Images</p>
            <div className="flex flex-wrap gap-2">
              {form.images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-neutral-200 group">
                  <img src={img} alt={`combo-${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">Cover</span>
                  )}
                </div>
              ))}
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors relative shrink-0"
              >
                {uploading
                  ? <Loader2 size={18} className="animate-spin text-brand-magenta" />
                  : <div className="flex flex-col items-center gap-0.5 text-brand-ink/40 text-[10px]"><Upload size={16} /><span>Add</span></div>
                }
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChange} />
            <p className="text-[10px] text-neutral-400 mt-1">First image is used as the cover. Drag-to-reorder isn't supported yet — remove and re-add to reorder.</p>
          </div>

          <input required placeholder="Combo name (e.g. Pocket Jeggings Combo)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea placeholder="Description" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          {form.type === 'multi-product' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input required type="number" placeholder="Combo price ₹" className="border rounded-lg px-3 py-2 text-sm" value={form.comboPrice} onChange={(e) => setForm({ ...form, comboPrice: e.target.value })} />
                <input type="number" placeholder="Original price ₹" className="border rounded-lg px-3 py-2 text-sm" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
                <input
                  type="number"
                  min="1"
                  placeholder={`Pieces in combo (${form.productIds.length || 'auto'})`}
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={form.piecesPerCombo}
                  onChange={(e) => setForm({ ...form, piecesPerCombo: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Combo weight (g)"
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
              <p className="text-[10px] text-neutral-400 -mt-1">
                Pieces in combo = total items the customer receives in ONE combo. Combo weight = total weight of ONE combo in grams, used for shipping.
                Leave weight blank to add up the selected products' own weights.
              </p>
              {selectedWeightSum > 0 && (
                <p className="text-[11px] text-neutral-500 -mt-1">
                  Selected products add up to <b>{selectedWeightSum} g</b>.{' '}
                  <button
                    type="button"
                    className="underline text-brand-magenta"
                    onClick={() => setForm((f) => ({ ...f, weight: String(selectedWeightSum) }))}
                  >
                    Use this weight
                  </button>
                </p>
              )}
              <p className="text-sm font-medium">Select products in this combo:</p>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {products.map((p) => (
                  <label key={p._id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.productIds.includes(p._id)} onChange={() => toggleProduct(p._id)} />
                    {p.name}
                    {p.weight > 0 && <span className="text-[10px] text-neutral-400">· {p.weight} g</span>}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <ColorPackFields form={form} setForm={setForm} products={products} />
              <div>
                <label className="block text-sm font-medium mb-1">Weight per piece (grams)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 250"
                  className="w-full sm:w-60 border rounded-lg px-3 py-2 text-sm"
                  value={form.pieceWeight}
                  onChange={(e) => setForm({ ...form, pieceWeight: e.target.value })}
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Pack weight = pieces in the pack × this value (e.g. Pack of 10 × 250 g = 2500 g).
                  Leave blank to use the base product's own weight.
                </p>
              </div>
            </>
          )}

          {/* Free shipping (both combo types) */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium">Shipping</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.freeShipping}
                onChange={(e) => setForm({ ...form, freeShipping: e.target.checked })}
              />
              Free shipping in all states
            </label>

            {!form.freeShipping && (
              <>
                <p className="text-xs text-neutral-500">
                  Or make shipping free only for selected states
                  {form.freeShippingStates.length > 0 && ` (${form.freeShippingStates.length} selected)`}:
                </p>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {INDIAN_STATES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={form.freeShippingStates.includes(s)}
                        onChange={() => toggleFreeState(s)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
                {form.freeShippingStates.length > 0 && (
                  <button
                    type="button"
                    className="text-xs underline text-brand-magenta"
                    onClick={() => setForm({ ...form, freeShippingStates: [] })}
                  >
                    Clear states
                  </button>
                )}
              </>
            )}
            <p className="text-[10px] text-neutral-400">
              Free-shipping combos are left out of the shipping weight. If every item in the cart is free for the
              customer's state, shipping is ₹0.
            </p>
          </div>

          <button className="btn-primary text-sm" disabled={uploading}>
            {uploading ? 'Uploading…' : editingId ? 'Save Changes' : 'Create'}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {combos.map((c) => {
          const priceLabel = c.type === 'color-pack'
            ? (c.packOptions?.length ? `From ₹${Math.min(...c.packOptions.map((p) => p.price))}` : '—')
            : `₹${c.comboPrice}`;
          const cover = c.images?.[0] || c.image;
          const pieceLabel = c.type === 'color-pack'
            ? null
            : `${c.piecesPerCombo || c.products?.length || 1} pcs`;
          const weightLabel = c.type === 'color-pack'
            ? (c.pieceWeight > 0 ? `${c.pieceWeight} g/pc` : null)
            : (c.weight > 0 ? `${c.weight} g` : null);
          return (
            <div key={c._id} className="card-soft overflow-hidden">
              <div className="h-32 bg-brand-cream">{cover && <img src={cover} alt={c.name} className="w-full h-full object-cover" />}</div>
              <div className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.type === 'color-pack' && (
                    <span className="text-[10px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded-full">Color Pack</span>
                  )}
                  {pieceLabel && (
                    <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full">{pieceLabel}</span>
                  )}
                  {weightLabel && (
                    <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full">{weightLabel}</span>
                  )}
                  {(c.freeShipping || c.freeShippingStates?.length > 0) && (
                    <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
                      {c.freeShipping ? 'Free ship' : `Free ship: ${c.freeShippingStates.length} state(s)`}
                    </span>
                  )}
                </div>
                <p className="text-brand-magenta font-semibold text-sm">{priceLabel}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => openEditForm(c)} className="text-brand-ink/60 hover:text-brand-magenta" title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(c._id)} className="text-brand-magenta" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}