import './globals.css';
import { Playfair_Display, Poppins } from 'next/font/google';
import { unstable_cache } from 'next/cache';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from '@/components/CartContext';
import { WishlistProvider } from '@/components/WhishlistContext';
// import BottomNav from '@/components/BottomNav';
import { dbConnect } from '@/lib/mongodb';
import Settings from '@/models/Settings';

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

const body = Poppins({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

// Cached for 1 hour. Call revalidateTag('settings') after saving settings in admin.
const getSeoSettings = unstable_cache(
  async () => {
    try {
      await dbConnect();
      const s = await Settings.findOne({ key: 'global' })
        .select('seoTitle seoDescription')
        .lean();
      return s
        ? { seoTitle: s.seoTitle || null, seoDescription: s.seoDescription || null }
        : null;
    } catch {
      return null;
    }
  },
  ['global-seo-settings'],
  { revalidate: 3600, tags: ['settings'] }
);

export async function generateMetadata() {
  const settings = await getSeoSettings();

  const title = settings?.seoTitle || 'Tirupur Clothing Hub - Women Kurtis, Nighties & More';
  const description =
    settings?.seoDescription ||
    'Shop authentic women kurtis, nighties, innerwear and trending collections online from Tirupur Clothing Hub.';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tirupurclothinghub.com';

  return {
    title: { default: title, template: '%s | Tirupur Clothing Hub' },
    description,
    metadataBase: new URL(siteUrl),
    keywords: ['women kurtis online', 'nighties online', 'innerwear online', 'Tirupur Clothing Hub', 'women fashion'],
    openGraph: { title, description, siteName: 'Tirupur Clothing Hub', type: 'website' },
    icons: { icon: '/favicon.ico' },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* background comes from globals.css (white) */}
      <body className={`${display.variable} ${body.variable} font-body antialiased`}>
        <CartProvider>
          <WishlistProvider>
            {children}

            {/* spacer so page content isn't hidden behind the fixed mobile nav */}
            <div className="md:hidden h-16" />

            {/* <BottomNav /> */}
          </WishlistProvider>
        </CartProvider>

        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-body)',
              background: '#fff',
              color: '#241B21',
              border: '1px solid #EEE3DA',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
            },
            success: {
              iconTheme: { primary: '#D9946A', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#C17F55', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  );
}