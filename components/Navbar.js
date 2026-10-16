'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Menu, X, ChevronDown, ClipboardList, Heart, MessageCircle, Info } from 'lucide-react';
import { useCart } from './CartContext';
import { useWishlist } from './WhishlistContext';
import CouponMarquee from './CouponMarquee';

const STORE_NAME = 'Shea Fashions';

// WhatsApp number that receives bulk enquiries: country code + number, digits only
// (example: 919876543210). Set NEXT_PUBLIC_WHATSAPP_NUMBER in .env.local, or pass
// a `whatsappNumber` prop to <Navbar />.
const DEFAULT_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919092955054';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
// Keep these tokens in sync with CouponMarquee.
const TEAL = '#064E4A';        // deep teal: dropdown rule, badge text, primary button
const INK = '#172A29';         // primary text
const INK_FAINT = '#6B7C7A';   // secondary text (muted tint of INK)
const GOLD = '#C49A45';        // hover / active / badges
const HAIRLINE = '#E7DCC5';    // sand borders
const PAPER = '#FFFDF5';       // cream background
const RUST = '#B0503A';        // form errors
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

const SHOP_GROUPS = [
  { key: 'bestseller', label: 'Best Sellers', qs: 'flag=bestseller' },
  { key: 'topseller', label: 'Top Sellers', qs: 'flag=topseller' },
  { key: 'newarrival', label: 'New Arrivals', qs: 'flag=newarrival' },
];

// ── Bulk enquiry modal: collects details and opens WhatsApp with a prefilled message ──
function SelectField({ value, onChange, disabled, style, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full appearance-none pl-3.5 pr-9 py-2.5 text-sm outline-none disabled:opacity-50"
        style={style}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={1.5}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: INK_FAINT }}
      />
    </div>
  );
}

