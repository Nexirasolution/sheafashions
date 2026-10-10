'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Heart, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/CartContext';
import { useWishlist } from '@/components/WhishlistContext';

// Design tokens — peach + coffee system: a light peach/cream field, a deep
// coffee tone for the default/active label and icon color, and a warm
// coffee accent reserved for the active indicator and badges.
const PEACH = '#F4E8E3';        // background — light peach/cream
const COFFEE_LIGHT = '#D9946A'; // accent — active underline, badge
const COFFEE_DARK = '#4A3226';  // icon + label color (dark, for contrast on light bg)
const LINE = 'rgba(74,50,38,0.12)';       // hairline top border

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/cart', label: 'Cart', icon: ShoppingBag },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const { wishlist } = useWishlist();

  // Admin pages have their own shell/navigation — never show the storefront
  // bottom nav (or its spacer) there.
  if (pathname?.startsWith('/admin')) return null;

  const wishlistCount = wishlist?.length || 0;

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.label === 'Wishlist' ? wishlistCount : item.label === 'Cart' ? cartCount : undefined,
  }));

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed mobile nav */}
      <div className="md:hidden h-16" />

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]"
        style={{ background: PEACH, borderTop: `1px solid ${LINE}` }}
      >
        <div className="flex items-stretch justify-between px-1">
          {items.map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pt-2.5 relative"
              >
                {active && (
                  <span
                    className="absolute top-0 left-[30%] right-[30%] h-[2px]"
                    style={{ background: COFFEE_LIGHT }}
                  />
                )}

                <span className="relative">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2 : 1.5}
                    style={{ color: COFFEE_DARK, opacity: active ? 1 : 0.55 }}
                    fill={active && label === 'Wishlist' ? COFFEE_DARK : 'none'}
                  />
                  {badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 text-[8px] font-semibold leading-none rounded-full min-w-[13px] h-[13px] flex items-center justify-center px-[3px]"
                      style={{ background: COFFEE_LIGHT, color: '#FFFFFF', border: `1px solid ${PEACH}` }}
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>

                <span
                  className="text-[9px] font-medium tracking-wide"
                  style={{ color: COFFEE_DARK, opacity: active ? 1 : 0.55 }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}