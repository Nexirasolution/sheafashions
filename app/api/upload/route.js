import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// SVG is deliberately NOT allowed: it can carry scripts.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

// Vercel rejects request bodies over 4.5 MB before this code runs.
// Larger files need a direct-to-Cloudinary (signed) upload instead.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;

const MAX_IMAGE_WIDTH = 1600;

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)))
      .end(buffer);
  });
}

export async function POST(req) {
  // TODO (recommended): if only admins should upload, verify the lb_admin_token
  // cookie here the same way app/admin/layout.js does, and return 401 if invalid.
  // If review photos must stay public, add a Vercel Firewall rate-limit rule on /api/upload.

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    // Flat folder names only (no slashes or "..")
    const rawFolder = String(formData.get('folder') || 'uploads');
    const folder = /^[a-z0-9_-]{1,40}$/i.test(rawFolder) ? rawFolder : 'uploads';

    const isImage = IMAGE_TYPES.has(file.type);
    const isVideo = VIDEO_TYPES.has(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const options = {
      folder,
      public_id: randomUUID(), // unique name, never taken from the user's file name
      resource_type: isImage ? 'image' : 'video',
      overwrite: false,
      unique_filename: false,
    };

    if (isImage) {
      // Incoming transformation: applied once at upload, and the result is what gets stored.
      options.transformation = [
        { angle: 'exif' }, // apply phone EXIF orientation
        { width: MAX_IMAGE_WIDTH, crop: 'limit' }, // downscale only, never enlarge
        { quality: 'auto', fetch_format: 'webp' },
      ];
    }

    const result = await uploadBuffer(buffer, options);

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error('Upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}