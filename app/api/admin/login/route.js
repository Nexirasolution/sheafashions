import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/mongodb';
import Admin from '@/models/Admin';
import { signAdminToken, setAdminCookie } from '@/lib/auth';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Compared against when the email doesn't exist, so "no such account" and
// "wrong password" take the same time and can't be told apart.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const fail = () => NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, password } = body || {};
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email ||
    !password ||
    email.length > 200 ||
    password.length > 200
  ) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  await dbConnect();
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

  // Always run bcrypt, whether or not the account exists.
  const ok = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);

  if (!admin) return fail();

  // Locked accounts get the same answer for right and wrong passwords.
  if (admin.lockUntil && admin.lockUntil > new Date()) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  if (!ok) {
    // Atomic counter in the database, so it works across serverless instances.
    const updated = await Admin.findByIdAndUpdate(
      admin._id,
      { $inc: { failedAttempts: 1 } },
      { new: true }
    );
    if (updated && updated.failedAttempts >= MAX_ATTEMPTS) {
      await Admin.updateOne(
        { _id: admin._id },
        { $set: { lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000), failedAttempts: 0 } }
      );
    }
    return fail();
  }

  if (admin.failedAttempts || admin.lockUntil) {
    await Admin.updateOne({ _id: admin._id }, { $set: { failedAttempts: 0, lockUntil: null } });
  }

  const token = signAdminToken({ id: admin._id.toString(), email: admin.email, role: admin.role });
  const res = NextResponse.json({ admin: { name: admin.name, email: admin.email, role: admin.role } });
  setAdminCookie(res, token);
  return res;
}