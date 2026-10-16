import { NextResponse } from 'next/server';
// Same DB helper as your other API routes
import { dbConnect } from '@/lib/mongodb';
import Courier from '@/models/Courier';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// PUT /api/couriers/:id -> edit name / tracking link / default
export async function PUT(req, { params }) {
  // ⚠️ Add your admin-auth check here
  const { id } = await params;
  await dbConnect();
  const body = await req.json().catch(() => ({}));
  const update = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Courier name is required' }, { status: 400 });
    const clash = await Courier.findOne({ _id: { $ne: id }, name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    if (clash) return NextResponse.json({ error: `${name} is already saved` }, { status: 409 });
    update.name = name;
  }

  if (body.trackingUrl !== undefined) {
    const trackingUrl = String(body.trackingUrl).trim();
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      return NextResponse.json({ error: 'Tracking link must start with http:// or https://' }, { status: 400 });
    }
    update.trackingUrl = trackingUrl;
  }

  if (body.isDefault === true) {
    await Courier.updateMany({ _id: { $ne: id } }, { isDefault: false });
    update.isDefault = true;
  }

  const courier = await Courier.findByIdAndUpdate(id, update, { new: true });
  if (!courier) return NextResponse.json({ error: 'Courier not found' }, { status: 404 });
  return NextResponse.json({ courier });
}

// DELETE /api/couriers/:id
export async function DELETE(_req, { params }) {
  // ⚠️ Add your admin-auth check here
  const { id } = await params;
  await dbConnect();
  const removed = await Courier.findByIdAndDelete(id);
  if (!removed) return NextResponse.json({ error: 'Courier not found' }, { status: 404 });

  // keep one default if any couriers remain
  if (removed.isDefault) {
    const first = await Courier.findOne().sort({ name: 1 });
    if (first) await Courier.findByIdAndUpdate(first._id, { isDefault: true });
  }
  return NextResponse.json({ ok: true });
}