import { MapPin } from 'lucide-react';
import { Fraunces, Inter } from 'next/font/google';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';
import FooterLinks from './FooterLinks';

const display = Fraunces({ subsets: ['latin'], weight: ['400'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-body' });

// Business details
const STORE_NAME = 'Shea Fashions';
const BRAND_NAME = 'Aari by SHEA';
const PHONES = ['9092955054', '9500578743'];

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
// Deep teal footer with cream text and gold accents. Keep in sync with FooterLinks.
const BG = '#064E4A';
const ACCENT = '#C49A45';
const TEXT = '#FFFDF5';
const TEXT_SOFT = 'rgba(255,253,245,0.72)';
const LINE = 'rgba(255,253,245,0.18)';

async function getCategories() {
  await dbConnect();
  const categories = await Category.find({}).select('name slug').lean();
  return JSON.parse(JSON.stringify(categories));
}

export default async function Footer() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP || '919092955054';
  // Leave NEXT_PUBLIC_INSTAGRAM and NEXT_PUBLIC_EMAIL unset to hide them in the footer.
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM || '';
  const email = process.env.NEXT_PUBLIC_EMAIL || '';
  const categories = await getCategories();

  const quickLinks = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Wishlist', href: '/wishlist' },
    // { label: 'Contact', href: '/contact' },
  ];

  return (
    <footer className={`${body.className} mt-16`} style={{ background: BG }}>
      <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 sm:grid-cols-12 gap-10 sm:gap-8">

        {/* Brand column */}
        <div className="sm:col-span-4">
          <h3 className={`${display.className} text-2xl leading-tight`} style={{ color: TEXT, fontWeight: 400 }}>
            {STORE_NAME}
          </h3>
          <p className="text-[11px] font-normal tracking-wide mb-4" style={{ color: ACCENT }}>
            {BRAND_NAME} &middot; Wholesale &amp; Retail
          </p>

          <p className="flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: TEXT_SOFT }}>
            <MapPin size={13} className="shrink-0 mt-0.5" style={{ color: ACCENT }} />
            <span>
              7/7, Opp. Mariyamman Kovil Gate,<br />
              Samundipuram Bus Stop, Gandhi Nagar PO,<br />
              Tirupur - 641603
            </span>
          </p>

          <p className="inline-flex items-center gap-1.5 mt-4 text-[11px] font-normal tracking-wide" style={{ color: TEXT_SOFT }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            Online sales only
          </p>
        </div>

        {/* Shop / Quick Links / Connect — accordion on mobile, columns on desktop */}
        <FooterLinks
          categories={categories}
          quickLinks={quickLinks}
          whatsapp={whatsapp}
          instagram={instagram}
          phones={PHONES}
          email={email}
        />
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: `1px solid ${LINE}` }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px]" style={{ color: TEXT_SOFT }}>
            © {new Date().getFullYear()} {STORE_NAME}. All rights reserved.
          </p>

          <a
            href="https://www.nexirasolution.in"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-75"
            style={{ color: TEXT_SOFT }}
          >
            Designed and developed by
            <span className="font-medium text-[11px] tracking-wide" style={{ color: ACCENT }}>
              Nexira Solution
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}