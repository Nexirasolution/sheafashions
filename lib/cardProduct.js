// ProductCard is a client component, so every field passed to it is serialized
// into the page HTML. The card only needs the first variant and its first
// image, so we send just that instead of the whole product document.
export function toCardProduct(p) {
  const v = p.variants?.[0];
  return {
    _id: String(p._id),
    slug: p.slug,
    name: p.name,
    basePrice: p.basePrice,
    variants: v ? [{ ...v, images: v.images?.slice(0, 1) }] : [],
  };
}