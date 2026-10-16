// Save as: lib/r2.js
// Shared Cloudflare R2 client (S3-compatible).
import { S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Accepts either R2_BUCKET or R2_BUCKET_NAME
export const R2_BUCKET = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'];

// Names (never values) of any R2 settings that are missing
export function missingR2Env() {
  return REQUIRED_ENV.filter((k) => !(k === 'R2_BUCKET' ? R2_BUCKET : process.env[k]));
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // Newer AWS SDK versions add checksum headers that R2 browser uploads reject.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// SVG is deliberately NOT allowed: it can carry scripts.
export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

// Flat folder names only (no slashes or "..")
export function cleanFolder(raw, fallback = 'uploads') {
  const f = String(raw || fallback);
  return /^[a-z0-9_-]{1,40}$/i.test(f) ? f : fallback;
}

// Unique key, never taken from the user's file name
export function makeKey(folder, contentType) {
  const ext = IMAGE_TYPES[contentType] || VIDEO_TYPES[contentType];
  return `${folder}/${randomUUID()}.${ext}`;
}

export function publicUrl(key) {
  return `${String(process.env.R2_PUBLIC_URL).replace(/\/+$/, '')}/${key}`;
}