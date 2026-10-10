import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import PendingOrder from '@/models/PendingOrder';
import { requireAdmin } from '@/lib/apiAuth';
import { createOrderIdempotent } from '@/lib/orderService';
import { OrderError } from '@/lib/orderCalc';

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();

    const { order, created } = await createOrderIdempotent(body);

    // Clean up the pending record either way — if the webhook already
    // consumed it, this is a harmless no-op.
    if (body.razorpayOrderId) {
      await PendingOrder.deleteOne({ razorpayOrderId: body.razorpayOrderId });
    }

    return NextResponse.json({ order }, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Order creation failed:', err);
    return NextResponse.json(
      { error: 'Could not create order. If you were charged, contact support with your payment ID.' },
      { status: 500 }
    );
  }
}

export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { 'customer.phone': { $regex: search, $options: 'i' } }
    ];
  }
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 20);
  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(query)
  ]);
  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
});