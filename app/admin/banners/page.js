'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Upload, Loader2, Pencil } from 'lucide-react';

const emptyForm = {
  title: '', subtitle: '', image: '', mobileImage: '', link: '',
  buttonText: 'Shop Now', sortOrder: 0, isActive: true,
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [preview, setPreview] = useState('');
  const [mobilePreview, setMobilePreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef();
  const mobileFileRef = useRef();

  async function load() {
    const res = await fetch('/api/banners?all=true');
    const data = await res.json();
    setBanners(data.banners || []);
  }
  useEffect(() => { load(); }, []);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // local preview instantly
    setPreview(URL.createObjectURL(file));

    // upload to Cloudinary via our API route
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((f) => ({ ...f, image: data.url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
      setPreview('');
    } finally {
      setUploading(false);
    }
  }

  async function handleMobileFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // local preview instantly
    setMobilePreview(URL.createObjectURL(file));

    // upload to Cloudinary via our API route
    setUploadingMobile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((f) => ({ ...f, mobileImage: data.url }));
      toast.success('Mobile image uploaded');
    } catch (err) {
      toast.error(err.message);
      setMobilePreview('');
    } finally {
      setUploadingMobile(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPreview('');
    setMobilePreview('');
    setShowForm(true);
  }

  function openEdit(b) {
    setEditingId(b._id);
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      image: b.image || '',
      mobileImage: b.mobileImage || '',
      link: b.link || '',
      buttonText: b.buttonText || 'Shop Now',
      sortOrder: b.sortOrder ?? 0,
      isActive: b.isActive ?? true,
    });
    setPreview(b.image || '');
    setMobilePreview(b.mobileImage || '');
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.image) { toast.error('Please upload an image'); return; }

    const isEditing = Boolean(editingId);
    const res = await fetch(
      isEditing ? `/api/banners/${editingId}` : '/api/banners',
      {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }
    );

    if (res.ok) {
      toast.success(isEditing ? 'Banner updated' : 'Banner added');
      closeForm();
      load();
    } else {
      toast.error(isEditing ? 'Failed to update banner' : 'Failed to add banner');
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setPreview('');
    setMobilePreview('');
  }

  async function toggleActive(b) {
    await fetch(`/api/banners/${b._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this banner?')) return;
    await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Homepage Banners</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">{editingId ? 'Edit Banner' : 'New Banner'}</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          {/* Desktop Image upload */}
          <div>
            <p className="text-xs font-medium text-brand-ink/60 mb-1">Desktop Image (required)</p>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className="w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden relative"
            >
              {preview ? (
                <img src={preview} alt="desktop preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-brand-ink/40 text-sm">
                  <Upload size={24} />
                  <span>Click to choose image</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-brand-magenta" />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <p className="text-xs text-brand-ink/40 mt-1">Recommended: wide crop, ~2.4:1 ratio.</p>
          </div>

          {/* Mobile Image upload */}
          <div>
            <p className="text-xs font-medium text-brand-ink/60 mb-1">Mobile Image (optional — falls back to desktop image)</p>
            <div
              onClick={() => !uploadingMobile && mobileFileRef.current?.click()}
              className="w-full h-48 max-w-[220px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden relative"
            >
              {mobilePreview ? (
                <img src={mobilePreview} alt="mobile preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-brand-ink/40 text-sm">
                  <Upload size={24} />
                  <span>Click to choose image</span>
                </div>
              )}
              {uploadingMobile && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-brand-magenta" />
                </div>
              )}
            </div>
            <input ref={mobileFileRef} type="file" accept="image/*" className="hidden" onChange={handleMobileFileChange} />
            <p className="text-xs text-brand-ink/40 mt-1">Recommended: portrait/near-square crop, ~4:5 ratio.</p>
            {mobilePreview && (
              <button
                type="button"
                onClick={() => { setMobilePreview(''); setForm((f) => ({ ...f, mobileImage: '' })); }}
                className="text-xs text-brand-magenta mt-1"
              >
                Remove mobile image
              </button>
            )}
          </div>

          {editingId && (
            <p className="text-xs text-brand-ink/50">Click an image to replace it, or leave it as is.</p>
          )}

          <input placeholder="Title" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Subtitle" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <input placeholder="Link (e.g. /category/umbrella-kurtis)" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <input placeholder="Button text" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
          <input type="number" placeholder="Sort order" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />

          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>

          <button className="btn-primary text-sm" disabled={uploading || uploadingMobile}>
            {uploading || uploadingMobile ? 'Uploading…' : editingId ? 'Save Changes' : 'Create'}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {banners.map((b) => (
          <div key={b._id} className="card-soft overflow-hidden">
            <div className="flex gap-1 h-32">
              <img src={b.image} alt={b.title} className="flex-1 h-full object-cover" />
              {b.mobileImage && (
                <img src={b.mobileImage} alt={`${b.title} (mobile)`} className="w-16 h-full object-cover shrink-0" title="Mobile image" />
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{b.title || '(no title)'}</p>
                <p className="text-xs text-brand-ink/50">Order: {b.sortOrder}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={b.isActive} onChange={() => toggleActive(b)} /> Active
                </label>
                <button onClick={() => openEdit(b)} className="text-brand-ink/60 hover:text-brand-magenta"><Pencil size={16} /></button>
                <button onClick={() => remove(b._id)} className="text-brand-magenta"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}