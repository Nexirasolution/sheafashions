export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/categories
// Returns:
//   categories — the flat, sorted list (unchanged shape, used by the admin
//                 category dropdown/select and anywhere else that just
//                 needs every category regardless of hierarchy)
//   topLevel   — only the main (parent-less) categories, each with a
//                 `subcategories` array attached. This is what the navbar
//                 should fetch to render "Main Category -> Subcategory" menus.
export async function GET() {
  await dbConnect();
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });

  const byParent = {};
  for (const c of categories) {
    const key = c.parent ? String(c.parent) : 'root';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(c);
  }

  const topLevel = (byParent.root || []).map((c) => ({
    ...c.toObject(),
    subcategories: byParent[String(c._id)] || [],
  }));

  return NextResponse.json({ categories, topLevel });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
  const slug = body.slug ? slugify(body.slug, { lower: true }) : slugify(body.name, { lower: true });
  const exists = await Category.findOne({ slug });
  if (exists) return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 });

  // `parent` should be a category id or null/omitted for a main category.
  // No extra validation of "only one level deep" is enforced server-side —
  // the admin UI only offers top-level categories as parent options, which
  // keeps the hierarchy to two levels in practice.
  const category = await Category.create({ ...body, slug, parent: body.parent || null });
  return NextResponse.json({ category }, { status: 201 });
});