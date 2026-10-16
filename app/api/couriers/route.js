import { NextResponse } from 'next/server';
// Same DB helper as your other API routes
import { dbConnect } from '@/lib/mongodb';
import Courier from '@/models/Courier';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/couriers  -> all saved couriers (default first)
export async function GET() {
  await dbConnect();
  const couriers = await Courier.find().sort({ isDefault: -1, name: 1 }).lean();
  return NextResponse.json({ couriers });
}

// POST /api/couriers -> add a courier
export async function POST(req) {
  // ⚠️ Add the same admin-auth check you use in your other admin routes here.
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const trackingUrl = String(body.trackingUrl || '').trim();

  if (!name) return NextResponse.json({ error: 'Courier name is required' }, { status: 400 });
  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
    return NextResponse.json({ error: 'Tracking link must start with http:// or https://' }, { status: 400 });
  }

  const exists = await Courier.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (exists) return NextResponse.json({ error: `${name} is already saved` }, { status: 409 });

  const count = await Courier.countDocuments();
  const isDefault = !!body.isDefault || count === 0; // first courier becomes the default
  if (isDefault) await Courier.updateMany({}, { isDefault: false });

  const courier = await Courier.create({ name, trackingUrl, isDefault });
  return NextResponse.json({ courier }, { status: 201 });
}