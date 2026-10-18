import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { dbConnect } from '@/lib/mongodb';
import Reel from '@/models/Reel';
import { requireAdmin } from '@/lib/apiAuth';

// `await params` works on Next 14 and 15 (params is a promise in 15)
export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const { id } = await params;
  const body = await req.json();
  const reel = await Reel.findByIdAndUpdate(id, body, { new: true });
  revalidatePath('/');
  return NextResponse.json({ reel });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const { id } = await params;
  await Reel.findByIdAndDelete(id);
  revalidatePath('/');
  return NextResponse.json({ success: true });
});