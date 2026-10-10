import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { getNavCategories } from '@/lib/navCategories';

export default async function ShopLayout({ children }) {
  // Cached on the server, so the navbar needs no /api/categories call per visitor
  const categories = await getNavCategories();

  return (
    <>
      <Navbar categories={categories} />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <WhatsAppButton phone="919092955054" />
    </>
  );
}