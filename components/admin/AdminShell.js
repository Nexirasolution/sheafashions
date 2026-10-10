'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ListTree, ShoppingCart, Boxes, Image as ImageIcon,
  Clapperboard, Star, Ticket, Layers, FileBarChart, Settings as SettingsIcon, Menu, X, LogOut
} from 'lucide-react';

// Design tokens — same teal / gold / cream system as the rest of the site.
// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const INK_SOFT = '#6B7C7A';
const TEAL = '#064E4A';
const WASH = '#F5EFE0';   // hover fill (light tint of sand)
const LINE = '#E7DCC5';
const PAPER = '#FFFDF5';

const NAV = [
  { href: '/admin',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/products',   label: 'Products',      icon: Package },
  { href: '/admin/categories', label: 'Categories',    icon: ListTree },
  { href: '/admin/orders',     label: 'Orders',        icon: ShoppingCart },
  { href: '/admin/inventory',  label: 'Inventory',     icon: Boxes },
  { href: '/admin/combos',     label: 'Combo Offers',  icon: Layers },
  { href: '/admin/banners',    label: 'Banners',       icon: ImageIcon },
  { href: '/admin/reels',      label: 'Shop by Reels', icon: Clapperboard },
  { href: '/admin/reviews',    label: 'Reviews',       icon: Star },
  { href: '/admin/coupons',    label: 'Coupons',       icon: Ticket },
  { href: '/admin/reports',    label: 'Sales Reports', icon: FileBarChart },
  { href: '/admin/settings',   label: 'Settings',      icon: SettingsIcon },
];

export default function AdminShell({ admin, children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <div className="min-h-screen flex" style={{ background: PAPER }}>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(23,42,41,0.4)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-50 inset-y-0 left-0 w-64 transform transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: PAPER,
          borderRight: `1px solid ${LINE}`,
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${LINE}` }}
        >
          <div className="flex flex-col leading-tight">
            <span className="font-medium text-base" style={{ color: TEAL }}>
              Shea Fashions
            </span>
            <span
              className="text-[10px] tracking-widest uppercase mt-0.5"
              style={{ color: INK_SOFT }}
            >
              Admin Panel
            </span>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
            style={{ color: INK_SOFT }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100vh-65px)]">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  borderRadius: '4px',
                  background: active ? TEAL : 'transparent',
                  color: active ? PAPER : INK_SOFT,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = WASH;
                    e.currentTarget.style.color = INK;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = INK_SOFT;
                  }
                }}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-3" style={{ height: '1px', background: LINE }} />

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium w-full transition-colors"
            style={{ borderRadius: '4px', color: INK_SOFT }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = WASH;
              e.currentTarget.style.color = INK;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = INK_SOFT;
            }}
          >
            <LogOut size={17} /> Logout
          </button>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Mobile topbar */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{
            background: PAPER,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <button onClick={() => setOpen(true)} style={{ color: INK }} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="font-medium text-base" style={{ color: TEAL }}>
            Shea Fashions Admin
          </span>
        </header>

        <main className="p-4 sm:p-6 max-w-6xl" style={{ color: INK }}>{children}</main>
      </div>
    </div>
  );
}