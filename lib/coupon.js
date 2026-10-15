// lib/coupon.js  (NEW FILE)
// One coupon evaluator used by BOTH /api/coupons/validate and orderCalc,
// so the discount shown to the customer is exactly what the server charges.
import Coupon from '@/models/Coupon';
import { genCouponCheck } from '@/lib/utils';

const no = (message) => ({ valid: false, discount: 0, code: '', message });

export async function evaluateCoupon(code, subtotal) {
  const raw = String(code || '').trim();
  if (!raw) return no('Enter a coupon code');

  const coupon = await Coupon.findOne({ code: genCouponCheck(raw), isActive: true });
  if (!coupon) return no('Invalid coupon code');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return no('This coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return no('This coupon has reached its usage limit');
  }
  if (subtotal < (coupon.minOrderValue || 0)) {
    return no(`Minimum order value is ₹${coupon.minOrderValue}`);
  }

  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(Math.round(discount), Math.round(subtotal)); // rounded once, never above subtotal

  return { valid: true, discount, code: coupon.code, message: 'Coupon applied!' };
}