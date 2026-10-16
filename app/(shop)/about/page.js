import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';

// Same tokens as Navbar / CouponMarquee
const TEAL = '#064E4A';
const INK = '#172A29';
const INK_FAINT = '#6B7C7A';
const GOLD = '#C49A45';
const HAIRLINE = '#E7DCC5';
const PAPER = '#FFFDF5';
const FONT_SERIF = "Georgia, 'Times New Roman', serif";

// Refresh the shop button's category at most once an hour
export const revalidate = 3600;

// Link to New Arrivals in the first active main category (same sort order as the
// navbar). Falls back to the homepage if the lookup fails or there are no categories.
async function getShopHref() {
  try {
    await dbConnect();
    const first = await Category.findOne({ isActive: true, parent: null })
      .sort({ sortOrder: 1, name: 1 })
      .select('slug')
      .lean();
    return first?.slug ? `/category/${first.slug}?flag=newarrival` : '/';
  } catch {
    return '/';
  }
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919092955054';

export const metadata = {
  title: 'About Us | Shea Fashions',
  description:
    'Meet Jeni Jacob, founder of Shea Fashions. Exclusive sarees, kurtis and salwar materials, with custom and bulk orders and shipping across India and worldwide.',
};

const HIGHLIGHTS = [
  {
    title: 'Exclusive and trendy collections',
    text: 'Sarees, kurtis, salwar materials and more, picked to suit your style.',
  },
  {
    title: 'Quality fabrics for every occasion',
    text: 'From everyday wear to festive days, each piece is chosen for how it feels and lasts.',
  },
  {
    title: 'Customised orders',
    text: 'Tell us what you have in mind and we will help shape it to your preferences.',
  },
  {
    title: 'Bulk orders accepted',
    text: 'Ordering for a family function, a group or your own store? We are happy to help.',
  },
  {
    title: 'Shipping across India and abroad',
    text: 'We deliver all over India, and international shipping is available.',
  },
];

export default async function AboutPage() {
  const shopHref = await getShopHref();
  const bulkUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Hi Shea Fashions, I would like to know more about bulk orders.'
  )}`;

  return (
    <main style={{ background: PAPER, color: INK }}>
      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <p className="text-[15px] mb-4" style={{ color: GOLD, fontFamily: FONT_SERIF, fontStyle: 'italic' }}>
          Sculpt Ur Wardrobe
        </p>
        <h1
          className="text-[34px] sm:text-[48px] leading-[1.15]"
          style={{ fontFamily: FONT_SERIF, color: INK }}
        >
          Welcome to Shea Fashions
        </h1>
        <div className="mx-auto mt-6 mb-6 h-px w-16" style={{ background: GOLD }} />
        <p className="text-[16px] sm:text-[17px] leading-[1.85]" style={{ color: INK_FAINT }}>
          A passion for fashion, now five years into its journey, grown through your trust, love and
          continuous support.
        </p>
      </section>

      {/* Founder story */}
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="max-w-3xl mx-auto px-6 py-14 sm:py-20">
          <h2 className="text-[26px] sm:text-[30px] mb-6" style={{ fontFamily: FONT_SERIF, color: TEAL }}>
            Hi, I&rsquo;m Jeni Jacob
          </h2>
          <div
            className="space-y-5 text-[16px] leading-[1.9]"
            style={{ fontFamily: FONT_SERIF, color: INK }}
          >
            <p>
              I&rsquo;m a woman entrepreneur and a proud mom of two, and I turned my passion for fashion
              into a business.
            </p>
            <p>
              For the past 5 years, Shea Fashions has been growing through online sales, your trust,
              love, and continuous support. What started as a passion has become a beautiful journey,
              and I&rsquo;m truly blessed to be part of this fashion world.
            </p>
            <p>
              At Shea Fashions, we bring you an exclusive and wide collection of sarees, kurtis, salwar
              materials, and more, carefully selected to suit your style and make every wardrobe
              special.
            </p>
            <p>
              We regularly share our latest collections and product videos across our social media
              platforms, so you always know about new arrivals and trending styles.
            </p>
          </div>
        </div>
      </section>

      {/* What makes us special */}
      <section className="max-w-5xl mx-auto px-6 py-14 sm:py-20">
        <h2
          className="text-[26px] sm:text-[30px] text-center mb-10 sm:mb-12"
          style={{ fontFamily: FONT_SERIF, color: INK }}
        >
          What makes Shea Fashions special
        </h2>

        <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="pl-4" style={{ borderLeft: `2px solid ${GOLD}` }}>
              <h3 className="text-[17px] mb-1.5" style={{ fontFamily: FONT_SERIF, color: TEAL }}>
                {item.title}
              </h3>
              <p className="text-[14px] leading-[1.75]" style={{ color: INK_FAINT }}>
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Call to action */}
      <section style={{ background: TEAL }}>
        <div className="max-w-3xl mx-auto px-6 py-14 sm:py-16 text-center">
          <h2 className="text-[26px] sm:text-[30px] mb-3" style={{ fontFamily: FONT_SERIF, color: PAPER }}>
            Find something for your wardrobe
          </h2>
          <p className="text-[15px] leading-[1.8] mb-8" style={{ color: HAIRLINE }}>
            Browse the latest collections, or message us for custom and bulk orders.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={shopHref}
              className="w-full sm:w-auto px-7 py-3 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: GOLD, color: INK, borderRadius: '4px' }}
            >
              Shop new arrivals
            </Link>
            <a
              href={bulkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ border: `1px solid ${HAIRLINE}`, color: PAPER, borderRadius: '4px' }}
            >
              <MessageCircle size={16} strokeWidth={1.75} /> Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}