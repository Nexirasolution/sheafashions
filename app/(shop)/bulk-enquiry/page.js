'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

const GOLD = '#C9A227';
const INK = '#000000';
const INK_SOFT = '#6B6B6B';
const LINE = '#E8E8E8';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP || '919344430878';

const FALLBACK_PRODUCTS = ['Kurtis', 'Nighties', 'Innerwear', 'Other'];

const inputClass =
  'w-full px-4 py-3 text-sm bg-transparent outline-none transition-colors focus:border-black';

const inputStyle = { color: INK, border: `1px solid ${LINE}` };

// Defined OUTSIDE the page component so it isn't re-created on every render
// (re-creating it caused inputs to lose focus after each keystroke).
function Field({ error, children }) {
  return (
    <div>
      {children}
      {error && (
        <p className="text-[11px] mt-1" style={{ color: '#B00020' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function BulkEnquiryPage() {
  const [productTypes, setProductTypes] = useState(FALLBACK_PRODUCTS);
  const [form, setForm] = useState({
    name: '',
    email: '',
    address: '',
    pincode: '',
    phone: '',
    product: '',
    quantity: '',
    message: '',
    agree: false,
  });
  const [errors, setErrors] = useState({});

  // Use the store's own categories as product types, if available
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        const names = (d.topLevel || []).map((c) => c.name).filter(Boolean);
        if (names.length) setProductTypes([...names, 'Other']);
      })
      .catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Please enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.address.trim()) e.address = 'Please enter your address';
    if (!/^\d{6}$/.test(form.pincode.trim())) e.pincode = 'Enter a 6-digit pincode';
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, '').slice(-10)))
      e.phone = 'Enter a valid 10-digit phone number';
    if (!form.product) e.product = 'Select a product type';
    if (!form.quantity || Number(form.quantity) < 1) e.quantity = 'Enter the quantity required';
    if (!form.agree) e.agree = 'Please accept the Terms & Conditions';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;

    const lines = [
      '*Bulk Order Enquiry*',
      '',
      `*Name:* ${form.name.trim()}`,
      `*Email:* ${form.email.trim()}`,
      `*Phone:* ${form.phone.trim()}`,
      `*Address:* ${form.address.trim()}`,
      `*Pincode:* ${form.pincode.trim()}`,
      `*Product Type:* ${form.product}`,
      `*Quantity Required:* ${form.quantity}`,
    ];
    if (form.message.trim()) lines.push('', `*Message:* ${form.message.trim()}`);

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10 sm:py-14">
      <h1
        className="text-2xl sm:text-3xl text-center tracking-[2px] uppercase mb-2"
        style={{ color: INK }}
      >
        Bulk Order Enquiry
      </h1>
      <div className="w-12 h-[2px] mx-auto mb-8" style={{ background: GOLD }} />
      <p className="text-center text-sm mb-8" style={{ color: INK_SOFT }}>
        Fill in your details and we&apos;ll get back to you on WhatsApp.
      </p>

      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4 p-5 sm:p-8"
        style={{ border: `1px solid ${LINE}`, borderTop: `2px solid ${GOLD}` }}
      >
        <Field error={errors.name}>
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="First Name*"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>

        <Field error={errors.email}>
          <input
            type="email"
            className={inputClass}
            style={inputStyle}
            placeholder="Email*"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </Field>

        <Field error={errors.address}>
          <input
            className={inputClass}
            style={inputStyle}
            placeholder="Full Address*"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </Field>

        <Field error={errors.pincode}>
          <input
            inputMode="numeric"
            maxLength={6}
            className={inputClass}
            style={inputStyle}
            placeholder="Pincode*"
            value={form.pincode}
            onChange={(e) => update('pincode', e.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field error={errors.phone}>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            className={inputClass}
            style={inputStyle}
            placeholder="Phone Number*"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value.replace(/[^\d+\s]/g, ''))}
          />
        </Field>

        <Field error={errors.product}>
          <select
            className={inputClass}
            style={{ ...inputStyle, color: form.product ? INK : INK_SOFT }}
            value={form.product}
            onChange={(e) => update('product', e.target.value)}
          >
            <option value="">Product Type*</option>
            {productTypes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field error={errors.quantity}>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            className={inputClass}
            style={inputStyle}
            placeholder="Quantity Required*"
            value={form.quantity}
            onChange={(e) => update('quantity', e.target.value)}
          />
        </Field>

        <textarea
          rows={5}
          className={inputClass}
          style={inputStyle}
          placeholder="Message"
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
        />

        <Field error={errors.agree}>
          <label className="flex items-start gap-2.5 text-[13px] cursor-pointer" style={{ color: INK }}>
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-black shrink-0"
              checked={form.agree}
              onChange={(e) => update('agree', e.target.checked)}
            />
            <span>I agree to the Terms &amp; Conditions and Privacy Policy.*</span>
          </label>
        </Field>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium tracking-[1.5px] uppercase transition-opacity hover:opacity-85"
          style={{ background: INK, color: '#fff', borderBottom: `2px solid ${GOLD}` }}
        >
          <MessageCircle size={16} strokeWidth={1.75} />
          Submit
        </button>
      </form>
    </main>
  );
}