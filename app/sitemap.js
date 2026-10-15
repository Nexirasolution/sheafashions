import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';

// Regenerate at most once per hour (ISR) so bots hitting /sitemap.xml don't trigger a DB query each time
export const revalidate = 3600;

export default async function sitemap() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sheafashions.in').replace(/\/+$/, '');
  let products = [];
  let categories = [];

  try {
    await dbConnect();
    [products, categories] = await Promise.all([
      Product.find({ isActive: true, slug: { $exists: true, $ne: '' } })
        .select('slug updatedAt')
        .sort({ updatedAt: -1 })
        .lean(),
      Category.find({ isActive: true, slug: { $exists: true, $ne: '' } })
        .select('slug updatedAt')
        .sort({ updatedAt: -1 })
        .lean(),
    ]);
  } catch (err) {
    console.error('Sitemap: failed to load products/categories', err);
  }

  const toDate = (d) => (d ? new Date(d) : undefined);

  // Only pages you want indexed (cart/checkout are disallowed in robots.js).
  // Add other public pages here, e.g. `${siteUrl}/about`, `${siteUrl}/contact`.
  const staticRoutes = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  const categoryRoutes = categories.map((c) => ({
    url: `${siteUrl}/category/${encodeURIComponent(c.slug)}`,
    lastModified: toDate(c.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const productRoutes = products.map((p) => ({
    url: `${siteUrl}/product/${encodeURIComponent(p.slug)}`,
    lastModified: toDate(p.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}