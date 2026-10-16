// Builds the customer-facing tracking link from a saved courier + AWB number.
// The courier's template uses {awb} as the placeholder.
export function buildTrackingUrl(courier, awb) {
  const template = String(courier?.trackingUrl || '').trim();
  const number = String(awb || '').trim();
  if (!template || !number) return '';
  const encoded = encodeURIComponent(number);
  return template.includes('{awb}') ? template.split('{awb}').join(encoded) : template + encoded;
}

// Finds a saved courier by name (exact match first, then loose match)
export function findCourierByName(couriers, name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n || !couriers?.length) return null;
  return (
    couriers.find((c) => c.name.toLowerCase() === n) ||
    couriers.find((c) => {
      const cn = c.name.toLowerCase();
      return n.includes(cn) || cn.includes(n);
    }) ||
    null
  );
}