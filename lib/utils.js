export function formatINR(n) {
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
  return `Rs. ${formatted}`;
}

export function genOrderNumber() {
  const d = new Date();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MT${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${rand}`;
}

export function genCouponCheck(code) {
  return (code || '').trim().toUpperCase();
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}