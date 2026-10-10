import { unstable_cache } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';

// One cached query for the navbar menu, shared by every page and every visitor.
// Cached for 1 hour; call revalidateTag('categories') when admin edits categories.
const loadNavCategories = unstable_cache(
  async () => {
    await dbConnect();
    const all = await Category.find({ isActive: true })
      .select('name slug parent')
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const subsByParent = {};
    for (const c of all) {
      if (c.parent) {
        (subsByParent[String(c.parent)] ||= []).push({
          _id: String(c._id),
          name: c.name,
          slug: c.slug,
        });
      }
    }

    // Plain strings only, so the result can be passed to a client component
    return all
      .filter((c) => !c.parent)
      .map((c) => ({
        _id: String(c._id),
        name: c.name,
        slug: c.slug,
        subcategories: subsByParent[String(c._id)] || [],
      }));
  },
  ['nav-categories'],
  { revalidate: 3600, tags: ['categories'] }
);

// Errors are handled outside the cache so a failed DB call is never cached
export async function getNavCategories() {
  try {
    return await loadNavCategories();
  } catch {
    return [];
  }
}