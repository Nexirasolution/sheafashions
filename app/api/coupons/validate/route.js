// app/api/coupons/validate/route.js  (FULL FILE)
// POST { code, items, state }
// The subtotal is computed on the server from the cart items; a client-sent
// subtotal is no longer trusted.
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { buildOrderItemsAndTotals, OrderError } from '@/lib/orderCalc';
import { evaluateCoupon } from '@/lib/coupon';

export async function POST(req) {
  try {
    await dbConnect();
    const { code, items, state } = await req.json();

    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ valid: false, message: 'Your cart is empty' });
    }

    const { subtotal } = await buildOrderItemsAndTotals(items, '', state || '', {
      allowUndeliverable: true
    });

    return NextResponse.json(await evaluateCoupon(code, subtotal));
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ valid: false, message: err.message });
    }
    console.error('Coupon validate failed:', err);
    return NextResponse.json({ valid: false, message: 'Could not apply coupon, please try again' });
  }
}