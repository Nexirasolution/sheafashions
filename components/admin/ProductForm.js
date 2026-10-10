'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Trash2, Upload, Loader2, X } from 'lucide-react';
import { INDIAN_STATES } from '@/lib/indianStates';

// Design tokens — same teal / gold / cream system as the rest of the site.
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';
const WASH = '#F5EFE0';
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const DISABLED_BG = '#F1EBDC';

function emptySize() {
  // price '' = "use the variant price"
  return { size: '', stock: 0, sku: '', price: '' };
}

function emptyVariant() {
  return {
    color: '',
    colorHex: '#064E4A',
    images: [''],
    price: '',
    compareAtPrice: '',
    sizes: [emptySize()],
  };
}

function emptyAddonOption() {
  return { name: '', image: '', price: '', stock: '', sku: '' };
}

function normalizeSizeChart(value) {
  if (Array.isArray(value)) return value;
  if (value) return [value]; // backward-compat with the old single-string field
  return [];
}

// Existing products may have sizes with no price (null/undefined) — show them as blank inputs.
function normalizeVariants(variants) {
  return (variants || []).map((v) => ({
    ...v,
    sizes: (v.sizes || []).map((s) => ({ ...s, price: s.price ?? '' })),
  }));
}

// Shared input style
const inputStyle = {
  border: `1px solid ${LINE}`,
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  color: INK,
  background: PAPER,
  width: '100%',
  outline: 'none',
  marginTop: '4px',
};

const labelStyle = {
  fontSize: '12px',
  fontWeight: '500',
  color: INK_SOFT,
  fontFamily: 'sans-serif',
};

const cardStyle = {
  background: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: '6px',
  padding: '20px',
  marginBottom: '16px',
};

const sectionHeadStyle = {
  fontSize: '11px',
  fontWeight: '500',
  color: TEAL,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontFamily: 'sans-serif',
  marginBottom: '12px',
};

