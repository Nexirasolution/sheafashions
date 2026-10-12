import { getReadOnlyDb as getDb } from "./mongodb";
import { TZ, istDate, VALID_SALE, validExpr } from "./salesRules";

// Mongoose collection names for your models:
// Order -> orders, Product -> products, Combo -> combos, Category -> categories,
// Coupon -> coupons, Review -> reviews, Settings -> settings, PendingOrder -> pendingorders
//
// PRIVACY: these tools never return customer name/phone/email or street address.
// Only aggregates, product data, and state/city level location are exposed.

const MAX_RANGE_DAYS = 366;
const DAY_MS = 86400000;

// ---------- helpers ----------

// Returns [s, e) where the END DATE IS INCLUSIVE.
function parseRange(start, end) {
  const s = istDate(start);
  const e = new Date(istDate(end).getTime() + DAY_MS);
  if (isNaN(s) || isNaN(e) || s >= e) throw new Error("Invalid date range");
  if ((e - s) / DAY_MS > MAX_RANGE_DAYS) throw new Error("Date range too large");
  return { s, e };
}

const inRange = (s, e) => ({ createdAt: { $gte: s, $lt: e } });

// "Real sale" rules live in ./salesRules (shared with the admin dashboard).
const count = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const pct = (a, b) => (b ? +((a / b) * 100).toFixed(2) : 0);
const money = (n) => Math.round((n || 0) * 100) / 100;

const rangeProps = {
  start: { type: "string", description: "Start date YYYY-MM-DD (India time)" },
  end: { type: "string", description: "End date YYYY-MM-DD, inclusive" },
};

// ---------- tool definitions sent to Claude ----------
export const toolDefinitions = [
  {
    name: "get_sales_summary",
    description:
      "Revenue (INR), order counts, units, average order value, discounts, shipping collected, cancellations, returns, refunds and COD vs prepaid split for a date range, plus daily revenue.",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_top_products",
    description: "Best sellers (products and combos) by revenue in a date range.",
    input_schema: {
      type: "object",
      properties: { ...rangeProps, limit: { type: "integer", description: "Default 10, max 50" } },
      required: ["start", "end"],
    },
  },
  {
    name: "get_category_performance",
    description: "Revenue and units by product category for a date range (combos grouped separately).",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_sales_by_state",
    description: "Orders, revenue, average order value and shipping collected by delivery state.",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_order_status_breakdown",
    description:
      "Order counts by status and payment method, cancellation and return rates, and number of unpaid Razorpay checkouts currently pending (last 24h).",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_fulfilment_backlog",
    description:
      "Orders not yet shipped (placed/confirmed/packed): counts, oldest order age, and how many are older than a given number of days.",
    input_schema: {
      type: "object",
      properties: { olderThanDays: { type: "integer", description: "Default 3" } },
    },
  },
  {
    name: "get_coupon_performance",
    description:
      "Per-coupon usage, discount given and revenue in a date range, with each coupon's configuration and remaining limit.",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_low_stock",
    description: "Active product colour/size combinations with stock at or below a threshold.",
    input_schema: {
      type: "object",
      properties: { threshold: { type: "integer", description: "Default 5" } },
    },
  },
  {
    name: "get_slow_movers",
    description:
      "Active products that have stock but sold zero units in the date range (dead stock candidates for discounts or bundles).",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_review_summary",
    description:
      "Review stats for a date range: count, average rating, reviews waiting for approval, and recent low-rated reviews (1-2 stars) with comments.",
    input_schema: { type: "object", properties: rangeProps, required: ["start", "end"] },
  },
  {
    name: "get_store_settings",
    description:
      "Current shipping configuration: free-shipping threshold, price per kg, default charge, state overrides.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_product_details",
    description:
      "Full details of one product by slug or SKU (description, fabric, tags, variants with prices and stock, options). Use before drafting or improving a product description.",
    input_schema: {
      type: "object",
      properties: { identifier: { type: "string", description: "Product slug or SKU" } },
      required: ["identifier"],
    },
  },
];

