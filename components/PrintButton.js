'use client';

export default function PrintButton({ label = 'Print / Save as PDF' }) {
  return (
    <div className="text-center mt-6 print:hidden">
      <button
        onClick={() => window.print()}
        className="bg-brand-teal text-brand-cream rounded-full px-7 py-2.5 text-sm font-medium tracking-wide transition-colors hover:bg-brand-tealdark"
      >
        {label}
      </button>
    </div>
  );
}