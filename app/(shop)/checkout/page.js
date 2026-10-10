'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import toast from 'react-hot-toast';
import { useCart, cartKey } from '@/components/CartContext';
import { formatINR } from '@/lib/utils';
import { INDIAN_STATES } from '@/lib/indianStates';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';
const WASH = '#F5EFE0';
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const RUST = '#B0503A';          // kept as-is: errors need to read as warnings
const RUST_WASH = '#FBEAE6';
const TEAL_DISABLED = '#9DB5B2'; // muted teal for the disabled submit button
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

const inputClass =
  'w-full text-sm outline-none transition-colors px-3.5 py-2.5';
const inputStyle = { border: `1px solid ${LINE}`, borderRadius: '3px', color: INK, background: PAPER };

const sectionHeadClass = 'text-[11px] font-medium uppercase tracking-[0.18em] mb-4';

function SSRKInput({ placeholder, type = 'text', value, onChange, autoComplete, inputMode, maxLength }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={maxLength}
      value={value}
      onChange={onChange}
      className={inputClass}
      style={inputStyle}
    />
  );
}

export default function CheckoutPage() {
  const { items, subtotal, totalPieces, clearCart, updateQty, removeItem, setItemStock } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    line1: '', line2: '', city: '', state: '', pincode: '', landmark: ''
  });

  // Coupon: `coupon` is what the user types, `appliedCoupon` is only set
  // after the server confirms the code is valid.
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [discount, setDiscount] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [submitting, setSubmitting] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);

  const [shipping, setShipping] = useState(null);
  const [freeShippingAbove, setFreeShippingAbove] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [deliverable, setDeliverable] = useState(true);

  const discountedSubtotal = subtotal - discount;
  const total = shipping !== null ? Math.round(discountedSubtotal + shipping) : null;

  // Physical pieces across the cart (fallback weight only).
  const totalQty = totalPieces;

  // Lines sent to the shipping API. The server looks up each product's / combo's
  // weight from the database, so only identifiers + quantities are sent.
  const shippingItems = useMemo(
    () =>
      items.map((i) => ({
        productId: i.productId,
        comboId: i.comboId,
        isCombo: i.isCombo || false,
        qty: i.qty,
        packDetails: i.packDetails,
      })),
    [items]
  );

  const fetchShipping = useCallback(async () => {
    setShippingLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal: discountedSubtotal,
          totalQty,
          state: form.state,
          items: shippingItems
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShipping(data.shippingCost);
        setFreeShippingAbove(data.freeShippingAbove);
        setDeliverable(data.deliverable !== false);
      } else {
        toast.error(data.error || 'Could not calculate shipping');
      }
    } catch {
      toast.error('Could not calculate shipping');
    } finally {
      setShippingLoading(false);
    }
  }, [discountedSubtotal, totalQty, form.state, shippingItems]);

  useEffect(() => { fetchShipping(); }, [fetchShipping]);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function applyCoupon(codeArg) {
    const code = (typeof codeArg === 'string' ? codeArg : coupon).trim();
    if (!code) { toast.error('Enter a coupon code'); return; }

    setApplyingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      const data = await res.json();
      if (data.valid) {
        setDiscount(data.discount);
        setAppliedCoupon(code.toUpperCase());
        setCoupon(code.toUpperCase());
        toast.success(data.message);
      } else {
        setDiscount(0);
        setAppliedCoupon('');
        toast.error(data.message || 'Invalid coupon');
      }
    } catch {
      toast.error('Could not apply coupon, please try again');
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setDiscount(0);
    setAppliedCoupon('');
    setCoupon('');
  }

  // If the cart changes after a coupon is applied, re-check it so the
  // discount never goes stale (min order value, percent amount, etc.).
  useEffect(() => {
    if (appliedCoupon) applyCoupon(appliedCoupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function validateStockBeforeOrder() {
    setCheckingStock(true);
    try {
      const res = await fetch('/api/cart/validate-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            size: i.size,
            qty: i.qty,
            name: i.name,
            isCombo: i.isCombo || false,
            comboId: i.comboId,
            packKey: i.packKey,
            packDetails: i.packDetails,
            sleeveType: i.sleeveType,
            zipType: i.zipType,
            pantOption: i.pantOption,
            shawlOption: i.shawlOption,
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Could not verify stock, please try again');
        return false;
      }

      if (data.valid) return true;

      data.issues.forEach((issue) => {
        const key = cartKey(issue);
        if (issue.reason === 'unavailable' || issue.reason === 'out_of_stock') {
          toast.error(`${issue.name || 'An item'} is out of stock and was removed from your cart`);
          removeItem(key);
        } else if (issue.reason === 'insufficient_stock') {
          toast.error(`Only ${issue.availableStock} left of ${issue.name || 'an item'} — quantity adjusted`);
          updateQty(key, issue.availableStock);
          setItemStock(key, issue.availableStock);
        }
      });

      return false;
    } catch {
      toast.error('Could not verify stock, please try again');
      return false;
    } finally {
      setCheckingStock(false);
    }
  }

  async function placeOrder() {
    if (!form.name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      toast.error('Please fill all required fields'); return;
    }
    if (!deliverable) { toast.error(`Sorry, we don't deliver to ${form.state} yet`); return; }
    if (items.length === 0) { toast.error('Your cart is empty'); return; }
    if (shipping === null) { toast.error('Shipping is still being calculated, please wait'); return; }

    setSubmitting(true);

    const stockOk = await validateStockBeforeOrder();
    if (!stockOk) {
      setSubmitting(false);
      return;
    }

    const orderItems = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      size: i.size,
      sleeveType: i.sleeveType || '',
      zipType: i.zipType || '',
      pantOption: i.pantOption,
      shawlOption: i.shawlOption,
      qty: i.qty,
      isCombo: i.isCombo || false,
      comboId: i.comboId,
      // Color-pack: server uses packSize + colors to verify pieces, stock and price.
      ...(i.packDetails ? { packDetails: i.packDetails } : {}),
    }));

    try {
      if (paymentMethod === 'razorpay') {
        // Server recomputes the total (shipping from DB-derived weights
        // and the delivery state) and stashes the order payload so the
        // webhook can create the order even if this tab closes early.
        // `expectedTotal` is only a safety check: on mismatch the server
        // answers 409 and the Razorpay popup never opens.
        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: orderItems,
            customer: { name: form.name, phone: form.phone, email: form.email },
            shippingAddress: form,
            couponCode: appliedCoupon,
            expectedTotal: total
          })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) {
          toast.error(orderData.error || 'Payment gateway error');
          if (orderRes.status === 409) fetchShipping();
          setSubmitting(false);
          return;
        }

        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: 'INR',
          name: 'Shea Fashions',
          order_id: orderData.order.id,
          prefill: { name: form.name, contact: form.phone, email: form.email },
          theme: { color: '#064E4A' },
          handler: async function (response) {
            // Fast path — if this fails or never runs, the webhook creates
            // the same order server-side. /api/orders is idempotent on
            // razorpayOrderId, so this is always safe to call.
            const finalRes = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: orderItems,
                customer: { name: form.name, phone: form.phone, email: form.email },
                shippingAddress: form,
                couponCode: appliedCoupon,
                paymentMethod: 'razorpay',
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              })
            });
            const finalData = await finalRes.json();
            if (finalRes.ok) {
              clearCart();
              router.push(`/order-success/${finalData.order._id}`);
            } else {
              toast.error(
                `Payment received — confirming your order. If it doesn't appear shortly, contact support with payment ID ${response.razorpay_payment_id}.`,
                { duration: 8000 }
              );
              clearCart();
              router.push('/');
            }
            setSubmitting(false);
          },
          modal: { ondismiss: () => setSubmitting(false) }
        });
        rzp.open();
      } else {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: orderItems,
            customer: { name: form.name, phone: form.phone, email: form.email },
            shippingAddress: form,
            couponCode: appliedCoupon,
            paymentMethod: 'cod'
          })
        });
        const data = await res.json();
        if (res.ok) { clearCart(); router.push(`/order-success/${data.order._id}`); }
        else { toast.error(data.error || 'Could not place order'); }
        setSubmitting(false);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const placeOrderDisabled =
    submitting || shippingLoading || checkingStock || applyingCoupon || shipping === null || !deliverable;

  // Only show the "add ₹X more for free shipping" banner when a free-shipping
  // threshold applies (> 0, already resolved for the chosen state) and the
  // customer hasn't reached it.
  const amountToFreeShipping =
    freeShippingAbove !== null && freeShippingAbove > 0
      ? freeShippingAbove - discountedSubtotal
      : 0;
  const showFreeShippingBanner =
    deliverable && shipping !== null && shipping > 0 && amountToFreeShipping > 0;

  const applyDisabled = applyingCoupon || !coupon.trim();

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-14" style={{ background: PAPER }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <h1 className="text-[24px] sm:text-[28px] mb-7" style={{ fontFamily: FONT_SERIF, color: TEAL }}>
        Checkout
      </h1>

      {showFreeShippingBanner && (
        <div
          className="text-xs py-2.5 px-4 mb-6"
          style={{ background: WASH, color: INK_SOFT, borderRadius: '3px' }}
        >
          Add <strong style={{ color: TEAL }}>{formatINR(amountToFreeShipping)}</strong> more to get{' '}
          <strong style={{ color: TEAL }}>free shipping</strong>
        </div>
      )}

      {!deliverable && form.state && (
        <div
          className="text-xs py-2.5 px-4 mb-6"
          style={{ background: RUST_WASH, color: RUST, borderRadius: '3px' }}
        >
          Sorry, we don&apos;t deliver to <strong>{form.state}</strong> yet. Please choose another state.
        </div>
      )}

      <div className="flex flex-col gap-8 sm:grid sm:grid-cols-2 sm:gap-12">

        <div>
          <p className={sectionHeadClass} style={{ color: TEAL }}>Shipping Details</p>
          <div className="space-y-3">
            <SSRKInput placeholder="Full Name *" autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} />
            <SSRKInput placeholder="Phone Number *" type="tel" inputMode="numeric" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            <SSRKInput placeholder="Email (optional)" type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            <SSRKInput placeholder="Address Line 1 *" autoComplete="address-line1" value={form.line1} onChange={(e) => update('line1', e.target.value)} />
            <SSRKInput placeholder="Address Line 2" autoComplete="address-line2" value={form.line2} onChange={(e) => update('line2', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="City *"
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <select
                autoComplete="address-level1"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, color: form.state ? INK : INK_SOFT }}
              >
                <option value="">State *</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Pincode *"
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                value={form.pincode}
                onChange={(e) => update('pincode', e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
              <input
                placeholder="Landmark"
                value={form.landmark}
                onChange={(e) => update('landmark', e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">

          <div>
            <p className={sectionHeadClass} style={{ color: TEAL }}>Order Summary</p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1 gap-2" style={{ color: INK_SOFT }}>
                  <span className="truncate">
                    {i.name} ({[i.color, i.packDetails ? '' : i.size, i.sleeveType, i.zipType].filter(Boolean).join('/')}) ×{i.qty}
                    {i.isCombo && i.pieces > 1 ? ` · ${i.qty * i.pieces} pcs` : ''}
                  </span>
                  <span className="shrink-0" style={{ color: INK }}>{formatINR(i.price * i.qty)}</span>
                </div>
              ))}
            </div>

            {/* Coupon: user types the code, then applies it */}
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  placeholder="Coupon code"
                  value={coupon}
                  disabled={Boolean(appliedCoupon) || applyingCoupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && !appliedCoupon && applyCoupon()}
                  autoCapitalize="characters"
                  className={`${inputClass} flex-1 uppercase`}
                  style={{ ...inputStyle, opacity: appliedCoupon ? 0.7 : 1 }}
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="px-4 text-sm shrink-0 transition-colors"
                    style={{ border: `1px solid ${LINE}`, color: INK_SOFT, background: PAPER, borderRadius: '3px' }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => applyCoupon()}
                    disabled={applyDisabled}
                    className="px-4 text-sm shrink-0 transition-colors disabled:cursor-not-allowed"
                    style={{
                      border: `1px solid ${applyDisabled ? TEAL_DISABLED : TEAL}`,
                      color: applyDisabled ? TEAL_DISABLED : TEAL,
                      background: PAPER,
                      borderRadius: '3px',
                    }}
                  >
                    {applyingCoupon ? 'Applying…' : 'Apply'}
                  </button>
                )}
              </div>
              {appliedCoupon && (
                <p className="text-xs mt-1.5" style={{ color: TEAL }}>
                  {appliedCoupon} applied. You saved {formatINR(discount)}
                </p>
              )}
            </div>

            <div style={{ height: '1px', background: LINE }} className="my-4" />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between" style={{ color: INK_SOFT }}>
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between" style={{ color: TEAL }}>
                  <span>Discount{appliedCoupon ? ` (${appliedCoupon})` : ''}</span>
                  <span>−{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between" style={{ color: INK_SOFT }}>
                <span>Shipping</span>
                <span>
                  {!deliverable
                    ? <span style={{ color: RUST }}>Not available for {form.state}</span>
                    : shippingLoading
                      ? <span style={{ color: INK_SOFT, opacity: 0.6 }}>Calculating…</span>
                      : shipping === 0
                        ? <span style={{ color: TEAL }}>Free</span>
                        : shipping !== null
                          ? formatINR(shipping)
                          : <span style={{ color: INK_SOFT, opacity: 0.6 }}>—</span>
                  }
                </span>
              </div>
            </div>

            <div className="flex justify-between mt-3 pt-3 text-base" style={{ borderTop: `1px solid ${LINE}` }}>
              <span style={{ color: INK }}>Total</span>
              <span style={{ color: TEAL, fontFamily: FONT_SERIF }}>
                {deliverable && total !== null ? formatINR(total) : '—'}
              </span>
            </div>
          </div>

          <div>
            <p className={sectionHeadClass} style={{ color: TEAL }}>Payment Method</p>
            <label className="flex items-center gap-3 text-sm cursor-pointer" style={{ color: INK }}>
              <input
                type="radio"
                checked={paymentMethod === 'razorpay'}
                onChange={() => setPaymentMethod('razorpay')}
                className="w-4 h-4"
                style={{ accentColor: TEAL }}
              />
              Pay Online (Cards / UPI / Netbanking)
            </label>
          </div>

          <button
            onClick={placeOrder}
            disabled={placeOrderDisabled}
            className="w-full py-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed"
            style={{
              background: placeOrderDisabled ? TEAL_DISABLED : TEAL,
              color: PAPER,
              borderRadius: '4px',
            }}
          >
            {submitting
              ? (checkingStock ? 'Checking stock…' : 'Placing Order…')
              : !deliverable
                ? 'Not deliverable to this state'
                : shippingLoading
                  ? 'Calculating shipping…'
                  : total !== null
                    ? `Place Order — ${formatINR(total)}`
                    : 'Place Order'
            }
          </button>
        </div>
      </div>
    </div>
  );
}