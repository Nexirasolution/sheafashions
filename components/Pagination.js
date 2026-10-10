import Link from 'next/link';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const TEAL = '#064E4A';
const INK = '#172A29';
const INK_FAINT = '#6B7C7A';
const PAPER = '#FFFDF5';
const HAIRLINE = '#E7DCC5';

function getPageNumbers(current, total) {
  const delta = 1;
  const range = [];
  const pages = [];

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  let prev;
  for (const i of range) {
    if (prev !== undefined && i - prev > 1) pages.push('...');
    pages.push(i);
    prev = i;
  }
  return pages;
}

export default function Pagination({ currentPage, totalPages, basePath }) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const linkStyle = (isActive) => ({
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    minWidth: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    color: isActive ? PAPER : INK,
    background: isActive ? TEAL : 'transparent',
    border: isActive ? `1px solid ${TEAL}` : `1px solid ${HAIRLINE}`,
  });

  return (
    <nav aria-label="Product pagination" className="mt-12 flex items-center justify-center gap-2 flex-wrap">
      {/* Prev */}
      {currentPage > 1 ? (
        <Link href={`${basePath}?page=${currentPage - 1}`} style={linkStyle(false)} aria-label="Previous page">
          ‹
        </Link>
      ) : (
        <span style={{ ...linkStyle(false), opacity: 0.35, cursor: 'not-allowed' }} aria-hidden="true">
          ‹
        </span>
      )}

      {/* Page numbers */}
      {pageNumbers.map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="text-sm px-1" style={{ color: INK_FAINT }}>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={`${basePath}?page=${p}`}
            style={linkStyle(p === currentPage)}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link href={`${basePath}?page=${currentPage + 1}`} style={linkStyle(false)} aria-label="Next page">
          ›
        </Link>
      ) : (
        <span style={{ ...linkStyle(false), opacity: 0.35, cursor: 'not-allowed' }} aria-hidden="true">
          ›
        </span>
      )}
    </nav>
  );
}