import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbConnect } from '@/lib/mongodb';
import PendingOrder from '@/models/PendingOrder';
import Order from '@/models/Order';
import { createOrderIdempotent } from '@/lib/orderService';

// Razorpay calls this directly from its own servers on payment.captured —
// independent of whether the customer's browser is still open. This is
// the safety net for "closed the tab right after paying".
export async function POST(req) {
  const rawBody = await req.text(); // must verify against the raw bytes, not re-serialized JSON
  const signature = req.headers.get('x-razorpay-signature');

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');

  if (!signature || expected !== signature) {
    console.error('Razorpay webhook: signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true }); // ack other event types, no action needed
  }

  try {
    await dbConnect();

    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;
    const razorpayPaymentId = payment?.id;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json({ error: 'Malformed webhook payload' }, { status: 400 });
    }

    const existing = await Order.findOne({ razorpayOrderId });
    if (existing) {
      // Client-side fast path already created it — nothing to do.
      await PendingOrder.deleteOne({ razorpayOrderId });
      return NextResponse.json({ received: true, alreadyExists: true });
    }

    const pending = await PendingOrder.findOne({ razorpayOrderId });
    if (!pending) {
      console.error(`Webhook: payment captured for ${razorpayOrderId} but no PendingOrder found — reconcile manually`);
      return NextResponse.json({ error: 'No pending order found for this payment' }, { status: 404 });
    }

    await createOrderIdempotent(
      {
        items: pending.items,
        customer: pending.customer,
        shippingAddress: pending.shippingAddress,
        couponCode: pending.couponCode,
        paymentMethod: 'razorpay',
        razorpayOrderId,
        razorpayPaymentId
      },
      { skipSignatureVerification: true } // this request is already authenticated above
    );

    await PendingOrder.deleteOne({ razorpayOrderId });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook order creation failed:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}