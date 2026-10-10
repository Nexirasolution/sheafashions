import crypto from 'crypto';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import Coupon from '@/models/Coupon';
import { genOrderNumber } from '@/lib/utils';
import { buildOrderItemsAndTotals, OrderError } from '@/lib/orderCalc';
import { INDIAN_STATES } from '@/lib/indianStates';

// Shared by both the client-side "fast path" (/api/orders) and the
// Razorpay webhook. Idempotent on razorpayOrderId — whichever caller
// runs first creates the order; the other gets the existing one back.
//
// opts.skipSignatureVerification: true when called from the webhook,
// which is already authenticated via the webhook's own HMAC signature.
export async function createOrderIdempotent(payload, opts = {}) {
  const {
    items, customer, shippingAddress, couponCode, paymentMethod,
    razorpayOrderId, razorpayPaymentId, razorpaySignature
  } = payload;

  if (!items?.length) throw new OrderError('Cart is empty');
  if (!customer?.name || !customer?.phone) throw new OrderError('Name and phone are required');

  if (razorpayOrderId) {
    const existing = await Order.findOne({ razorpayOrderId });
    if (existing) return { order: existing, created: false };
  }

  if (paymentMethod === 'razorpay') {
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new OrderError('Missing Razorpay payment identifiers');
    }
    if (!opts.skipSignatureVerification) {
      if (!razorpaySignature) throw new OrderError('Missing payment verification data');
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (expected !== razorpaySignature) throw new OrderError('Payment verification failed');
    }
  }

  // State is needed for state-wise shipping. Checked AFTER payment/idempotency
  // handling above so an already-paid order is never rejected by this.
  if (!shippingAddress?.state || !INDIAN_STATES.includes(shippingAddress.state)) {
    throw new OrderError('Please select a valid delivery state');
  }

  const { orderItems, stockUpdateItems, subtotal, discount, appliedCoupon, shippingFee, total } =
    await buildOrderItemsAndTotals(items, couponCode, shippingAddress.state);

  let order;
  try {
    order = await Order.create({
      orderNumber: genOrderNumber(),
      items: orderItems,
      customer,
      shippingAddress,
      subtotal,
      discount,
      couponCode: appliedCoupon,
      shippingFee,
      total,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentMethod === 'razorpay' ? 'paid' : 'pending',
      razorpayOrderId,
      razorpayPaymentId
    });
  } catch (err) {
    // Race: client path and webhook both tried to create the same order.
    // The unique index on razorpayOrderId rejects the loser.
    if (err.code === 11000 && razorpayOrderId) {
      const existing = await Order.findOne({ razorpayOrderId });
      if (existing) return { order: existing, created: false };
    }
    throw err;
  }

  if (appliedCoupon) {
    await Coupon.updateOne({ code: appliedCoupon }, { $inc: { usedCount: 1 } });
  }

  for (const entry of stockUpdateItems) {
    // ── Color-pack bookkeeping: the combo's own counters ──
    // Only where the admin set a number (stock: null = unlimited, left alone).
    if (entry.isPackMeta) {
      await Combo.updateOne(
        {
          _id: entry.comboId,
          packOptions: { $elemMatch: { size: entry.packSize, stock: { $ne: null } } }
        },
        { $inc: { 'packOptions.$[p].stock': -entry.qty } },
        { arrayFilters: [{ 'p.size': entry.packSize, 'p.stock': { $ne: null } }] }
      );

      for (const c of entry.colors) {
        await Combo.updateOne(
          {
            _id: entry.comboId,
            colors: { $elemMatch: { name: c.name, stock: { $ne: null } } }
          },
          { $inc: { 'colors.$[c].stock': -(c.qty * entry.qty) } },
          { arrayFilters: [{ 'c.name': c.name, 'c.stock': { $ne: null } }] }
        );
      }
      continue;
    }

    // ── Multi-product combo: deduct every product pinned in the bundle ──
    if (entry.isCombo) {
      for (const sub of entry.comboProducts) {
        if (!sub.variantId || !sub.size) continue; // nothing pinned, nothing to deduct
        await Product.updateOne(
          { _id: sub.product, 'variants._id': sub.variantId, 'variants.sizes.size': sub.size },
          { $inc: { 'variants.$[v].sizes.$[s].stock': -entry.qty, soldCount: entry.qty } },
          { arrayFilters: [{ 'v._id': sub.variantId }, { 's.size': sub.size }] }
        );
      }
      continue;
    }

    // ── Normal product line (also used for each color of a color-pack) ──
    await Product.updateOne(
      { _id: entry.productId, 'variants._id': entry.variantId, 'variants.sizes.size': entry.size },
      { $inc: { 'variants.$[v].sizes.$[s].stock': -entry.qty, soldCount: entry.qty } },
      { arrayFilters: [{ 'v._id': entry.variantId }, { 's.size': entry.size }] }
    );

    if (entry.pantOptionId) {
      await Product.updateOne(
        { _id: entry.productId, 'pantOptions._id': entry.pantOptionId },
        { $inc: { 'pantOptions.$.stock': -entry.qty } }
      );
    }
    if (entry.shawlOptionId) {
      await Product.updateOne(
        { _id: entry.productId, 'shawlOptions._id': entry.shawlOptionId },
        { $inc: { 'shawlOptions.$.stock': -entry.qty } }
      );
    }
  }

  return { order, created: true };
}