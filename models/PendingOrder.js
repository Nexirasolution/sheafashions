import mongoose from 'mongoose';

// Holds the full order payload (items/customer/address/coupon) between
// "Razorpay order created" and "order actually saved". The webhook reads
// this to build the real Order even if the customer's browser never
// calls back. Auto-expires after 24h so abandoned/failed payments don't
// pile up.
const PendingOrderSchema = new mongoose.Schema({
  razorpayOrderId: { type: String, required: true, unique: true },
  items: { type: mongoose.Schema.Types.Mixed, required: true },
  customer: { type: mongoose.Schema.Types.Mixed, required: true },
  shippingAddress: { type: mongoose.Schema.Types.Mixed, required: true },
  couponCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }
});

export default mongoose.models.PendingOrder || mongoose.model('PendingOrder', PendingOrderSchema);