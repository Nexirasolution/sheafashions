export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { formatINR } from '@/lib/utils';
import PrintButton from '@/components/PrintButton';
import PrintStyles from '@/components/PrintStyles';

// Theme: #064E4A (deep teal), #C49A45 (gold), #FFFDF5 (cream), #172A29 (dark teal), #E7DCC5 (sand)
const INK = '#172A29';
const INK_SOFT = '#6B7F7C';
const PEACH_LIGHT = '#E7DCC5';
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const SAGE = '#064E4A';
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default async function CourierBillPage({ params }) {
  await dbConnect();
  const order = await Order.findById(params.orderId).lean();
  const settings = await Settings.findOne({ key: 'global' }).lean();

  if (!order) {
    return (
      <div className="p-10 text-center text-sm" style={{ color: INK_SOFT }}>
        Shipping label not found.
      </div>
    );
  }

  // Use the logo saved in settings, else fall back to a file in /public
  const logoSrc = settings?.logoUrl || settings?.logo || '/logo.png';
  const storeName = settings?.storeName || 'Shea Fashions';

  return (
    <>
      <PrintStyles />
      <div
        className="print-area max-w-md mx-auto p-7 m-6"
        style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: '4px', color: INK }}
      >
        {/* Header: logo + title + order number */}
        <div
          className="flex justify-between items-center pb-4 mb-5"
          style={{ borderBottom: `1px dashed ${LINE}` }}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt={storeName}
              style={{ height: '44px', width: 'auto', maxWidth: '110px', objectFit: 'contain' }}
            />
            <h1 className="text-lg tracking-tight" style={{ fontFamily: FONT_SERIF, color: INK }}>
              Shipping Label
            </h1>
          </div>
          <span
            className="text-[11px] font-mono px-2.5 py-1"
            style={{ background: PEACH_LIGHT, color: SAGE, borderRadius: '2px' }}
          >
            {order.orderNumber}
          </span>
        </div>

        {/* TO (first, most prominent) */}
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] mb-1.5" style={{ color: SAGE }}>
          To
        </p>
        <p className="text-base font-semibold" style={{ color: INK }}>{order.customer?.name}</p>
        <p className="text-sm" style={{ color: INK_SOFT }}>{order.customer?.phone}</p>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          {[order.shippingAddress?.line1, order.shippingAddress?.line2].filter(Boolean).join(', ')}
        </p>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
        </p>
        {order.shippingAddress?.landmark && (
          <p className="text-sm mt-0.5" style={{ color: INK_SOFT }}>
            Landmark: {order.shippingAddress.landmark}
          </p>
        )}

        {/* FROM */}
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] mt-5 mb-1.5" style={{ color: SAGE }}>
          From
        </p>
        <p className="text-sm" style={{ color: INK }}>{storeName}</p>
        <p className="text-sm" style={{ color: INK_SOFT }}>{settings?.address || 'Tamil Nadu'}</p>

        {/* Shipment details */}
        <div className="mt-5 pt-4 text-sm space-y-2 avoid-break" style={{ borderTop: `1px dashed ${LINE}` }}>
          <div className="flex justify-between">
            <span style={{ color: INK_SOFT }}>Items</span>
            <span style={{ color: INK }}>{order.items.length}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: INK_SOFT }}>Payment</span>
            <span
              className={order.paymentMethod === 'cod' ? 'font-semibold' : ''}
              style={{ color: order.paymentMethod === 'cod' ? SAGE : INK }}
            >
              {order.paymentMethod === 'cod' ? `COD - ${formatINR(order.total)}` : 'Prepaid'}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: INK_SOFT }}>Courier Partner</span>
            <span style={{ color: INK }}>{order.courier?.partner || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: INK_SOFT }}>AWB / Tracking No.</span>
            <span className="font-mono" style={{ color: INK }}>{order.courier?.awbNumber || '—'}</span>
          </div>
        </div>

        <div className="mt-6 no-print">
          <PrintButton label="Print Label" />
        </div>
      </div>
    </>
  );
}