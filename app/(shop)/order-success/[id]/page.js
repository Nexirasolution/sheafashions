'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/lib/utils';

// Theme: #064E4A (deep teal), #C49A45 (gold), #FFFDF5 (cream), #172A29 (dark teal), #E7DCC5 (sand)
const INK = '#172A29';          // primary text
const INK_SOFT = '#6B7F7C';     // muted text (derived teal-gray)
const PEACH = '#C49A45';        // accent (gold) - ring around the success icon
const PEACH_WASH = '#E7DCC5';   // icon circle background (sand)
const LINE = '#E7DCC5';         // borders (sand)
const PAPER = '#FFFDF5';        // page background (cream)
const SAGE = '#064E4A';         // deep teal (success icon, total, primary button)
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

export default function OrderSuccessPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => setOrder(d.order));
  }, [id]);

  if (!order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center text-sm" style={{ color: INK_SOFT }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-20 text-center" style={{ background: PAPER }}>
      <div
        className="inline-flex items-center justify-center w-16 h-16 mb-5"
        style={{ background: PEACH_WASH, border: `1px solid ${PEACH}`, borderRadius: '50%' }}
      >
        <CheckCircle2 size={30} strokeWidth={1.5} style={{ color: SAGE }} />
      </div>

      <h1 className="text-[24px] sm:text-[28px]" style={{ fontFamily: FONT_SERIF, color: INK }}>
        Order placed successfully
      </h1>

      <div className="mt-6 pt-6 max-w-xs mx-auto space-y-2" style={{ borderTop: `1px solid ${LINE}` }}>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Order Number <span style={{ color: INK }}>— {order.orderNumber}</span>
        </p>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Total <span className="font-semibold" style={{ color: SAGE }}>— {formatINR(order.total)}</span>
        </p>
      </div>

      <p className="text-xs mt-5" style={{ color: INK_SOFT }}>
        We&rsquo;ll send updates to {order.customer?.phone}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-9">
        <Link
          href={`/invoice/${order._id}`}
          className="px-6 py-3 text-sm font-medium transition-opacity active:opacity-70"
          style={{ border: `1px solid ${INK}`, color: INK, background: PAPER, borderRadius: '4px' }}
        >
          View Invoice
        </Link>
        <Link
          href="/"
          className="px-6 py-3 text-sm font-medium transition-opacity active:opacity-80"
          style={{ background: SAGE, color: PAPER, borderRadius: '4px' }}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}