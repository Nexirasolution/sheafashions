import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'lb_admin_token';

// No hardcoded fallback in production: a missing secret must fail loudly,
// otherwise anyone who knows the fallback string can forge an admin cookie.
// Read lazily (not at import time) so `next build` doesn't need the secret.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Refusing to sign or verify admin tokens.');
  }
  return 'dev_secret_change_me'; // local development only
}

export function signAdminToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d', algorithm: 'HS256' });
}

export function verifyAdminToken(token) {
  const secret = getSecret(); // outside try/catch so a missing secret isn't hidden as "invalid token"
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export function getAdminFromRequest(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export function setAdminCookie(res, token) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearAdminCookie(res) {
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export const COOKIE = COOKIE_NAME;