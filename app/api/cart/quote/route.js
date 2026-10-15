// app/api/cart/quote/route.js  (NEW FILE)
// Server-side quote. Uses the SAME function that sets the Razorpay amount,
// so the total shown on the page can never differ from what is charged.
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { buildOrderItemsAndTotals, OrderError } from '@/lib/orderCalc';

export async function POST(req) {
  try {
    await dbConnect();
    const { items, couponCode, state } = await req.json();

    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const r = await buildOrderItemsAndTotals(items, couponCode || '', state || '', {
      allowUndeliverable: true
    });

    return NextResponse.json({
      subtotal: r.subtotal,
      discount: r.discount,
      appliedCoupon: r.appliedCoupon,
      shippingFee: r.shippingFee,
      total: r.total,
      deliverable: r.deliverable,
      shippingState: r.shippingState,
      freeShippingAbove: r.freeShippingAbove,
      lines: r.linePrices,
      skipped: r.skippedIndexes
    });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Cart quote failed:', err);
    return NextResponse.json({ error: 'Could not calculate your total' }, { status: 500 });
  }
}