// OPTIONAL custom image loader: only enable it (see next.config.js) if your
// product images are hosted on Cloudinary. Cloudinary resizes them, so Vercel
// Image Optimization is not used at all for those images.
export default function imageLoader({ src, width, quality }) {
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    return src.replace('/upload/', `/upload/f_auto,q_${quality || 'auto'},w_${width}/`);
  }
  // Local files (e.g. /logo.png) and other hosts are served as-is.
  // Keep those files small, because they are not resized by this loader.
  return src;
}