// `products` = [{ _id, name, category }] where `category` is a category/subcategory
// _id or slug (or a populated { _id, slug } object).
function BulkEnquiryModal({ whatsappNumber, categories, products, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', quantity: '', details: '' });
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [error, setError] = useState('');

  // Resolve the chosen category (main or sub) to a label plus the nodes whose
  // products should be listed. A main category also includes its subcategories.
  let selectedCategory = null;
  for (const c of categories) {
    if (String(c._id) === categoryId) {
      selectedCategory = { label: c.name, nodes: [c, ...(c.subcategories || [])] };
      break;
    }
    const sub = c.subcategories?.find((s) => String(s._id) === categoryId);
    if (sub) {
      selectedCategory = { label: `${c.name} - ${sub.name}`, nodes: [sub] };
      break;
    }
  }

  const filteredProducts = selectedCategory
    ? products.filter((p) => {
        const key = String(p.category?._id ?? p.category ?? '');
        const slug = p.category?.slug ?? p.categorySlug;
        return selectedCategory.nodes.some(
          (n) => String(n._id) === key || n.slug === key || (slug && n.slug === slug)
        );
      })
    : [];

  const selectedProduct = products.find((p) => String(p._id) === productId);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setField(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.replace(/\D/g, '').slice(-10);
    const quantity = form.quantity.trim();

    if (!name) return setError('Please enter your name');
    if (phone.length !== 10) return setError('Enter a valid 10-digit phone number');
    if (!quantity) return setError('Please tell us the quantity you need');
    setError('');

    const lines = [
      `Hi ${STORE_NAME}, I'd like to make a bulk enquiry.`,
      '',
      `Name: ${name}`,
      `Phone: ${phone}`,
      selectedCategory && `Category: ${selectedCategory.label}`,
      selectedProduct && `Product: ${selectedProduct.name}`,
      `Quantity: ${quantity}`,
      form.details.trim() && `Details: ${form.details.trim()}`,
    ].filter((l) => l !== false);

    const number = String(whatsappNumber).replace(/\D/g, '');
    const url = `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  }

  const inputStyle = {
    border: `1px solid ${HAIRLINE}`,
    borderRadius: '3px',
    color: INK,
    background: PAPER,
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:px-4"
      style={{ background: 'rgba(23,42,41,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Bulk enquiry"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md p-6 max-h-[92vh] overflow-y-auto"
        style={{ background: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: '4px' }}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-[22px]" style={{ fontFamily: FONT_SERIF, color: INK }}>
            Bulk enquiry
          </h2>
          <button type="button" onClick={onClose} className="p-1 -mr-1" style={{ color: INK }} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <p className="text-sm mb-5" style={{ color: INK_FAINT }}>
          Share what you need and we&rsquo;ll reply on WhatsApp with bulk pricing.
        </p>

        <div className="space-y-3">
          <input
            value={form.name}
            onChange={setField('name')}
            placeholder="Your name"
            autoComplete="name"
            className="w-full px-3.5 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={setField('phone')}
            placeholder="10-digit phone number"
            maxLength={10}
            autoComplete="tel"
            className="w-full px-3.5 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
          <SelectField
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setProductId('');
            }}
            style={{ ...inputStyle, color: categoryId ? INK : INK_FAINT }}
          >
            <option value="">Select category (optional)</option>
            {categories.map((c) =>
              c.subcategories?.length > 0 ? (
                <optgroup key={c._id} label={c.name}>
                  <option value={String(c._id)}>All {c.name}</option>
                  {c.subcategories.map((sub) => (
                    <option key={sub._id} value={String(sub._id)}>{sub.name}</option>
                  ))}
                </optgroup>
              ) : (
                <option key={c._id} value={String(c._id)}>{c.name}</option>
              )
            )}
          </SelectField>

          {products.length > 0 && (
            <SelectField
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={!selectedCategory}
              style={{ ...inputStyle, color: productId ? INK : INK_FAINT }}
            >
              <option value="">
                {!selectedCategory
                  ? 'Select a category first'
                  : filteredProducts.length
                    ? 'Any product in this category'
                    : 'No products in this category'}
              </option>
              {filteredProducts.map((p) => (
                <option key={p._id} value={String(p._id)}>{p.name}</option>
              ))}
            </SelectField>
          )}
          <input
            value={form.quantity}
            onChange={setField('quantity')}
            placeholder="Quantity needed (e.g. 100 pieces)"
            className="w-full px-3.5 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
          <textarea
            rows={3}
            value={form.details}
            onChange={setField('details')}
            placeholder="Anything else? Sizes, colors, delivery city (optional)"
            className="w-full px-3.5 py-2.5 text-sm outline-none resize-none"
            style={inputStyle}
          />
        </div>

        {error && <p className="text-sm mt-3" style={{ color: RUST }}>{error}</p>}

        <button
          type="submit"
          className="w-full mt-5 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-opacity active:opacity-80"
          style={{ background: TEAL, color: PAPER, borderRadius: '4px' }}
        >
          <MessageCircle size={16} strokeWidth={1.75} /> Send on WhatsApp
        </button>
      </form>
    </div>
  );
}

// `categories` = main categories, each with its own `subcategories` array.
// It is loaded and cached on the server (see lib/navCategories.js and the shop
// layout), so the browser no longer calls /api/categories on every page view.
export default function Navbar({ categories = [], products = [], whatsappNumber = DEFAULT_WHATSAPP_NUMBER }) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [mobileGroupOpen, setMobileGroupOpen] = useState(null);
  const [mobileCatOpen, setMobileCatOpen] = useState(null); // `${groupKey}:${categoryId}` of the expanded subcategory list

  const closeTimer = useRef(null);

  const router = useRouter();
  const { count } = useCart();
  const { wishlist } = useWishlist();
  const wishlistCount = wishlist?.length || 0;

  // Lock background scroll while the full-screen mobile menu is open,
  // so the homepage doesn't scroll/run underneath it.
  useEffect(() => {
    if (menuOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [menuOpen]);

  // Same scroll lock while the bulk enquiry modal is open
  useEffect(() => {
    if (!enquiryOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [enquiryOpen]);

  function onSearch(e) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  }

  function openShop() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShopOpen(true);
  }
  function scheduleCloseShop() {
    closeTimer.current = setTimeout(() => setShopOpen(false), 150);
  }

  function categoryHref(slug, qs) {
    return `/category/${slug}?${qs}`;
  }

  function closeMobileMenu() {
    setMenuOpen(false);
    setMobileGroupOpen(null);
    setMobileCatOpen(null);
  }

  function openEnquiry() {
    closeMobileMenu();
    setShopOpen(false);
    setEnquiryOpen(true);
  }

  return (
    <>
      <CouponMarquee />

      <header className="sticky top-0 z-50" style={{ background: PAPER, borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-3 items-center">
            {/* Left: mobile toggle + primary links */}
            <div className="flex items-center gap-1 justify-self-start">
              <button
                className="md:hidden p-2 -ml-2"
                style={{ color: INK }}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
              >
                {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
              </button>

              <nav className="hidden md:flex items-center gap-8">
                <Link
                  href="/"
                  className="text-[13px] font-normal tracking-[1.5px] uppercase transition-colors"
                  style={{ color: INK }}
                >
                  Home
                </Link>

                <div className="relative" onMouseEnter={openShop} onMouseLeave={scheduleCloseShop}>
                  <button
                    className="text-[13px] font-normal tracking-[1.5px] uppercase transition-colors"
                    style={{ color: shopOpen ? GOLD : INK }}
                  >
                    Shop
                  </button>

                  {shopOpen && categories.length > 0 && (
                    <div className="absolute left-0 top-full pt-5" style={{ width: '620px' }}>
                      <div
                        style={{ background: PAPER, borderTop: `1px solid ${TEAL}` }}
                        className="py-6 px-6 grid grid-cols-3 gap-8 max-h-[70vh] overflow-y-auto"
                      >
                        {SHOP_GROUPS.map((group) => (
                          <div key={group.key}>
                            <div
                              className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-3 pb-2"
                              style={{ color: TEAL, borderBottom: `1px solid ${HAIRLINE}` }}
                            >
                              {group.label}
                            </div>
                            <div className="flex flex-col gap-2.5">
                              {categories.map((c) => (
                                <div key={c._id}>
                                  <Link
                                    href={categoryHref(c.slug, group.qs)}
                                    prefetch={false}
                                    onClick={() => setShopOpen(false)}
                                    className="py-0.5 text-[13px] font-medium tracking-wide transition-colors block"
                                    style={{ color: INK }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
                                  >
                                    {c.name}
                                  </Link>

                                  {c.subcategories?.length > 0 && (
                                    <div className="flex flex-col mt-1 pl-3" style={{ borderLeft: `1px solid ${HAIRLINE}` }}>
                                      {c.subcategories.map((sub) => (
                                        <Link
                                          key={sub._id}
                                          href={categoryHref(sub.slug, group.qs)}
                                          prefetch={false}
                                          onClick={() => setShopOpen(false)}
                                          className="py-1 text-[12px] tracking-wide transition-colors"
                                          style={{ color: INK_FAINT }}
                                          onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
                                          onMouseLeave={(e) => (e.currentTarget.style.color = INK_FAINT)}
                                        >
                                          {sub.name}
                                        </Link>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href="/orders"
                  className="text-[13px] font-normal tracking-[1.5px] uppercase transition-colors"
                  style={{ color: INK }}
                >
                  Orders
                </Link>

                <Link
                  href="/about"
                  className="text-[13px] font-normal tracking-[1.5px] uppercase transition-colors"
                  style={{ color: INK }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
                >
                  About
                </Link>

                <button
                  type="button"
                  onClick={openEnquiry}
                  className="text-[13px] font-normal tracking-[1.5px] uppercase transition-colors"
                  style={{ color: INK }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = INK)}
                >
                  Bulk Enquiry
                </button>
              </nav>
            </div>

            {/* Center: logo */}
            <Link href="/" className="flex items-center justify-self-center">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36">
                {/* `sizes` stops Next from generating huge srcset variants for a small logo */}
                <Image
                  src="/logo.png"
                  alt={STORE_NAME}
                  fill
                  sizes="(min-width: 640px) 144px, 112px"
                  className="object-contain"
                  priority
                />
              </div>
            </Link>

            {/* Right: search + wishlist + cart */}
            <div className="flex items-center gap-2.5 justify-self-end">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                style={{ color: INK, border: `1px solid ${HAIRLINE}` }}
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search"
              >
                <Search size={16} strokeWidth={1.5} />
              </button>

              {/* <Link
                href="/wishlist"
                className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                style={{ color: INK, border: `1px solid ${HAIRLINE}` }}
                aria-label="Wishlist"
              >
                <Heart size={16} strokeWidth={1.5} />
                {wishlistCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 text-[9px] font-semibold rounded-full w-[16px] h-[16px] flex items-center justify-center"
                    style={{ background: GOLD, color: INK }}
                  >
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </Link> */}

              <Link
                href="/cart"
                className="relative flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                style={{ color: INK, border: `1px solid ${HAIRLINE}` }}
                aria-label="Cart"
              >
                <ShoppingBag size={16} strokeWidth={1.5} />
                {count > 0 && (
                  <span
                    className="absolute -top-1 -right-1 text-[9px] font-semibold rounded-full w-[16px] h-[16px] flex items-center justify-center"
                    style={{ background: GOLD, color: INK }}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {searchOpen && (
            <form
              onSubmit={onSearch}
              className="flex items-center gap-2 py-3 mb-1"
              style={{ borderTop: `1px solid ${HAIRLINE}` }}
            >
              <Search size={15} strokeWidth={1.5} style={{ color: INK_FAINT }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search kurtis, nighties, innerwear..."
                className="bg-transparent outline-none w-full text-sm"
                style={{ color: INK }}
              />
            </form>
          )}
        </div>
      </header>

      {/* Mobile menu: full-screen overlay, not inline, so the homepage
          doesn't sit (or scroll) behind it while open. */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] flex flex-col"
          style={{ background: PAPER }}
        >
          {/* Overlay header: logo + close button, mirrors the main header height */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <div className="relative w-16 h-16">
              <Image
                src="/logo.png"
                alt={STORE_NAME}
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
            <button
              className="p-2 -mr-2"
              style={{ color: INK }}
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              <X size={22} strokeWidth={1.5} />
            </button>
          </div>

          {/* Scrollable menu body: only this area scrolls, page behind stays fixed */}
          <nav className="flex-1 overflow-y-auto flex flex-col px-6 py-2">
            <Link
              href="/"
              onClick={closeMobileMenu}
              className="py-3.5 text-[14px] tracking-[1.5px] uppercase"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              Home
            </Link>

            <div
              className="py-3.5 text-[14px] tracking-[1.5px] uppercase"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              Shop
            </div>

            {SHOP_GROUPS.map((group) => (
              <div key={group.key} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <button
                  className="w-full flex items-center justify-between py-3 pl-3 text-[13px] tracking-wide uppercase"
                  style={{ color: mobileGroupOpen === group.key ? GOLD : INK_FAINT }}
                  onClick={() => setMobileGroupOpen((v) => (v === group.key ? null : group.key))}
                >
                  {group.label}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.5}
                    style={{
                      transform: mobileGroupOpen === group.key ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 150ms ease',
                    }}
                  />
                </button>

                {mobileGroupOpen === group.key && (
                  <div className="flex flex-col pb-3">
                    {categories.map((c) => {
                      const catKey = `${group.key}:${c._id}`;
                      const hasSubs = c.subcategories?.length > 0;
                      const isCatOpen = mobileCatOpen === catKey;
                      return (
                        <div key={c._id} className="flex flex-col">
                          <div className="flex items-center">
                            <Link
                              href={categoryHref(c.slug, group.qs)}
                              prefetch={false}
                              onClick={closeMobileMenu}
                              className="flex-1 py-2.5 pl-6 text-[13px] tracking-wide"
                              style={{ color: INK_FAINT }}
                            >
                              {c.name}
                            </Link>
                            {hasSubs && (
                              <button
                                onClick={() => setMobileCatOpen((v) => (v === catKey ? null : catKey))}
                                className="px-3 py-2.5"
                                aria-label={`Toggle ${c.name} subcategories`}
                              >
                                <ChevronDown
                                  size={12}
                                  strokeWidth={1.5}
                                  style={{
                                    color: INK_FAINT,
                                    transform: isCatOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 150ms ease',
                                  }}
                                />
                              </button>
                            )}
                          </div>

                          {hasSubs && isCatOpen && (
                            <div className="flex flex-col pb-1.5">
                              {c.subcategories.map((sub) => (
                                <Link
                                  key={sub._id}
                                  href={categoryHref(sub.slug, group.qs)}
                                  prefetch={false}
                                  onClick={closeMobileMenu}
                                  className="py-2 pl-10 text-[12.5px] tracking-wide"
                                  style={{ color: INK_FAINT }}
                                >
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <Link
              href="/orders"
              onClick={closeMobileMenu}
              className="flex items-center justify-between py-3.5 text-[14px] tracking-[1.5px] uppercase"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <span className="flex items-center gap-2.5">
                <ClipboardList size={16} strokeWidth={1.5} />
                Orders
              </span>
            </Link>

            <Link
              href="/about"
              onClick={closeMobileMenu}
              className="flex items-center justify-between py-3.5 text-[14px] tracking-[1.5px] uppercase"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <span className="flex items-center gap-2.5">
                <Info size={16} strokeWidth={1.5} />
                About Us
              </span>
            </Link>

            <button
              type="button"
              onClick={openEnquiry}
              className="flex items-center justify-between py-3.5 text-[14px] tracking-[1.5px] uppercase text-left"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <span className="flex items-center gap-2.5">
                <MessageCircle size={16} strokeWidth={1.5} />
                Bulk Enquiry
              </span>
            </button>

            <Link
              href="/wishlist"
              onClick={closeMobileMenu}
              className="flex items-center justify-between py-3.5 text-[14px] tracking-[1.5px] uppercase"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <span className="flex items-center gap-2.5">
                <Heart size={16} strokeWidth={1.5} />
                Wishlist
              </span>
              {wishlistCount > 0 && (
                <span
                  className="text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                  style={{ background: GOLD, color: INK }}
                >
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>

            <Link
              href="/cart"
              onClick={closeMobileMenu}
              className="flex items-center justify-between py-3.5 text-[14px] tracking-[1.5px] uppercase"
              style={{ color: INK, borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <span className="flex items-center gap-2.5">
                <ShoppingBag size={16} strokeWidth={1.5} />
                Cart
              </span>
              {count > 0 && (
                <span
                  className="text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                  style={{ background: GOLD, color: INK }}
                >
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>
          </nav>
        </div>
      )}

      {enquiryOpen && (
        <BulkEnquiryModal
          whatsappNumber={whatsappNumber}
          categories={categories}
          products={products}
          onClose={() => setEnquiryOpen(false)}
        />
      )}
    </>
  );
}