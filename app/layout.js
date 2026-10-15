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

const SITE_NAME = 'Shea Fashions';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sheafashions.in';
const DEFAULT_TITLE = 'Shea Fashions - Women Kurtis, Nighties & Innerwear Online';
const DEFAULT_DESCRIPTION =
  'Shop authentic women kurtis, nighties, innerwear and trending collections online from Shea Fashions. Comfortable fits, quality fabrics and great prices with delivery across India.';
// Place a 1200x630 image at /public/og-image.jpg
const DEFAULT_OG_IMAGE = '/og-image.jpg';

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

  const title = settings?.seoTitle || DEFAULT_TITLE;
  const description = settings?.seoDescription || DEFAULT_DESCRIPTION;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description,
    applicationName: SITE_NAME,
    keywords: [
      'women kurtis online',
      'kurtis for women',
      'cotton kurtis',
      'nighties online',
      'night wear for women',
      'innerwear online',
      'ladies innerwear',
      'Shea Fashions',
      'women fashion India',
    ],
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: 'fashion',
    alternates: {
      canonical: '/',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: 'en_IN',
      type: 'website',
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - Women Kurtis, Nighties & More`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
    // Add NEXT_PUBLIC_GOOGLE_VERIFICATION to .env to verify Google Search Console
    verification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION }
      : undefined,
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

// Structured data (JSON-LD) so Google can understand the brand and site
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      // Add your social profile URLs here, e.g. Instagram, Facebook
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: 'en-IN',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN">
      {/* background comes from globals.css (white) */}
      <body className={`${display.variable} ${body.variable} font-body antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />

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