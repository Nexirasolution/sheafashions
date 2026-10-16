// Save as: app/api/upload/sign/route.js
import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Returns a short-lived signature so the browser can upload a video straight to
// Cloudinary. This skips Vercel's 4.5 MB request limit. Only admins can call it.
export const POST = requireAdmin(async (req) => {
  const body = await req.json().catch(() => ({}));

  // Flat folder names only, same rule as /api/upload
  const rawFolder = String(body.folder || 'reels');
  const folder = /^[a-z0-9_-]{1,40}$/i.test(rawFolder) ? rawFolder : 'reels';

  const timestamp = Math.round(Date.now() / 1000);
  const public_id = randomUUID();

  // Every param sent to Cloudinary (except file, api_key, resource_type) must be signed
  const signature = cloudinary.utils.api_sign_request(
    { folder, public_id, timestamp },
    process.env.CLOUDINARY_API_SECRET
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    public_id,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
});