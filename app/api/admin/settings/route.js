// app/api/admin/settings/route.js  (FULL FILE)
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { requireAdmin } from '@/lib/apiAuth';
import { calculateShipping } from '@/lib/shipping';
import { computeCartWeight } from '@/lib/cartWeight';

const numOrNull = (v) =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

// Cleans the state rules coming from the admin form: trims names, drops
// blanks, de-duplicates (last one wins), converts empty inputs to null.
function sanitizeStateShipping(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const r of list) {
    const state = String(r?.state || '').trim();
    if (!state) continue;
    map.set(state.toLowerCase(), {
      state,
      enabled: r.enabled !== false,
      pricePerKg: numOrNull(r.pricePerKg),
      defaultShippingCharge: numOrNull(r.defaultShippingCharge),
      freeShippingAbove: numOrNull(r.freeShippingAbove)
    });
  }
  return [...map.values()];
}

export async function GET() {
  await dbConnect();
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) settings = await Settings.create({ key: 'global' });
  return NextResponse.json({ settings });
}

export const PUT = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if ('stateShipping' in body) body.stateShipping = sanitizeStateShipping(body.stateShipping);
  const settings = await Settings.findOneAndUpdate({ key: 'global' }, body, { new: true, upsert: true });
  return NextResponse.json({ settings });
});

// POST /api/admin/settings — used by checkout to calculate shipping.
// Body: { subtotal, totalQty, state, items }
//   subtotal — cart subtotal in ₹ (after discount), for the free-shipping threshold.
//   totalQty — total physical pieces in the cart (used only when `items` is not sent).
//   state    — customer's delivery state: state-wise rates / blocking / per-product free shipping.
//   items    — cart lines; weight is computed server-side from product/combo weights.
//              Products with free shipping (for this state) are left out of the weight.
export async function POST(req) {
  try {
    const { subtotal, totalQty, state, items } = await req.json();

    await dbConnect();
    const settings = await Settings.findOne({ key: 'global' }).lean();
    if (!settings) {
      return NextResponse.json({ error: 'Settings not configured' }, { status: 500 });
    }

    let totalWeightGrams = 0;
    let shippablePieces = Number(totalQty) || 0;
    let allItemsFree = false;

    if (Array.isArray(items) && items.length) {
      const result = await computeCartWeight(items, Number(settings.weightPerPiece) || 0, state);
      totalWeightGrams = result.totalGrams;
      shippablePieces = result.totalPieces; // paid pieces only
      allItemsFree = result.allFree;
    }

    return NextResponse.json(
      calculateShipping(settings, {
        subtotal,
        totalQty: shippablePieces,
        totalWeightGrams,
        state,
        allItemsFree
      })
    );
  } catch (err) {
    console.error('Shipping calculate error:', err);
    return NextResponse.json({ error: 'Could not calculate shipping' }, { status: 500 });
  }
}