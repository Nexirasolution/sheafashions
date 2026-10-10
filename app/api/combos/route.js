export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Combo from '@/models/Combo';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';
import { sanitizeFreeShipping } from '@/lib/freeShipping';

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');
  const query = all ? {} : { isActive: true };
  const combos = await Combo.find(query)
    // weight is included so shipping can use each product's manual weight
    .populate('products.product', 'name slug variants weight')
    .populate('baseProduct', 'name slug variants weight')
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({ combos });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();

  if (!body.name) {
    return NextResponse.json({ error: 'Combo name is required' }, { status: 400 });
  }

  if (body.type === 'color-pack') {
    if (!body.baseProduct) {
      return NextResponse.json({ error: 'A base product is required for a color-pack combo' }, { status: 400 });
    }
    if (!Array.isArray(body.colors) || body.colors.length === 0) {
      return NextResponse.json({ error: 'Add at least one color' }, { status: 400 });
    }
    if (!Array.isArray(body.packOptions) || body.packOptions.length === 0) {
      return NextResponse.json({ error: 'Add at least one pack size option' }, { status: 400 });
    }
  } else if (!body.comboPrice) {
    return NextResponse.json({ error: 'Combo price is required' }, { status: 400 });
  }

  try {
    const slug = slugify(body.name, { lower: true }) + '-' + Date.now().toString().slice(-4);
    // Manual weights (grams), never negative
    const weight = Math.max(0, Number(body.weight) || 0);
    const pieceWeight = Math.max(0, Number(body.pieceWeight) || 0);
    sanitizeFreeShipping(body);
    const combo = await Combo.create({ ...body, slug, weight, pieceWeight });
    return NextResponse.json({ combo }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to create combo' }, { status: 400 });
  }
});