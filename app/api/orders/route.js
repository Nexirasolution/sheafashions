import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import PendingOrder from '@/models/PendingOrder';
import { requireAdmin } from '@/lib/apiAuth';
import { createOrderIdempotent } from '@/lib/orderService';
import { OrderError } from '@/lib/orderCalc';

const MAX_LIMIT = 5000;

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

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  // `from` / `to` are ISO timestamps (the client converts the admin's local
  // day boundaries), so the server's timezone doesn't matter.
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));

  const query = {};
  if (status) query.status = status;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { orderNumber: { $regex: escaped, $options: 'i' } },
      { 'customer.name': { $regex: escaped, $options: 'i' } },
      { 'customer.phone': { $regex: escaped, $options: 'i' } }
    ];
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;
  }

  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') || 20)), MAX_LIMIT);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(query)
  ]);
  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
});