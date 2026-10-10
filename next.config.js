const r2Host =
  (process.env.R2_PUBLIC_URL && new URL(process.env.R2_PUBLIC_URL).hostname) ||
  'pub-47db167c837a4fb5bfb5f6293791c0d2.r2.dev';

// Cloudinary delivers from res.cloudinary.com/<cloud_name>/...
// Set CLOUDINARY_CLOUD_NAME (Vercel + .env.local) to lock the pattern to your account.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: cloudName ? `/${cloudName}/**` : '/**',
      },
      // Old uploads still stored on R2. Remove once all images are migrated.
      { protocol: 'https', hostname: r2Host },
    ],

    // WebP only: AVIF is much more CPU-heavy to encode
    formats: ['image/webp'],

    // Fewer sizes = fewer generated variants = fewer transformations
    deviceSizes: [640, 828, 1200],
    imageSizes: [64, 128, 256],

    // Qualities used in the code: 75 (main images) and 50 (thumbnails)
    qualities: [50, 75],

    // Cache optimized images for 1 year (default is 60s)
    minimumCacheTTL: 31536000,
  },

  eslint: { ignoreDuringBuilds: true },

  // Cache static files in /public aggressively
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|gif|ico|woff2)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;