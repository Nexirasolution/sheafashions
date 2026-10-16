// Save as: app/api/upload/route.js  (replaces the Cloudinary version)
// Small server-side uploads (e.g. customer review photos). Same request and
// response shape as before: POST multipart { file, folder } -> { url }.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { r2, R2_BUCKET, IMAGE_TYPES, VIDEO_TYPES, cleanFolder, makeKey, publicUrl } from '@/lib/r2';

export const runtime = 'nodejs';

// Vercel rejects request bodies over 4.5 MB before this code runs.
// Bigger files go through /api/upload/sign (direct upload) instead.
const MAX_BYTES = 4 * 1024 * 1024;

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

    const folder = cleanFolder(formData.get('folder'));

    if (!IMAGE_TYPES[file.type] && !VIDEO_TYPES[file.type]) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const key = makeKey(folder, file.type);
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return NextResponse.json({ url: publicUrl(key) });
  } catch (err) {
    console.error('Upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}