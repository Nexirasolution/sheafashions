// Shared by the admin dashboard AND the AI cofounder tools, so the numbers
// can never disagree. Change a rule here and both update.

export const TZ = 'Asia/Kolkata';
export const DAY_MS = 86400000;
const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+5:30, India has no daylight saving

// A "real sale" = not cancelled/returned, and payment not failed/refunded.
// COD orders stay paymentStatus "pending" until collected, so they still count.
export const VALID_SALE = {
  status: { $nin: ['cancelled', 'returned'] },
  paymentStatus: { $nin: ['failed', 'refunded'] }
};

// Same rule as an aggregation expression (for use inside $group / $cond).
export const validExpr = {
  $and: [
    { $not: [{ $in: ['$status', ['cancelled', 'returned']] }] },
    { $not: [{ $in: ['$paymentStatus', ['failed', 'refunded']] }] }
  ]
};

// "2026-10-01" is treated as midnight India time, not UTC.
export function istDate(str) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T00:00:00+05:30` : str);
}

// The instant when the given day started in India (default: today).
export function startOfDayIST(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

// "YYYY-MM-DD" for a date, as seen in India.
export function istDateKey(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}