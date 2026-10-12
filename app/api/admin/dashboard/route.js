import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';
import { VALID_SALE, TZ, DAY_MS, startOfDayIST, istDateKey } from '@/lib/salesRules';

export const dynamic = 'force-dynamic';

const LOW_STOCK_MAX = 5;

const EMPTY = { sales: 0, orders: 0 };
const pick = (rows) => (rows && rows[0] ? { sales: rows[0].sales, orders: rows[0].orders } : EMPTY);
const totals = { $group: { _id: null, sales: { $sum: '$total' }, orders: { $sum: 1 } } };

export const GET = requireAdmin(async () => {
  await dbConnect();

  // Calendar days in India time. "week" and "month" include today.
  const today = startOfDayIST();
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  const monthStart = new Date(today.getTime() - 29 * DAY_MS);
  const trendStart = new Date(today.getTime() - 13 * DAY_MS);

  const [salesFacets, totalOrders, totalProducts, pendingOrders, lowStock, topProducts] = await Promise.all([
    // One pass over the last 30 days of real sales, split four ways.
    Order.aggregate([
      { $match: { createdAt: { $gte: monthStart }, ...VALID_SALE } },
      {
        $facet: {
          today: [{ $match: { createdAt: { $gte: today } } }, totals],
          week: [{ $match: { createdAt: { $gte: weekStart } } }, totals],
          month: [totals],
          trend: [
            { $match: { createdAt: { $gte: trendStart } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
                sales: { $sum: '$total' },
                orders: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]),

    Order.countDocuments(VALID_SALE),
    Product.countDocuments({ isActive: true }),

    // Waiting to be shipped (excluding failed payments).
    Order.countDocuments({ status: { $in: ['placed', 'confirmed'] }, paymentStatus: { $ne: 'failed' } }),

    // Products with a size at 1..5 units. Returns only the low sizes,
    // in the same shape as before: { name, variants: [{ color, sizes: [...] }] }.
    Product.aggregate([
      {
        $match: {
          isActive: true,
          variants: {
            $elemMatch: { sizes: { $elemMatch: { stock: { $gt: 0, $lte: LOW_STOCK_MAX } } } }
          }
        }
      },
      {
        $project: {
          name: 1,
          variants: {
            $filter: {
              input: {
                $map: {
                  input: '$variants',
                  as: 'v',
                  in: {
                    _id: '$$v._id',
                    color: '$$v.color',
                    sizes: {
                      $filter: {
                        input: '$$v.sizes',
                        as: 's',
                        cond: { $and: [{ $gt: ['$$s.stock', 0] }, { $lte: ['$$s.stock', LOW_STOCK_MAX] }] }
                      }
                    }
                  }
                }
              },
              as: 'v',
              cond: { $gt: [{ $size: '$$v.sizes' }, 0] }
            }
          }
        }
      },
      { $limit: 10 }
    ]),

    // All-time best sellers (uses the soldCount counter on each product).
    Product.find({ isActive: true }).sort({ soldCount: -1 }).limit(5).select('name soldCount basePrice').lean()
  ]);

  const f = salesFacets[0] || {};

  // Fill days with no sales so the chart has 14 continuous points.
  const byDay = Object.fromEntries((f.trend || []).map((d) => [d._id, d]));
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const key = istDateKey(new Date(today.getTime() - i * DAY_MS));
    const d = byDay[key];
    trend.push({ date: key.slice(5), sales: d ? d.sales : 0, orders: d ? d.orders : 0 });
  }

  return NextResponse.json({
    today: pick(f.today),
    week: pick(f.week),
    month: pick(f.month),
    totalOrders,
    totalProducts,
    pendingOrders,
    lowStock,
    trend,
    topProducts
  });
});