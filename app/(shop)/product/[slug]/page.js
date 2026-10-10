import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getProductPageData } from '@/lib/products';
import { toCardProduct } from '@/lib/cardProduct';
import ProductClient from './ProductClient';

// ISR: served from the CDN, regenerated in the background at most every 10 minutes.
// (Was 60s, which re-ran the DB queries up to 1,440 times a day per product.)
// For instant updates, call revalidatePath(`/product/${slug}`) when admin saves a product.
export const revalidate = 600;

// generateMetadata() and the page both need the same data. cache() makes the
// DB queries run once per render instead of twice.
const getData = cache(getProductPageData);

export async function generateMetadata({ params }) {
  const { slug } = await params; // on Next 14 use: const { slug } = params;
  const data = await getData(slug);
  if (!data?.product) return {};
  const firstImage = data.product.variants?.[0]?.images?.[0];
  return {
    title: data.product.name,
    description: data.product.description?.slice(0, 160),
    openGraph: { images: firstImage ? [firstImage] : [] },
  };
}

export default async function Page({ params }) {
  const { slug } = await params; // on Next 14 use: const { slug } = params;
  const data = await getData(slug);
  if (!data?.product) notFound();

  // Related products only need the card fields. Everything passed to a client
  // component is serialized into the page HTML, so send less.
  const trimmed = { ...data, related: (data.related || []).map(toCardProduct) };

  return <ProductClient data={trimmed} />;
}