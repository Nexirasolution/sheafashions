export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { formatINR } from '@/lib/utils';
import PrintButton from '@/components/PrintButton';

// Theme: #064E4A (deep teal), #C49A45 (gold), #FFFDF5 (cream), #172A29 (dark teal), #E7DCC5 (sand)
const INK = '#172A29';          // primary text
const INK_SOFT = '#6B7F7C';     // muted text (derived teal-gray)
const PEACH = '#C49A45';        // accent (gold) - used for the total's divider
const LINE = '#E7DCC5';         // borders (sand)
const PAPER = '#FFFDF5';        // page background (cream)
const SAGE = '#064E4A';         // deep teal (labels, discount, total)
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default async function InvoicePage({ params }) {
  await dbConnect();
  const order = await Order.findById(params.orderId).lean();
  const settings = await Settings.findOne({ key: 'global' }).lean();

  if (!order) {
    return <div className="p-10 text-center text-sm" style={{ color: INK_SOFT }}>Invoice not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8 sm:p-10" style={{ background: PAPER, color: INK }}>
      <div className="flex justify-between items-start pb-5 mb-6" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div>
          <h1 className="text-[22px]" style={{ fontFamily: FONT_SERIF, color: INK }}>
            {settings?.storeName || 'Tirupur Clothing Hub'}
          </h1>
          <p className="text-sm mt-1" style={{ color: INK_SOFT }}>{settings?.address || 'Tamil Nadu'}</p>
          <p className="text-sm" style={{ color: INK_SOFT }}>WhatsApp: +{settings?.whatsapp}</p>
        </div>
        <div className="text-right">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: SAGE }}>Invoice</h2>
          <p className="text-sm mt-1.5" style={{ color: INK }}>{order.orderNumber}</p>
          <p className="text-sm" style={{ color: INK_SOFT }}>{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] mb-2" style={{ color: SAGE }}>Billed To</p>
          <p style={{ color: INK }}>{order.customer?.name}</p>
          <p style={{ color: INK_SOFT }}>{order.customer?.phone}</p>
          <p style={{ color: INK_SOFT }}>{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
          <p style={{ color: INK_SOFT }}>{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] mb-2" style={{ color: SAGE }}>Payment</p>
          <p style={{ color: INK_SOFT }}>Method: <span style={{ color: INK }}>{order.paymentMethod === 'razorpay' ? 'Online Payment' : 'Cash on Delivery'}</span></p>
          <p style={{ color: INK_SOFT }}>Status: <span style={{ color: INK }}>{order.paymentStatus}</span></p>
        </div>
      </div>

      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr style={{ borderBottom: `1px solid ${LINE}` }} className="text-left">
            <th className="py-2.5 text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: SAGE }}>Item</th>
            <th className="py-2.5 text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: SAGE }}>Color/Size</th>
            <th className="py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: SAGE }}>Price</th>
            <th className="py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: SAGE }}>Qty</th>
            <th className="py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: SAGE }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
              <td className="py-2.5" style={{ color: INK }}>{item.name}</td>
              <td className="py-2.5" style={{ color: INK_SOFT }}>{item.color}/{item.size}</td>
              <td className="py-2.5 text-right" style={{ color: INK_SOFT }}>{formatINR(item.price)}</td>
              <td className="py-2.5 text-right" style={{ color: INK_SOFT }}>{item.qty}</td>
              <td className="py-2.5 text-right" style={{ color: INK }}>{formatINR(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-56 text-sm space-y-1.5">
          <div className="flex justify-between" style={{ color: INK_SOFT }}>
            <span>Subtotal</span><span>{formatINR(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between" style={{ color: SAGE }}>
              <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
              <span>-{formatINR(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between" style={{ color: INK_SOFT }}>
            <span>Shipping</span><span>{order.shippingFee === 0 ? 'Free' : formatINR(order.shippingFee)}</span>
          </div>
          <div
            className="flex justify-between text-base pt-2 mt-1 font-semibold"
            style={{ color: SAGE, borderTop: `2px solid ${PEACH}`, fontFamily: FONT_SERIF }}
          >
            <span>Total</span><span>{formatINR(order.total)}</span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs mt-12" style={{ color: INK_SOFT }}>
        Thank you for shopping with {settings?.storeName || 'Shea Fashions'}
      </p>

      <div className="mt-6">
        <PrintButton />
      </div>
    </div>
  );
}