import mongoose from 'mongoose';

// Per-state shipping override. A field left null means "use the global value".
const StateShippingSchema = new mongoose.Schema(
  {
    state: { type: String, required: true },
    enabled: { type: Boolean, default: true }, // false = we don't deliver here
    pricePerKg: { type: Number, default: null },
    defaultShippingCharge: { type: Number, default: null },
    freeShippingAbove: { type: Number, default: null }
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    storeName: { type: String },
    logo: { type: String },
    whatsapp: { type: String },
    instagram: { type: String },
    address: { type: String },

    // Weight-based shipping. See lib/shipping.js, the only place this is calculated.
    // `shippingFee` is legacy and no longer read by the shipping calculator.
    shippingFee: { type: Number, default: 0 },
    weightPerPiece: { type: Number, default: 0 }, // grams, per single piece
    pricePerKg: { type: Number, default: 0 }, // ₹ per kg (rounded up)

    // Flat fallback when weight-based shipping can't be computed.
    defaultShippingCharge: { type: Number, default: 0 },

    // Subtotal (₹) at or above which shipping is free. 0 = disabled.
    freeShippingAbove: { type: Number, default: 0 },

    // State-wise overrides plus a per-state "deliverable" switch.
    stateShipping: { type: [StateShippingSchema], default: [] },

    seoTitle: { type: String },
    seoDescription: { type: String }
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);