function ImageSlot({ value, onChange, onRemove, showRemove }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange(data.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="shrink-0 overflow-hidden relative"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '4px',
          border: `1.5px dashed ${TEAL}`,
          background: WASH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : uploading ? (
          <Loader2 size={16} className="animate-spin" style={{ color: INK }} />
        ) : (
          <Upload size={14} style={{ color: TEAL }} />
        )}
        {uploading && value && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,253,245,0.7)' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: INK }} />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <input
        placeholder="https://... or click thumbnail to upload"
        style={{ ...inputStyle, marginTop: 0, flex: 1 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => (e.target.style.borderColor = TEAL)}
        onBlur={(e) => (e.target.style.borderColor = LINE)}
      />

      {showRemove && (
        <button type="button" onClick={onRemove} style={{ color: INK_SOFT, flexShrink: 0 }} aria-label="Remove image">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// Reusable editor for a list of named add-on options (pants / shawls).
// Each option gets its own image, extra price (added on top of the
// variant price when a customer picks it), stock, and optional SKU.
function AddonOptionsEditor({ title, options, onAdd, onUpdate, onRemove }) {
  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ ...sectionHeadStyle, marginBottom: 0 }}>{title}</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5"
          style={{
            background: PAPER,
            color: TEAL,
            border: `1px solid ${TEAL}`,
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add {title.replace(/s$/, '')}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: options.length ? '12px' : 0 }}>
        Leave empty if {title.toLowerCase()} don't apply to this product. The price entered is ADDED
        on top of the variant/size price when a customer selects it. Customers can also choose "None".
      </p>

      {options.map((opt, idx) => (
        <div
          key={idx}
          className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3 pb-3"
          style={{ borderBottom: idx < options.length - 1 ? `1px solid ${LINE}` : 'none' }}
        >
          <ImageSlot
            value={opt.image}
            onChange={(url) => onUpdate(idx, 'image', url)}
            onRemove={() => onUpdate(idx, 'image', '')}
            showRemove={!!opt.image}
          />
          <div className="grid sm:grid-cols-4 gap-2 flex-1">
            <input
              placeholder="Name (e.g. Cotton Palazzo)"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.name}
              onChange={(e) => onUpdate(idx, 'name', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              type="number"
              placeholder="Extra price ₹"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.price}
              onChange={(e) => onUpdate(idx, 'price', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              type="number"
              placeholder="Stock"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.stock}
              onChange={(e) => onUpdate(idx, 'stock', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
            <input
              placeholder="SKU (optional)"
              style={{ ...inputStyle, marginTop: 0 }}
              value={opt.sku}
              onChange={(e) => onUpdate(idx, 'sku', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            style={{ color: INK_SOFT, cursor: 'pointer', flexShrink: 0, marginTop: '12px' }}
            aria-label="Remove option"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ProductForm({ initial, productId }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(() => {
    const base = initial || {
      name: '', slug: '', sku: '', description: '', category: '', fabric: '', tags: [], weight: '',
      variants: [emptyVariant()],
      sizeChart: [],
      sleeveOptions: [],
      zipOptions: [],
      pantOptions: [],
      shawlOptions: [],
      freeShipping: false,
      freeShippingStates: [],
      isBestSeller: false, isTopSeller: false, isActiveSeller: true, isFeatured: false, isActive: true,
      isReadyToShip: false,
    };
    return {
      ...base,
      weight: base.weight > 0 ? base.weight : '',
      variants: normalizeVariants(base.variants),
      sizeChart: normalizeSizeChart(base.sizeChart),
      sleeveOptions: base.sleeveOptions || [],
      zipOptions: base.zipOptions || [],
      pantOptions: (base.pantOptions || []).map((o) => ({ ...o })),
      shawlOptions: (base.shawlOptions || []).map((o) => ({ ...o })),
      freeShipping: !!base.freeShipping,
      freeShippingStates: base.freeShippingStates || [],
    };
  });
  const [saving, setSaving] = useState(false);
  // 'off' | 'all' (free in every state) | 'states' (free only in the ticked states)
  const [shipMode, setShipMode] = useState(() =>
    initial?.freeShipping ? 'all' : initial?.freeShippingStates?.length ? 'states' : 'off'
  );
  const [sizeChartUploading, setSizeChartUploading] = useState(false);
  const sizeChartFileRef = useRef();

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then((d) => setCategories(d.categories || []));
  }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function toggleArrayValue(field, value) {
    setForm((f) => {
      const current = f[field] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...f, [field]: next };
    });
  }

  function updateVariant(idx, field, value) {
    setForm((f) => { const v = [...f.variants]; v[idx] = { ...v[idx], [field]: value }; return { ...f, variants: v }; });
  }

  function updateVariantImage(vIdx, imgIdx, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = [...variants[vIdx].images];
      images[imgIdx] = value;
      variants[vIdx] = { ...variants[vIdx], images };
      return { ...f, variants };
    });
  }

  function removeVariantImage(vIdx, imgIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      const images = variants[vIdx].images.filter((_, i) => i !== imgIdx);
      variants[vIdx] = { ...variants[vIdx], images: images.length ? images : [''] };
      return { ...f, variants };
    });
  }

  function addVariantImage(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], images: [...variants[vIdx].images, ''] };
      return { ...f, variants };
    });
  }

  function updateSize(vIdx, sIdx, field, value) {
    setForm((f) => {
      const variants = [...f.variants];
      const sizes = [...variants[vIdx].sizes];
      sizes[sIdx] = { ...sizes[sIdx], [field]: value };
      variants[vIdx] = { ...variants[vIdx], sizes };
      return { ...f, variants };
    });
  }

  function addSize(vIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: [...variants[vIdx].sizes, emptySize()] };
      return { ...f, variants };
    });
  }

  function removeSize(vIdx, sIdx) {
    setForm((f) => {
      const variants = [...f.variants];
      variants[vIdx] = { ...variants[vIdx], sizes: variants[vIdx].sizes.filter((_, i) => i !== sIdx) };
      return { ...f, variants };
    });
  }

  function addVariant() { setForm((f) => ({ ...f, variants: [...f.variants, emptyVariant()] })); }
  function removeVariant(idx) { setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) })); }

  // Pant / Shawl option list handlers — same shape, different field name.
  function addAddonOption(field) {
    setForm((f) => ({ ...f, [field]: [...(f[field] || []), emptyAddonOption()] }));
  }
  function updateAddonOption(field, idx, key, value) {
    setForm((f) => {
      const list = [...(f[field] || [])];
      list[idx] = { ...list[idx], [key]: value };
      return { ...f, [field]: list };
    });
  }
  function removeAddonOption(field, idx) {
    setForm((f) => ({ ...f, [field]: (f[field] || []).filter((_, i) => i !== idx) }));
  }

  // Size chart — supports multiple images. Selecting several files at once
  // uploads each in turn and appends every resulting URL to the array.
  async function handleSizeChartFilesChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSizeChartUploading(true);
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
      setForm((f) => ({ ...f, sizeChart: [...(f.sizeChart || []), ...uploaded] }));
      toast.success(`${uploaded.length} size chart image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSizeChartUploading(false);
      e.target.value = '';
    }
  }

  function removeSizeChartImage(idx) {
    setForm((f) => ({ ...f, sizeChart: (f.sizeChart || []).filter((_, i) => i !== idx) }));
  }

  async function submit(e) {
    e.preventDefault();

    if (shipMode === 'states' && (form.freeShippingStates || []).length === 0) {
      toast.error('Select at least one state for free shipping, or choose another option');
      return;
    }

    setSaving(true);
    // Note: sku is intentionally omitted — it's auto-generated/managed server-side
    // based on the product's category (see /api/products and /api/products/[id]).
    const payload = {
      ...form,
      weight: Math.max(0, Number(form.weight) || 0), // grams, manual entry
      sizeChart: form.sizeChart || [],
      sleeveOptions: form.sleeveOptions || [],
      zipOptions: form.zipOptions || [],
      // Free shipping: everywhere, or only in the selected states
      freeShipping: shipMode === 'all',
      freeShippingStates: shipMode === 'states' ? (form.freeShippingStates || []) : [],
      pantOptions: (form.pantOptions || [])
        .filter((o) => o.name?.trim())
        .map((o) => ({
          name: o.name.trim(),
          image: o.image || '',
          price: Number(o.price) || 0,
          stock: Number(o.stock) || 0,
          sku: o.sku || '',
        })),
      shawlOptions: (form.shawlOptions || [])
        .filter((o) => o.name?.trim())
        .map((o) => ({
          name: o.name.trim(),
          image: o.image || '',
          price: Number(o.price) || 0,
          stock: Number(o.stock) || 0,
          sku: o.sku || '',
        })),
      variants: form.variants.map((v) => ({
        ...v,
        price: Number(v.price),
        compareAtPrice: Number(v.compareAtPrice) || 0,
        images: v.images.filter(Boolean),
        sizes: v.sizes.map((s) => ({
          ...s,
          stock: Number(s.stock),
          // blank = use the variant price
          price: s.price === '' || s.price == null ? null : Number(s.price),
        })),
      })),
    };
    delete payload.sku;

    const url = productId ? `/api/products/${productId}` : '/api/products';
    const method = productId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success(productId ? 'Product updated' : 'Product created');
      router.push('/admin/products');
    } else {
      toast.error(data.error || 'Something went wrong');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">

      {/* Basic Info Card */}
      <div style={cardStyle}>
        <p style={sectionHeadStyle}>Product Details</p>
        <div style={{ height: '1px', background: LINE, marginBottom: '16px' }} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Product Name *</label>
            <input
              required
              style={inputStyle}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>SKU</label>
            <input
              disabled
              readOnly
              style={{ ...inputStyle, background: DISABLED_BG, color: INK_SOFT, cursor: 'not-allowed' }}
              value={form.sku || 'Auto-generated from category on save'}
              title="SKU is generated automatically from the product's category"
            />
          </div>
          <div>
            <label style={labelStyle}>Category *</label>
            <select
              required
              style={inputStyle}
              value={form.category?._id || form.category}
              onChange={(e) => update('category', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fabric</label>
            <input
              style={inputStyle}
              value={form.fabric}
              onChange={(e) => update('fabric', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>Tags (comma separated)</label>
            <input
              style={inputStyle}
              value={Array.isArray(form.tags) ? form.tags.join(', ') : ''}
              onChange={(e) => update('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div>
            <label style={labelStyle}>Weight (grams)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 450 (weight of one piece)"
              style={inputStyle}
              value={form.weight ?? ''}
              onChange={(e) => update('weight', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>
          <div className="sm:col-span-2">
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical' }}
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = TEAL)}
              onBlur={(e) => (e.target.style.borderColor = LINE)}
            />
          </div>

          {/* Size chart — one or more images. If left empty, the storefront
              falls back to this product's category size chart. */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>
              Size Chart <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>
                (optional — shown as a gallery on the product page; falls back to the category's size chart if left empty)
              </span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-2">
              {(form.sizeChart || []).map((url, idx) => (
                <div key={idx} className="relative aspect-square overflow-hidden" style={{ borderRadius: '4px', border: `1px solid ${LINE}` }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeSizeChartImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(23,42,41,0.7)', color: PAPER }}
                    aria-label="Remove size chart image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={sizeChartUploading}
                onClick={() => sizeChartFileRef.current?.click()}
                className="aspect-square flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                style={{ borderRadius: '4px', border: `1.5px dashed ${TEAL}`, background: WASH, color: TEAL, cursor: 'pointer' }}
              >
                {sizeChartUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span style={{ fontSize: '10px', fontFamily: 'sans-serif' }}>{sizeChartUploading ? 'Uploading…' : 'Add'}</span>
              </button>
            </div>
            <input ref={sizeChartFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSizeChartFilesChange} />
          </div>

          {/* Sleeve/Zip options — product-level, not per-variant. */}
          <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>
                Sleeve Type Options <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-2">
                {['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'].map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                    <input
                      type="checkbox"
                      checked={(form.sleeveOptions || []).includes(opt)}
                      onChange={() => toggleArrayValue('sleeveOptions', opt)}
                      style={{ accentColor: TEAL, width: '15px', height: '15px' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                Zip Type Options <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-2">
                {['With Zip', 'Without Zip'].map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                    <input
                      type="checkbox"
                      checked={(form.zipOptions || []).includes(opt)}
                      onChange={() => toggleArrayValue('zipOptions', opt)}
                      style={{ accentColor: TEAL, width: '15px', height: '15px' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Free shipping: whole product, or only for selected states */}
          <div className="sm:col-span-2">
            <label style={labelStyle}>Free Shipping</label>
            <div className="flex flex-wrap gap-4 mt-2">
              {[
                ['off', 'Normal shipping'],
                ['all', 'Free in all states'],
                ['states', 'Free only in selected states'],
              ].map(([val, text]) => (
                <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                  <input
                    type="radio"
                    name="freeShippingMode"
                    checked={shipMode === val}
                    onChange={() => setShipMode(val)}
                    style={{ accentColor: TEAL, width: '15px', height: '15px' }}
                  />
                  {text}
                </label>
              ))}
            </div>

            {shipMode === 'states' && (
              <div className="mt-3">
                <div className="flex gap-4 mb-2" style={{ fontSize: '12px', fontFamily: 'sans-serif' }}>
                  <button type="button" style={{ color: TEAL, fontWeight: 500 }} onClick={() => update('freeShippingStates', [...INDIAN_STATES])}>
                    Select all
                  </button>
                  <button type="button" style={{ color: INK_SOFT, fontWeight: 500 }} onClick={() => update('freeShippingStates', [])}>
                    Clear
                  </button>
                  <span style={{ color: INK_SOFT }}>{(form.freeShippingStates || []).length} selected</span>
                </div>
                <div
                  className="grid sm:grid-cols-3 gap-x-4 gap-y-1.5 p-3 overflow-y-auto"
                  style={{ border: `1px solid ${LINE}`, borderRadius: '4px', maxHeight: '180px' }}
                >
                  {INDIAN_STATES.map((st) => (
                    <label key={st} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: INK, fontFamily: 'sans-serif' }}>
                      <input
                        type="checkbox"
                        checked={(form.freeShippingStates || []).includes(st)}
                        onChange={() => toggleArrayValue('freeShippingStates', st)}
                        style={{ accentColor: TEAL, width: '15px', height: '15px' }}
                      />
                      {st}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginTop: '6px' }}>
              A free-shipping product adds no weight to the shipping charge. If every item in the cart ships free, shipping is ₹0.
            </p>
          </div>

          {/* Toggles */}
          <div className="sm:col-span-2 flex flex-wrap gap-4">
            {[
              ['isBestSeller', 'Bestseller'],
              ['isTopSeller', 'Top Seller'],
              ['isActiveSeller', 'Active Seller'],
              ['isFeatured', 'Featured'],
              ['isActive', 'Active (visible on site)'],
              ['isReadyToShip', 'Ready to Ship'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm cursor-pointer"
                style={{ color: INK_SOFT, fontFamily: 'sans-serif' }}
              >
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => update(key, e.target.checked)}
                  style={{ accentColor: TEAL, width: '15px', height: '15px' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Variants Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ ...sectionHeadStyle, marginBottom: 0 }}>Variants</h2>
          <button
            type="button"
            onClick={addVariant}
            className="flex items-center gap-1 text-sm font-medium px-4 py-2 transition-colors"
            style={{
              background: PAPER,
              color: TEAL,
              border: `1px solid ${TEAL}`,
              borderRadius: '4px',
              fontFamily: 'sans-serif',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = TEAL;
              e.currentTarget.style.color = PAPER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = PAPER;
              e.currentTarget.style.color = TEAL;
            }}
          >
            <Plus size={16} /> Add Variant
          </button>
        </div>

        {form.variants.map((v, vIdx) => (
          <div key={vIdx} style={cardStyle}>
            {/* Variant header */}
            <div
              className="flex justify-between items-center mb-3 pb-2"
              style={{ borderBottom: `1px solid ${LINE}` }}
            >
              <span style={{ fontWeight: '500', fontSize: '13px', color: INK, fontFamily: 'sans-serif' }}>
                Variant {vIdx + 1}
              </span>
              {form.variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(vIdx)}
                  style={{ color: INK_SOFT, cursor: 'pointer' }}
                  aria-label="Remove variant"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-3 mb-3">
              <input
                placeholder="Color name (e.g. Green)"
                style={inputStyle}
                value={v.color}
                onChange={(e) => updateVariant(vIdx, 'color', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = TEAL)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
              <input
                type="color"
                style={{ ...inputStyle, padding: '4px', height: '40px' }}
                value={v.colorHex}
                onChange={(e) => updateVariant(vIdx, 'colorHex', e.target.value)}
              />
              <input
                placeholder="Default price ₹"
                type="number"
                style={inputStyle}
                value={v.price}
                onChange={(e) => updateVariant(vIdx, 'price', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = TEAL)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
              <input
                placeholder="Compare-at price ₹"
                type="number"
                style={inputStyle}
                value={v.compareAtPrice}
                onChange={(e) => updateVariant(vIdx, 'compareAtPrice', e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = TEAL)}
                onBlur={(e) => (e.target.style.borderColor = LINE)}
              />
            </div>

            <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '8px', fontWeight: '500' }}>
              Images for this colour — click thumbnail to upload
            </p>
            {v.images.map((img, imgIdx) => (
              <ImageSlot
                key={imgIdx}
                value={img}
                onChange={(url) => updateVariantImage(vIdx, imgIdx, url)}
                onRemove={() => removeVariantImage(vIdx, imgIdx)}
                showRemove={v.images.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={() => addVariantImage(vIdx)}
              style={{ fontSize: '12px', color: TEAL, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '12px', cursor: 'pointer' }}
            >
              + Add another image
            </button>

            <p style={{ fontSize: '12px', color: INK_SOFT, fontFamily: 'sans-serif', fontWeight: '500', marginBottom: '2px' }}>
              Sizes, Stock &amp; Price
            </p>
            <p style={{ fontSize: '11px', color: INK_SOFT, fontFamily: 'sans-serif', marginBottom: '8px' }}>
              Leave a size's price blank to use the default price above. Customers see each size's price on the product page.
            </p>
            {v.sizes.map((s, sIdx) => (
              <div key={sIdx} className="flex flex-wrap gap-2 mb-2 items-center">
                <input
                  placeholder="Size (e.g. M, 38, Free Size)"
                  style={{ ...inputStyle, width: '140px', marginTop: 0 }}
                  value={s.size}
                  onChange={(e) => updateSize(vIdx, sIdx, 'size', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <input
                  type="number"
                  placeholder="Stock"
                  style={{ ...inputStyle, width: '90px', marginTop: 0 }}
                  value={s.stock}
                  onChange={(e) => updateSize(vIdx, sIdx, 'stock', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Price ₹ (optional)"
                  style={{ ...inputStyle, width: '140px', marginTop: 0 }}
                  value={s.price ?? ''}
                  onChange={(e) => updateSize(vIdx, sIdx, 'price', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <input
                  placeholder="SKU (optional)"
                  style={{ ...inputStyle, flex: 1, minWidth: '120px', marginTop: 0 }}
                  value={s.sku}
                  onChange={(e) => updateSize(vIdx, sIdx, 'sku', e.target.value)}
                  onFocus={(e) => (e.target.style.borderColor = TEAL)}
                  onBlur={(e) => (e.target.style.borderColor = LINE)}
                />
                <button
                  type="button"
                  onClick={() => removeSize(vIdx, sIdx)}
                  style={{ color: INK_SOFT, cursor: 'pointer', flexShrink: 0 }}
                  aria-label="Remove size"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSize(vIdx)}
              style={{ fontSize: '12px', color: TEAL, fontFamily: 'sans-serif', fontWeight: '500', cursor: 'pointer' }}
            >
              + Add size
            </button>
          </div>
        ))}
      </div>

      {/* Pant Options — optional, product-level, admin can add any number */}
      <AddonOptionsEditor
        title="Pant Options"
        options={form.pantOptions}
        onAdd={() => addAddonOption('pantOptions')}
        onUpdate={(idx, key, value) => updateAddonOption('pantOptions', idx, key, value)}
        onRemove={(idx) => removeAddonOption('pantOptions', idx)}
      />

      {/* Shawl Options — optional, product-level, admin can add any number */}
      <AddonOptionsEditor
        title="Shawl Options"
        options={form.shawlOptions}
        onAdd={() => addAddonOption('shawlOptions')}
        onUpdate={(idx, key, value) => updateAddonOption('shawlOptions', idx, key, value)}
        onRemove={(idx) => removeAddonOption('shawlOptions', idx)}
      />

      {/* Submit button */}
      <button
        disabled={saving}
        className="w-full sm:w-auto px-8 py-3 font-medium text-sm transition-opacity"
        style={{
          background: TEAL,
          color: PAPER,
          border: 'none',
          borderRadius: '4px',
          fontFamily: 'sans-serif',
          fontSize: '14px',
          letterSpacing: '0.02em',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving...' : productId ? 'Update Product' : 'Create Product'}
      </button>
    </form>
  );
}