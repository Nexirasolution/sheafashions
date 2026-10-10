import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';

// Regenerate at most once per hour (ISR) so bots hitting /sitemap.xml don't trigger a DB query each time
export const revalidate = 3600;

export default async function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tirupurclothinghub.com';
  let products = [];
  let categories = [];

  try {
    await dbConnect();
    [products, categories] = await Promise.all([
      Product.find({ isActive: true }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);
  } catch {}

  // Only pages you want indexed (cart/checkout are disallowed in robots.js)
  const staticRoutes = [{ url: siteUrl }];

  const categoryRoutes = categories.map((c) => ({
    url: `${siteUrl}/category/${c.slug}`,
    lastModified: c.updatedAt || undefined,
  }));

  const productRoutes = products.map((p) => ({
    url: `${siteUrl}/product/${p.slug}`,
    lastModified: p.updatedAt || undefined,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}