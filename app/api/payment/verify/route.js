import { NextResponse } from 'next/server';
import crypto from 'crypto';

// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export async function POST(req) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');
  const valid = expected === razorpay_signature;
  return NextResponse.json({ valid });
}