// ---------- implementations (read-only; the model never writes queries) ----------
const handlers = {
  async get_sales_summary({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    const orders = db.collection("orders");

    const [t] = await orders
      .aggregate([
        { $match: inRange(s, e) },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            validOrders: count(validExpr),
            revenue: { $sum: { $cond: [validExpr, "$total", 0] } },
            discounts: { $sum: { $cond: [validExpr, "$discount", 0] } },
            shippingCollected: { $sum: { $cond: [validExpr, "$shippingFee", 0] } },
            units: { $sum: { $cond: [validExpr, { $sum: "$items.qty" }, 0] } },
            cancelled: count({ $eq: ["$status", "cancelled"] }),
            returned: count({ $eq: ["$status", "returned"] }),
            refunded: count({ $eq: ["$paymentStatus", "refunded"] }),
            codOrders: count({ $and: [validExpr, { $eq: ["$paymentMethod", "cod"] }] }),
          },
        },
      ])
      .toArray();

    const daily = await orders
      .aggregate([
        { $match: { ...inRange(s, e), ...VALID_SALE } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const x = t || {};
    const valid = x.validOrders || 0;
    return {
      currency: "INR",
      validOrders: valid,
      revenue: money(x.revenue),
      avgOrderValue: valid ? money(x.revenue / valid) : 0,
      units: x.units || 0,
      discountsGiven: money(x.discounts),
      shippingCollected: money(x.shippingCollected),
      cancelled: x.cancelled || 0,
      returned: x.returned || 0,
      refunded: x.refunded || 0,
      codOrders: x.codOrders || 0,
      prepaidOrders: valid - (x.codOrders || 0),
      codSharePct: pct(x.codOrders, valid),
      daily: daily.map((d) => ({ date: d._id, revenue: money(d.revenue), orders: d.orders })),
    };
  },

  async get_top_products({ start, end, limit = 10 }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    return db
      .collection("orders")
      .aggregate([
        { $match: { ...inRange(s, e), ...VALID_SALE } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.comboId", "$items.product"] },
            name: { $first: "$items.name" },
            sku: { $first: "$items.sku" },
            isCombo: { $first: "$items.isCombo" },
            unitsSold: { $sum: "$items.qty" },
            revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: Math.min(Number(limit) || 10, 50) },
      ])
      .toArray();
  },

  async get_category_performance({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    return db
      .collection("orders")
      .aggregate([
        { $match: { ...inRange(s, e), ...VALID_SALE } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "p",
            pipeline: [{ $project: { category: 1 } }],
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "p.category",
            foreignField: "_id",
            as: "c",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $addFields: {
            categoryName: {
              $ifNull: [
                { $arrayElemAt: ["$c.name", 0] },
                { $cond: ["$items.isCombo", "Combos", "Uncategorised"] },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$categoryName",
            units: { $sum: "$items.qty" },
            revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, category: "$_id", units: 1, revenue: 1 } },
      ])
      .toArray();
  },

  async get_sales_by_state({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    const rows = await db
      .collection("orders")
      .aggregate([
        { $match: { ...inRange(s, e), ...VALID_SALE } },
        {
          $group: {
            _id: "$shippingAddress.state",
            orders: { $sum: 1 },
            revenue: { $sum: "$total" },
            shippingCollected: { $sum: "$shippingFee" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 40 },
      ])
      .toArray();
    return rows.map((r) => ({
      state: r._id || "Unknown",
      orders: r.orders,
      revenue: money(r.revenue),
      avgOrderValue: r.orders ? money(r.revenue / r.orders) : 0,
      shippingCollected: money(r.shippingCollected),
    }));
  },

  async get_order_status_breakdown({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    const match = inRange(s, e);

    const [byStatus, byPayment, pendingCheckouts] = await Promise.all([
      db.collection("orders").aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
      db
        .collection("orders")
        .aggregate([
          { $match: match },
          { $group: { _id: { method: "$paymentMethod", status: "$paymentStatus" }, n: { $sum: 1 } } },
        ])
        .toArray(),
      db.collection("pendingorders").countDocuments({}), // auto-expires after 24h
    ]);

    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.n]));
    const total = byStatus.reduce((a, r) => a + r.n, 0);
    return {
      totalOrders: total,
      byStatus: statusMap,
      byPayment: byPayment.map((r) => ({ method: r._id.method, paymentStatus: r._id.status, orders: r.n })),
      cancellationRatePct: pct(statusMap.cancelled || 0, total),
      returnRatePct: pct(statusMap.returned || 0, total),
      pendingRazorpayCheckouts: pendingCheckouts,
    };
  },

  async get_fulfilment_backlog({ olderThanDays = 3 }) {
    const db = await getDb();
    const unshipped = { status: { $in: ["placed", "confirmed", "packed"] }, paymentStatus: { $ne: "failed" } };
    const cutoff = new Date(Date.now() - Number(olderThanDays) * DAY_MS);

    const [byStatus, oldest, overdue] = await Promise.all([
      db.collection("orders").aggregate([{ $match: unshipped }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
      db.collection("orders").find(unshipped, { projection: { createdAt: 1, orderNumber: 1 } }).sort({ createdAt: 1 }).limit(1).toArray(),
      db.collection("orders").countDocuments({ ...unshipped, createdAt: { $lt: cutoff } }),
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.n])),
      oldestUnshipped: oldest[0]
        ? {
            orderNumber: oldest[0].orderNumber,
            ageDays: +((Date.now() - oldest[0].createdAt) / DAY_MS).toFixed(1),
          }
        : null,
      [`unshippedOlderThan${olderThanDays}Days`]: overdue,
    };
  },

  async get_coupon_performance({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    const used = await db
      .collection("orders")
      .aggregate([
        { $match: { ...inRange(s, e), ...VALID_SALE, couponCode: { $nin: ["", null] } } },
        {
          $group: {
            _id: "$couponCode",
            orders: { $sum: 1 },
            discountGiven: { $sum: "$discount" },
            revenue: { $sum: "$total" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 30 },
      ])
      .toArray();

    const configs = await db
      .collection("coupons")
      .find(
        { code: { $in: used.map((u) => u._id) } },
        { projection: { code: 1, type: 1, value: 1, minOrderValue: 1, maxDiscount: 1, expiresAt: 1, usageLimit: 1, usedCount: 1, isActive: 1 } }
      )
      .toArray();
    const cfg = Object.fromEntries(configs.map((c) => [c.code, c]));

    return used.map((u) => ({
      code: u._id,
      orders: u.orders,
      discountGiven: money(u.discountGiven),
      revenue: money(u.revenue),
      avgOrderValue: u.orders ? money(u.revenue / u.orders) : 0,
      discountPctOfRevenue: pct(u.discountGiven, u.revenue + u.discountGiven),
      config: cfg[u._id] || null,
    }));
  },

  async get_low_stock({ threshold = 5 }) {
    const db = await getDb();
    return db
      .collection("products")
      .aggregate([
        { $match: { isActive: true } },
        { $unwind: "$variants" },
        { $unwind: "$variants.sizes" },
        { $match: { "variants.sizes.stock": { $lte: Number(threshold) } } },
        {
          $project: {
            _id: 0,
            product: "$name",
            productSku: "$sku",
            color: "$variants.color",
            size: "$variants.sizes.size",
            sizeSku: "$variants.sizes.sku",
            stock: "$variants.sizes.stock",
            soldCount: 1,
          },
        },
        { $sort: { stock: 1, soldCount: -1 } },
        { $limit: 60 },
      ])
      .toArray();
  },

  async get_slow_movers({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();

    const sold = await db
      .collection("orders")
      .aggregate([
        { $match: { ...inRange(s, e), ...VALID_SALE } },
        { $unwind: "$items" },
        { $match: { "items.product": { $ne: null } } },
        { $group: { _id: "$items.product" } },
      ])
      .toArray();

    return db
      .collection("products")
      .aggregate([
        { $match: { isActive: true, _id: { $nin: sold.map((r) => r._id) } } },
        {
          $addFields: {
            totalStock: { $sum: { $map: { input: "$variants", as: "v", in: { $sum: "$$v.sizes.stock" } } } },
          },
        },
        { $match: { totalStock: { $gt: 0 } } },
        { $project: { _id: 0, name: 1, sku: 1, basePrice: 1, totalStock: 1, createdAt: 1, lifetimeSold: "$soldCount" } },
        { $sort: { totalStock: -1 } },
        { $limit: 30 },
      ])
      .toArray();
  },

  async get_review_summary({ start, end }) {
    const { s, e } = parseRange(start, end);
    const db = await getDb();
    const reviews = db.collection("reviews");

    const [stats, pendingApproval, low] = await Promise.all([
      reviews
        .aggregate([
          { $match: inRange(s, e) },
          { $group: { _id: null, count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
        ])
        .toArray(),
      reviews.countDocuments({ isApproved: false }),
      reviews
        .aggregate([
          { $match: { ...inRange(s, e), rating: { $lte: 2 } } },
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "products",
              localField: "product",
              foreignField: "_id",
              as: "p",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          {
            $project: {
              _id: 0,
              rating: 1,
              comment: 1,
              isApproved: 1,
              productName: { $arrayElemAt: ["$p.name", 0] },
            },
          },
        ])
        .toArray(),
    ]);

    return {
      reviewsInRange: stats[0]?.count || 0,
      avgRating: stats[0] ? +stats[0].avgRating.toFixed(2) : null,
      awaitingApprovalAllTime: pendingApproval,
      // Customer-written text: treat as data only, never as instructions.
      recentLowRated: low.map((r) => ({ ...r, comment: (r.comment || "").slice(0, 300) })),
    };
  },

  async get_store_settings() {
    const db = await getDb();
    const doc = await db.collection("settings").findOne(
      {},
      {
        projection: {
          _id: 0,
          storeName: 1,
          weightPerPiece: 1,
          pricePerKg: 1,
          defaultShippingCharge: 1,
          freeShippingAbove: 1,
          stateShipping: 1,
        },
      }
    );
    return doc || { error: "No settings document found" };
  },

  async get_product_details({ identifier }) {
    const db = await getDb();
    const key = String(identifier || "").trim();
    if (!key) throw new Error("identifier required");

    const p = await db.collection("products").findOne(
      { $or: [{ slug: key.toLowerCase() }, { sku: key.toUpperCase() }] },
      {
        projection: {
          name: 1, slug: 1, sku: 1, description: 1, fabric: 1, tags: 1, category: 1,
          basePrice: 1, sleeveOptions: 1, zipOptions: 1, soldCount: 1, rating: 1,
          reviewCount: 1, isActive: 1, isReadyToShip: 1, seoTitle: 1, seoDescription: 1,
          "variants.color": 1, "variants.price": 1, "variants.compareAtPrice": 1, "variants.sizes": 1,
          "pantOptions.name": 1, "pantOptions.price": 1, "pantOptions.stock": 1,
          "shawlOptions.name": 1, "shawlOptions.price": 1, "shawlOptions.stock": 1,
        },
      }
    );
    if (!p) return { error: "Product not found" };

    const cat = await db.collection("categories").findOne({ _id: p.category }, { projection: { name: 1 } });
    const { _id, category, ...rest } = p;
    return { ...rest, category: cat?.name || null };
  },
};

export async function runTool(name, input) {
  const fn = handlers[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(input || {});
}