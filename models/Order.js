import mongoose from 'mongoose';

// Snapshot of a chosen add-on at the time of order, so historical orders
// stay accurate even if the product's options change/get deleted later.
const AddonSelectionSchema = new mongoose.Schema(
  {
    optionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, default: '' },
    image: { type: String, default: '' },
    price: { type: Number, default: 0 },
    sku: { type: String, default: '' }
  },
  { _id: false }
);

// Snapshot of a color-pack's contents (pack size + how many of each color).
const PackDetailsSchema = new mongoose.Schema(
  {
    packSize: { type: Number },
    size: { type: String, default: '' },
    colors: [
      {
        _id: false,
        name: { type: String },
        qty: { type: Number }
      }
    ]
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    comboId: { type: mongoose.Schema.Types.ObjectId, ref: 'Combo', default: null },
    isCombo: { type: Boolean, default: false },
    name: String,
    sku: { type: String, default: '' },
    image: String,
    color: String,
    size: String,
    sleeveType: { type: String, default: '' },
    zipType: { type: String, default: '' },
    // null when the customer picked "None" (no pant / no shawl)
    pantOption: { type: AddonSelectionSchema, default: null },
    shawlOption: { type: AddonSelectionSchema, default: null },
    // Only set for color-pack combo lines
    packDetails: { type: PackDetailsSchema, default: null },
    price: Number, // unit price INCLUDING pant/shawl add-on prices
    qty: Number
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    items: [OrderItemSchema],
    customer: {
      name: String,
      phone: String,
      email: String
    },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    shippingFee: { type: Number, default: 0 },
    total: Number,
    paymentMethod: { type: String, enum: ['razorpay', 'cod'], default: 'razorpay' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    // unique + sparse: COD orders have no razorpayOrderId (many nulls allowed),
    // but two orders can never share the same real Razorpay order id —
    // this is what makes the webhook/client-path race safe.
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: String,
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'placed'
    },
    courier: {
      partner: { type: String, default: '' },
      trackingId: { type: String, default: '' },
      awbNumber: { type: String, default: '' }
    },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);