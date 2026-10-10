'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { X, UploadCloud, Loader2, Plus, Upload } from 'lucide-react';
import { INDIAN_STATES } from '@/lib/indianStates';

export default function BulkAddProductsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [categorySizes, setCategorySizes] = useState([]);

  const [skuPrefix, setSkuPrefix] = useState(''); // short code used to build SKUs, e.g. "MT" -> MT001
  const [description, setDescription] = useState('');
  const [fabric, setFabric] = useState('');
  const [weight, setWeight] = useState(''); // grams, one piece — applied to every product in the batch
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stockBySize, setStockBySize] = useState({}); // { S: 10, M: 10, ... }
  const [priceBySize, setPriceBySize] = useState({}); // { S: '', M: '1299', ... } blank = use default price

  // Applies to every product created in this batch
  const [isReadyToShip, setIsReadyToShip] = useState(false);

  // Free shipping for every product in this batch: 'off' | 'all' | 'states'
  const [shipMode, setShipMode] = useState('off');
  const [freeStates, setFreeStates] = useState([]);

  const [sleeveOptions, setSleeveOptions] = useState([]);
  const [zipOptions, setZipOptions] = useState([]);

  const [sizeChart, setSizeChart] = useState([]);
  const [sizeChartUploading, setSizeChartUploading] = useState(false);

  // Fallback for categories that have no predefined sizes configured
  const [manualSizeName, setManualSizeName] = useState('');
  const [manualSizeStock, setManualSizeStock] = useState('');
  const [manualSizePrice, setManualSizePrice] = useState('');
  const [manualSizes, setManualSizes] = useState([]); // [{ size, stock, price }]

  const [files, setFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // objectURL[]
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => toast.error('Failed to load categories'));
  }, []);

  const selectedCategory = categories.find((c) => c._id === category);
  const titlePreview = (selectedCategory?.name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || 'CATEGORY';

  useEffect(() => {
    const cat = categories.find((c) => c._id === category);
    const sizes = cat?.sizes || [];
    setCategorySizes(sizes);
    setStockBySize(Object.fromEntries(sizes.map((s) => [s, ''])));
    setPriceBySize(Object.fromEntries(sizes.map((s) => [s, ''])));
    setManualSizes([]);
    setManualSizeName('');
    setManualSizeStock('');
    setManualSizePrice('');
  }, [category, categories]);

  function toggleSleeveOption(opt) {
    setSleeveOptions((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  }

  function toggleZipOption(opt) {
    setZipOptions((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  }

  function toggleFreeState(st) {
    setFreeStates((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  }

  function handleFilesChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  }

  function removeImage(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function addManualSize() {
    const name = manualSizeName.trim().toUpperCase();
    if (!name) return toast.error('Enter a size name (e.g. S, M, Free Size)');
    if (manualSizes.some((s) => s.size === name)) return toast.error('That size is already added');
    setManualSizes((prev) => [...prev, { size: name, stock: manualSizeStock || '0', price: manualSizePrice }]);
    setManualSizeName('');
    setManualSizeStock('');
    setManualSizePrice('');
  }

  function removeManualSize(name) {
    setManualSizes((prev) => prev.filter((s) => s.size !== name));
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
    const data = await res.json();
    return data.url;
  }

  async function handleSizeChartFilesChange(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setSizeChartUploading(true);
    try {
      const uploaded = [];
      for (const file of selected) {
        const url = await uploadImage(file);
        uploaded.push(url);
      }
      setSizeChart((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} size chart image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(err.message || 'Failed to upload size chart');
    } finally {
      setSizeChartUploading(false);
      e.target.value = '';
    }
  }

  function removeSizeChartImage(idx) {
    setSizeChart((prev) => prev.filter((_, i) => i !== idx));
  }

  // blank / 0 => null => the default price is used for that size
  const toSizePrice = (v) => (v === '' || v == null || Number(v) <= 0 ? null : Number(v));

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);

    if (!category) return toast.error('Select a category');
    if (!skuPrefix.trim()) return toast.error('Enter a SKU code (e.g. MT)');
    if (!price || Number(price) <= 0) return toast.error('Enter a valid price');
    if (files.length === 0) return toast.error('Add at least one image');
    if (shipMode === 'states' && freeStates.length === 0) {
      return toast.error('Select at least one state for free shipping, or choose another option');
    }

    // Combine predefined-size stock/price and manually-added sizes
    const fromPredefined = Object.entries(stockBySize)
      .filter(([, stock]) => stock !== '')
      .map(([size, stock]) => ({ size, stock: Number(stock), price: toSizePrice(priceBySize[size]) }));

    const fromManual = manualSizes.map((s) => ({
      size: s.size,
      stock: Number(s.stock) || 0,
      price: toSizePrice(s.price),
    }));

    const sizes = [...fromPredefined, ...fromManual];

    if (sizes.length === 0) {
      if (categorySizes.length === 0) {
        return toast.error('This category has no sizes configured — add a size manually below, or set sizes on the category first.');
      }
      return toast.error('Enter stock for at least one size');
    }

    setSubmitting(true);
    try {
      // 1. Upload every image first, one product will be created per URL
      const imageUrls = [];
      for (const file of files) {
        const url = await uploadImage(file);
        imageUrls.push(url);
      }

      // 2. Create products in bulk
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          skuPrefix,
          description,
          fabric,
          weight: Math.max(0, Number(weight) || 0),
          price: Number(price),
          compareAtPrice: Number(compareAtPrice) || 0,
          sizes,
          images: imageUrls,
          isReadyToShip,
          sizeChart,
          sleeveOptions,
          zipOptions,
          freeShipping: shipMode === 'all',
          freeShippingStates: shipMode === 'states' ? freeStates : [],
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned an unexpected response (status ${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || `Bulk upload failed (status ${res.status})`);

      setResult(data);
      if (data.createdCount > 0) {
        toast.success(`${data.createdCount} product${data.createdCount > 1 ? 's' : ''} created`);
      }
      if (data.errors?.length) {
        toast.error(`${data.errors.length} item(s) skipped — see details below`);
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-1">Bulk Add Products</h1>
      <p className="text-sm text-brand-ink/50 mb-6">
        One category, description, and fabric applied to every product. Each image you upload becomes
        its own product — titles are generated automatically from the category, and SKUs from the code below.
        Pant/Shawl add-on options can be set afterward from each product's own edit page.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
              required
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {category && (
              <p className="text-xs text-brand-ink/40 mt-1">
                Titles auto-generate as {titlePreview}001, {titlePreview}002...
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">SKU code</label>
            <input
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="e.g. MT"
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
              required
            />
            <p className="text-xs text-brand-ink/40 mt-1">
              SKUs auto-generate as {skuPrefix ? skuPrefix.toUpperCase() : 'MT'}001, {skuPrefix ? skuPrefix.toUpperCase() : 'MT'}002...
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Default price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
              required
            />
            <p className="text-xs text-brand-ink/40 mt-1">
              Used for every size that doesn't have its own price below.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Compare-at price (optional)</label>
            <input
              type="number"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fabric</label>
            <input
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Weight in grams (one piece)</label>
            <input
              type="number"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 450"
              className="w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none"
            />
            <p className="text-xs text-brand-ink/40 mt-1">Applied to every product in this batch. Used for shipping.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Sleeve Type Options (optional)</label>
            <div className="flex flex-wrap gap-3">
              {['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'].map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sleeveOptions.includes(opt)}
                    onChange={() => toggleSleeveOption(opt)}
                    className="w-4 h-4"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Zip Type Options (optional)</label>
            <div className="flex flex-wrap gap-3">
              {['With Zip', 'Without Zip'].map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zipOptions.includes(opt)}
                    onChange={() => toggleZipOption(opt)}
                    className="w-4 h-4"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Size chart — optional, shared across every product in this batch */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Size chart images (optional — applied to every product in this batch; falls back to the category's size chart if left empty)
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {sizeChart.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-brand-ink/5">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeSizeChartImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={sizeChartUploading}
              onClick={() => document.getElementById('bulk-size-chart-input')?.click()}
              className="aspect-square rounded-md border-2 border-dashed border-brand-ink/20 flex flex-col items-center justify-center gap-1 text-brand-ink/40 hover:border-brand-magenta/40 disabled:opacity-50"
            >
              {sizeChartUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="text-[10px]">{sizeChartUploading ? 'Uploading…' : 'Add'}</span>
            </button>
          </div>
          <input
            id="bulk-size-chart-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSizeChartFilesChange}
          />
        </div>

        {/* Free shipping — applies to every product created in this batch */}
        <div>
          <label className="block text-sm font-medium mb-2">Free shipping (applied to every product in this batch)</label>
          <div className="flex flex-wrap gap-4">
            {[
              ['off', 'Normal shipping'],
              ['all', 'Free in all states'],
              ['states', 'Free only in selected states'],
            ].map(([val, text]) => (
              <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="bulkFreeShippingMode"
                  checked={shipMode === val}
                  onChange={() => setShipMode(val)}
                  className="w-4 h-4"
                />
                {text}
              </label>
            ))}
          </div>

          {shipMode === 'states' && (
            <div className="mt-3">
              <div className="flex items-center gap-4 mb-2 text-xs">
                <button type="button" className="underline text-brand-magenta" onClick={() => setFreeStates([...INDIAN_STATES])}>
                  Select all
                </button>
                <button type="button" className="underline text-brand-ink/50" onClick={() => setFreeStates([])}>
                  Clear
                </button>
                <span className="text-brand-ink/40">{freeStates.length} selected</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-x-4 gap-y-1.5 p-3 border border-brand-ink/10 rounded-lg max-h-44 overflow-y-auto">
                {INDIAN_STATES.map((st) => (
                  <label key={st} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeStates.includes(st)}
                      onChange={() => toggleFreeState(st)}
                      className="w-4 h-4"
                    />
                    {st}
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-brand-ink/40 mt-1.5">
            A free-shipping product adds no weight to the shipping charge. If every item in the cart ships free, shipping is ₹0.
          </p>
        </div>

        {/* Ready to ship — applies to every product created in this batch */}
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={isReadyToShip}
            onChange={(e) => setIsReadyToShip(e.target.checked)}
            className="w-4 h-4"
          />
          Mark all products in this batch as "Ready to Ship"
        </label>

        {/* Predefined sizes from the category: stock + optional price per size */}
        {categorySizes.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Stock &amp; price per size (applies to every product)</label>
            <p className="text-xs text-brand-ink/40 mb-2">
              Leave a size's price blank to use the default price above.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              {categorySizes.map((size) => (
                <div key={size} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-8">{size}</span>
                  <input
                    type="number"
                    min="0"
                    value={stockBySize[size] ?? ''}
                    onChange={(e) => setStockBySize((prev) => ({ ...prev, [size]: e.target.value }))}
                    placeholder="Stock"
                    className="w-20 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    value={priceBySize[size] ?? ''}
                    onChange={(e) => setPriceBySize((prev) => ({ ...prev, [size]: e.target.value }))}
                    placeholder="Price ₹"
                    className="w-24 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: category has no sizes configured, let admin add sizes manually for this batch */}
        {category && categorySizes.length === 0 && (
          <div className="border border-brand-gold/40 bg-brand-gold/5 rounded-lg p-3">
            <p className="text-sm font-medium mb-1">No sizes configured for this category</p>
            <p className="text-xs text-brand-ink/50 mb-3">
              Add sizes here for this batch, or go to Categories and set sizes so this shows automatically next time.
            </p>

            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div>
                <label className="block text-xs text-brand-ink/50 mb-1">Size</label>
                <input
                  value={manualSizeName}
                  onChange={(e) => setManualSizeName(e.target.value)}
                  placeholder="e.g. S, Free Size"
                  className="w-32 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink/50 mb-1">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={manualSizeStock}
                  onChange={(e) => setManualSizeStock(e.target.value)}
                  placeholder="0"
                  className="w-24 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink/50 mb-1">Price ₹ (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={manualSizePrice}
                  onChange={(e) => setManualSizePrice(e.target.value)}
                  placeholder="default"
                  className="w-28 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={addManualSize}
                className="flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 hover:border-brand-magenta transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {manualSizes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {manualSizes.map((s) => (
                  <span
                    key={s.size}
                    className="flex items-center gap-1 text-xs bg-white border border-brand-ink/10 rounded-full px-2 py-1"
                  >
                    {s.size}: {s.stock}{Number(s.price) > 0 ? ` · ₹${s.price}` : ''}
                    <button type="button" onClick={() => removeManualSize(s.size)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Images ({files.length} selected — one product per image)
          </label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-brand-ink/15 rounded-lg py-8 cursor-pointer text-brand-ink/50 hover:border-brand-magenta/40">
            <UploadCloud size={22} />
            <span className="text-sm">Click to select images</span>
            <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
              {previews.map((src, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-brand-ink/5">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Creating products...' : `Create ${files.length || ''} Product${files.length === 1 ? '' : 's'}`}
        </button>
      </form>

      {result && (
        <div className="mt-6 card-soft p-4 text-sm">
          <p className="font-medium mb-2">{result.createdCount} product(s) created.</p>
          {result.errors?.length > 0 && (
            <div className="text-brand-ink/60">
              <p className="font-medium text-brand-magenta mb-1">Skipped:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e.name}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => router.push('/admin/products')} className="mt-3 text-brand-magenta underline text-sm">
            Go to product list
          </button>
        </div>
      )}
    </div>
  );
}