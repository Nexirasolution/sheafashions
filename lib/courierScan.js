// Helpers for reading courier receipt codes (QR / barcode)

const PARTNER_DOMAINS = {
  'delhivery.com': 'Delhivery',
  'dtdc.in': 'DTDC',
  'dtdc.com': 'DTDC',
  'indiapost.gov.in': 'India Post',
  'bluedart.com': 'Blue Dart',
  'ecomexpress.in': 'Ecom Express',
  'xpressbees.com': 'XpressBees',
  'shadowfax.in': 'Shadowfax',
  'ekartlogistics.com': 'Ekart',
  'shiprocket.in': 'Shiprocket',
  'trackon.in': 'Trackon',
  'tpcindia.com': 'Professional Couriers',
};

const AWB_KEYS = [
  'awb', 'awbno', 'awbnumber', 'waybill', 'waybillno', 'wbn', 'cn',
  'consignment', 'consignmentno', 'trackingnumber', 'trackingno',
  'trackingid', 'tracking', 'id',
];

const looksLikeAwb = (s) => /^[A-Za-z0-9-]{8,25}$/.test(s) && /\d{5,}/.test(s);

function detectPartner(text) {
  const t = text.toLowerCase();
  for (const [domain, name] of Object.entries(PARTNER_DOMAINS)) {
    if (t.includes(domain)) return name;
  }
  const keyword = Object.values(PARTNER_DOMAINS).find((n) => t.includes(n.toLowerCase()));
  if (keyword) return keyword;
  if (/^[A-Z]{2}\d{9}IN$/i.test(text.trim())) return 'India Post'; // e.g. EE123456789IN
  return '';
}

/**
 * Turns raw scanned text into { partner, awbNumber, trackingId } or null.
 * Handles JSON, tracking URLs, delimited text and plain barcodes.
 */
export function parseCourierScan(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const result = { partner: detectPartner(text), awbNumber: '', trackingId: '' };

  // 1. JSON payload
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      const flat = Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ''), v])
      );
      const key = AWB_KEYS.find((k) => flat[k]);
      if (key) result.awbNumber = String(flat[key]);
      if (flat.courier || flat.partner) result.partner = String(flat.courier || flat.partner);
      if (result.awbNumber) return result;
    }
  } catch { /* not JSON */ }

  // 2. URL payload
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      result.trackingId = text; // keep the full tracking link
      for (const [k, v] of url.searchParams.entries()) {
        if (AWB_KEYS.includes(k.toLowerCase().replace(/[\s_-]/g, '')) && v) {
          result.awbNumber = v;
          break;
        }
      }
      if (!result.awbNumber) {
        const last = url.pathname.split('/').filter(Boolean).pop();
        if (last && looksLikeAwb(last)) result.awbNumber = last;
      }
      return result.awbNumber || result.trackingId ? result : null;
    } catch { /* fall through */ }
  }

  // 3. Delimited text -> first token that looks like an AWB
  const tokens = text.split(/[|,;\n\r\t ]+/).map((t) => t.trim()).filter(Boolean);
  const hit = tokens.find(looksLikeAwb);
  if (hit) {
    result.awbNumber = hit;
    return result;
  }

  // 4. Plain code (most barcodes)
  if (/^[A-Za-z0-9-]{6,30}$/.test(text)) {
    result.awbNumber = text;
    return result;
  }

  return null;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Looks for one of our orders (order number or order id) inside the scanned text.
 * Returns { order, rest } where `rest` is the scan with the order reference removed,
 * or null when no order is referenced.
 */
export function findOrderInScan(raw, orders) {
  const text = String(raw || '').trim();
  if (!text || !orders?.length) return null;

  let best = null;
  for (const order of orders) {
    for (const ref of [order.orderNumber, order._id]) {
      if (!ref) continue;
      const str = String(ref);
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(str)}(?![A-Za-z0-9])`, 'i');
      if (re.test(text) && (!best || str.length > best.len)) {
        best = { order, len: str.length, re };
      }
    }
  }
  if (!best) return null;
  return { order: best.order, rest: text.replace(best.re, ' ').trim() };
}