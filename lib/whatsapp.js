import { formatINR } from '@/lib/utils';

export const STORE_NAME = 'Shea Fashions';

// Accepts 10-digit numbers, 0-prefixed, or 91-prefixed. Returns null if invalid.
export function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

// Builds the pre-filled WhatsApp text for a given status
export function buildWhatsAppMessage(order, kind) {
  if (!order) return '';
  const name = order.customer?.name || 'Customer';
  const no = order.orderNumber;

  const itemLines = (order.items || [])
    .map((it) => {
      const variant = [it.color, it.size, it.sleeveType, it.zipType, it.pantOption?.name, it.shawlOption?.name]
        .filter(Boolean)
        .join('/');
      return `• ${it.name}${variant ? ` (${variant})` : ''} x${it.qty}`;
    })
    .join('\n');

  const partner = order.courier?.partner;
  const awb = order.courier?.awbNumber;
  const tracking = order.courier?.trackingId;

  const courierLines = [
    partner && `Courier: ${partner}`,
    awb && `AWB: ${awb}`,
    tracking && `Track your order: ${tracking}`,
  ]
    .filter(Boolean)
    .join('\n');

  const footer = `\n\n- ${STORE_NAME}`;

  switch (kind) {
    case 'placed':
      return `Hi ${name}, thank you for your order ${no}! 🎉\n\n${itemLines}\n\nTotal: ${formatINR(order.total)}\n\nWe will confirm it shortly.${footer}`;
    case 'confirmed':
      return `Hi ${name}, your order ${no} has been confirmed ✅\n\n${itemLines}\n\nTotal: ${formatINR(order.total)}${footer}`;
    case 'packed':
      return `Hi ${name}, your order ${no} has been packed 📦 and will be shipped soon.${footer}`;
    case 'shipped':
      return `Hi ${name}, your order ${no} has been shipped 🚚${courierLines ? `\n\n${courierLines}` : ''}\n\nYou will receive it soon.${footer}`;
    case 'delivered':
      return `Hi ${name}, your order ${no} has been delivered ✅\n\nThank you for shopping with us! We hope you love it. 💖${footer}`;
    case 'cancelled':
      return `Hi ${name}, your order ${no} has been cancelled. If you have any questions, please reply to this message.${footer}`;
    case 'returned':
      return `Hi ${name}, we have received the return for your order ${no}. We will process it shortly.${footer}`;
    default:
      return `Hi ${name}, an update on your order ${no}.${footer}`;
  }
}

// Returns a wa.me link, or null if the customer's phone is invalid
export function whatsappLink(order, kind) {
  const phone = normalizeIndianPhone(order?.customer?.phone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(order, kind))}`;
}