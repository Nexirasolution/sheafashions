import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema(
  {
    color: { type: String, default: '' },
    colorHex: { type: String, default: '#000000' },
    images: [{ type: String }],
    // Default price for this colour. Any size without its own price uses this.
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: 0 },

    sizes: [
      {
        size: { type: String, required: true },
        stock: { type: Number, default: 0 },
        sku: { type: String },
        // Optional per-size price. null/0 = use the variant price above.
        price: { type: Number, default: null, min: 0 }
      }
    ]
  },
  { _id: true }
);

// A single named add-on option (e.g. "Cotton Palazzo", "Bandhani Shawl").
// `price` is an ADDITIONAL amount added on top of the variant price when
// this option is picked — not a standalone price.
const AddonOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    price: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    sku: { type: String, default: '' }
  },
  { _id: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    fabric: { type: String, default: '' },
    tags: [{ type: String }],
    variants: [VariantSchema],

    // One or more optional size chart images. If empty, the storefront
    // falls back to this product's category.sizeChart instead.
    sizeChart: [{ type: String }],

    sleeveOptions: [{ type: String, enum: ['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'] }],
    zipOptions: [{ type: String, enum: ['With Zip', 'Without Zip'] }],

    pantOptions: [AddonOptionSchema],
    shawlOptions: [AddonOptionSchema],

    // Manual shipping weight of ONE piece, in grams. 0 = not set.
    weight: { type: Number, default: 0, min: 0 },

    // Free shipping for this product (see lib/freeShipping.js).
    //   freeShipping = true             -> free in every state
    //   freeShippingStates = ['Kerala'] -> free only when delivering to these states
    freeShipping: { type: Boolean, default: false },
    freeShippingStates: [{ type: String }],

    // When true, the storefront shows a highlighted "Ready to Ship" badge
    // below the product title.
    isReadyToShip: { type: Boolean, default: false },

    // Lowest price across all variants AND sizes (used for listing/sorting).
    basePrice: { type: Number, required: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isBestSeller: { type: Boolean, default: false },
    isTopSeller: { type: Boolean, default: false },
    isActiveSeller: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    seoTitle: String,
    seoDescription: String
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ isActive: 1, category: 1, createdAt: -1 });
ProductSchema.index({ isActive: 1, basePrice: 1 });
ProductSchema.index({ 'variants.sizes.size': 1 });

// In dev, Next.js hot-reload keeps Mongoose's model registry alive across
// saves, so schema changes (like adding `weight`) are silently ignored until
// the server restarts. Force a fresh compile outside production.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Product) {
  delete mongoose.models.Product;
}

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);