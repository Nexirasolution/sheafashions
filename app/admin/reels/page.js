'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Upload, Loader2, Video } from 'lucide-react';

const emptyForm = { title: '', videoUrl: '', thumbnail: '', instagramLink: '', product: '', sortOrder: 0 };

const MAX_VIDEO_MB = 100; // Cloudinary free plan limit for videos
const MAX_IMAGE_MB = 4;   // /api/upload limit (Vercel body limit)

// Read a response as JSON without crashing when the server sends plain text
// (Vercel returns text like "Request Entity Too Large" for oversized bodies).
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// Videos go straight from the browser to Cloudinary using a signature from
// /api/upload/sign, so they are not limited by Vercel's 4.5 MB request cap.
function uploadVideoDirect(file, folder, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      const sign = await safeJson(signRes);
      if (!signRes.ok) throw new Error(sign.error || 'Could not start upload (are you logged in as admin?)');

      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sign.apiKey);
      fd.append('timestamp', sign.timestamp);
      fd.append('signature', sign.signature);
      fd.append('folder', sign.folder);
      fd.append('public_id', sign.public_id);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
        else reject(new Error(data.error?.message || 'Video upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error while uploading video'));
      xhr.send(fd);
    } catch (err) {
      reject(err);
    }
  });
}

async function uploadImageViaApi(file, folder) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await safeJson(res);
  if (res.status === 413) throw new Error(`Image is too large (max ${MAX_IMAGE_MB} MB)`);
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

function UploadSlot({ value, accept, folder, placeholder, icon: Icon, preview: PreviewComp, isVideo, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again after an error
    if (!file) return;

    const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > limitMb * 1024 * 1024) {
      toast.error(`File is too large (max ${limitMb} MB)`);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const url = isVideo
        ? await uploadVideoDirect(file, folder, setProgress)
        : await uploadImageViaApi(file, folder);
      onChange(url);
      toast.success('Uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      {/* Click area */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-magenta transition-colors overflow-hidden relative bg-brand-cream/40"
      >
        {value ? (
          PreviewComp ? <PreviewComp url={value} /> : <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-brand-ink/40 text-xs">
            <Icon size={22} />
            <span>{placeholder}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-1">
            <Loader2 size={22} className="animate-spin text-brand-magenta" />
            {isVideo && <span className="text-xs text-brand-ink/70">{progress}%</span>}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />

      {/* Manual URL fallback */}
      <input
        placeholder={`Or paste URL — ${placeholder}`}
        className="w-full border rounded-lg px-3 py-2 text-xs text-brand-ink/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function VideoPreview({ url }) {
  return (
    <video src={url} className="w-full h-full object-cover" muted playsInline
      onMouseEnter={(e) => e.target.play()} onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
    />
  );
}

export default function AdminReelsPage() {
  const [reels, setReels] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [r1, r2] = await Promise.all([fetch('/api/reels?all=true'), fetch('/api/products?limit=200')]);
    setReels((await r1.json()).reels || []);
    setProducts((await r2.json()).products || []);
  }
  useEffect(() => { load(); }, []);

  function closeForm() { setShowForm(false); setForm(emptyForm); }

  async function submit(e) {
    e.preventDefault();
    if (!form.videoUrl) { toast.error('Please upload a video'); return; }
    setSaving(true);
    try {
      const payload = { ...form, product: form.product || null };
      const res = await fetch('/api/reels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        toast.success('Reel added');
        closeForm();
        load();
      } else {
        const data = await safeJson(res);
        toast.error(data.error || 'Could not save reel');
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this reel?')) return;
    await fetch(`/api/reels/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold text-brand-magenta">Shop by Reels</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> Add Reel
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-soft p-5 mb-6 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">New Reel</h2>
            <button type="button" onClick={closeForm}><X size={18} /></button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-brand-ink/60 mb-1">Video * (.mp4, .mov, up to {MAX_VIDEO_MB} MB)</p>
              <UploadSlot
                value={form.videoUrl}
                accept="video/*"
                folder="reels-videos"
                placeholder="Click to upload video"
                icon={Video}
                preview={VideoPreview}
                isVideo
                onChange={(url) => setForm((f) => ({ ...f, videoUrl: url }))}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-brand-ink/60 mb-1">Thumbnail image (up to {MAX_IMAGE_MB} MB)</p>
              <UploadSlot
                value={form.thumbnail}
                accept="image/*"
                folder="reels-thumbnails"
                placeholder="Click to upload thumbnail"
                icon={Upload}
                onChange={(url) => setForm((f) => ({ ...f, thumbnail: url }))}
              />
            </div>
          </div>

          <input
            placeholder="Instagram reel link"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.instagramLink}
            onChange={(e) => setForm({ ...form, instagramLink: e.target.value })}
          />
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.product}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
          >
            <option value="">Link to product (optional)</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>

          <button disabled={saving} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Saving...' : 'Create'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {reels.map((r) => (
          <div key={r._id} className="card-soft overflow-hidden">
            <div className="aspect-[9/16] bg-brand-cream overflow-hidden">
              {r.thumbnail
                ? <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover" />
                : r.videoUrl
                  ? <video src={r.videoUrl} className="w-full h-full object-cover" muted playsInline
                      onMouseEnter={(e) => e.target.play()} onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }} />
                  : null
              }
            </div>
            <div className="p-2 flex items-center justify-between">
              <p className="text-xs line-clamp-1">{r.product?.name || r.title || 'Reel'}</p>
              <button onClick={() => remove(r._id)} className="text-brand-magenta"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}