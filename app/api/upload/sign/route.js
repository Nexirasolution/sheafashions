// Save as: app/api/upload/sign/route.js  (replaces the Cloudinary version)
// Admin-only. Returns a short-lived presigned URL so the browser can PUT a file
// straight into R2, skipping Vercel's 4.5 MB request limit.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { r2, R2_BUCKET, IMAGE_TYPES, VIDEO_TYPES, cleanFolder, makeKey, publicUrl } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'];

export const POST = requireAdmin(async (req) => {
  // Fail with a readable message (variable names only, never values) if setup is incomplete
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing environment variables: ${missing.join(', ')}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const contentType = String(body.contentType || '');
  const size = Number(body.size) || 0;

  const isImage = !!IMAGE_TYPES[contentType];
  const isVideo = !!VIDEO_TYPES[contentType];
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
  }
  if (size > (isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  try {
    const key = makeKey(cleanFolder(body.folder, 'reels'), contentType);
    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 } // 5 minutes
    );
    return NextResponse.json({ uploadUrl, publicUrl: publicUrl(key) });
  } catch (err) {
    console.error('Sign failed:', err);
    return NextResponse.json({ error: `Could not create upload link: ${err.message}` }, { status: 500 });
  }
});