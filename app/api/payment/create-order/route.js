import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import { getRazorpay } from '@/lib/razorpay';
import PendingOrder from '@/models/PendingOrder';
import { buildOrderItemsAndTotals, OrderError } from '@/lib/orderCalc';
import { INDIAN_STATES } from '@/lib/indianStates';

// POST { items, customer, shippingAddress, couponCode, expectedTotal }
// Recomputes pricing server-side (never trusts a client-sent amount),
// stashes the full order payload so the webhook can build the order
// even if the customer's browser never calls back, then creates the
// Razorpay order for the verified total.
//
// `expectedTotal` is only compared against the server total so a mismatch
// is caught before the Razorpay popup opens.
export async function POST(req) {
  try {
    await dbConnect();
    const { items, customer, shippingAddress, couponCode, expectedTotal } = await req.json();

    if (!items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    if (!customer?.name || !customer?.phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }
    if (!shippingAddress?.state || !INDIAN_STATES.includes(shippingAddress.state)) {
      return NextResponse.json({ error: 'Please select a valid delivery state' }, { status: 400 });
    }

    const { subtotal, discount, shippingFee, total } = await buildOrderItemsAndTotals(
      items,
      couponCode,
      shippingAddress.state
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('CREATE-ORDER DEBUG', {
        subtotal,
        discount,
        shippingFee,
        total,
        state: shippingAddress.state,
        amountInPaise: Math.round(total * 100),
        expectedTotal
      });
    }

    // Guard: the page showed one total, the server computed another.
    if (expectedTotal !== undefined && expectedTotal !== null) {
      if (Math.abs(total - Number(expectedTotal)) > 1) {
        return NextResponse.json(
          { error: 'Prices or shipping changed. Please review your total and try again.' },
          { status: 409 }
        );
      }
    }

    // Razorpay minimum is ₹1 (100 paise). A tiny/zero total means pricing is broken.
    if (!Number.isFinite(total) || total < 1) {
      console.error('Invalid order total computed:', { subtotal, discount, shippingFee, total });
      return NextResponse.json({ error: 'Could not calculate order total' }, { status: 500 });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return NextResponse.json(
        { error: 'Payment gateway is not configured. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env' },
        { status: 500 }
      );
    }

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    });

    await PendingOrder.create({
      razorpayOrderId: rzpOrder.id,
      items,
      customer,
      shippingAddress,
      couponCode: couponCode || ''
    });

    return NextResponse.json({ order: rzpOrder, keyId: process.env.RAZORPAY_KEY_ID, total });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Create Razorpay order failed:', err);
    return NextResponse.json({ error: 'Could not start payment' }, { status: 500 });
  }
}