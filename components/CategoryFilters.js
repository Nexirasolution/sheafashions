'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Filters from '@/components/Filters';

// Thin client wrapper: keeps your existing <Filters> UI, but stores the choice
// in the URL (?sort= / ?flag=) so the server can render and cache each variant.
export default function CategoryFilters({ sort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onSortChange(value) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // back to page 1 whenever the sort changes

    if (value === 'newarrival') {
      params.set('flag', 'newarrival');
      params.delete('sort');
    } else if (value === 'bestselling') {
      params.set('flag', 'bestseller');
      params.delete('sort');
    } else {
      params.delete('flag');
      if (value && value !== 'newest') params.set('sort', value);
      else params.delete('sort');
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return <Filters sort={sort} onSortChange={onSortChange} />;
}