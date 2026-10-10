import mongoose from 'mongoose';

const ColorOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    hex: { type: String, default: '' },
    variantId: { type: String, default: '' },
    size: { type: String, default: '' },
    stock: { type: Number, default: null } // admin-set stock for this color, shown alongside live variant stock
  },
  { _id: false }
);

const PackOptionSchema = new mongoose.Schema(
  {
    size: { type: Number, required: true }, // number of pieces in this pack (e.g. 5, 10)
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: 0 },
    stock: { type: Number, default: null } // how many of this pack size are available to sell; null = unlimited
  },
  { _id: false }
);

const SizeChartRowSchema = new mongoose.Schema(
  {
    size: { type: String, required: true },
    chest: { type: String, default: '' },
    waist: { type: String, default: '' },
    length: { type: String, default: '' }
  },
  { _id: false }
);

const ComboSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['multi-product', 'color-pack'], default: 'multi-product' },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    images: [{ type: String }],
    description: { type: String, default: '' },

    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        variantId: { type: String },
        size: { type: String }
      }
    ],
    comboPrice: { type: Number, default: 0 },
    originalPrice: { type: Number, default: 0 },

    // Total items the customer receives in ONE multi-product combo.
    // Used for the shipping-weight fallback (pieces x weight per piece).
    piecesPerCombo: { type: Number, default: 0, min: 0 },

    // Manual shipping weight in GRAMS (0 = not set).
    // multi-product: total weight of ONE combo.
    weight: { type: Number, default: 0, min: 0 },
    // color-pack: weight of ONE piece (pack weight = pieces x pieceWeight).
    // If 0, the base product's own weight is used.
    pieceWeight: { type: Number, default: 0, min: 0 },

    // Per-combo free shipping (same semantics as Product)
    //   freeShipping === true           -> free in every state
    //   freeShippingStates = ['Kerala'] -> free only to those states
    freeShipping: { type: Boolean, default: false },
    freeShippingStates: [{ type: String }],

    baseProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    colors: [ColorOptionSchema],
    packOptions: [PackOptionSchema],
    sizeChart: [SizeChartRowSchema],

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// In dev, Next.js hot-reload keeps Mongoose's model registry alive across
// saves; force a fresh compile so schema changes always take effect.
if (mongoose.models.Combo) {
  delete mongoose.models.Combo;
}

export default mongoose.model('Combo', ComboSchema);