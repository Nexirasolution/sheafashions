'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
const INK = '#172A29';
const PAPER = '#FFFDF5';

export default function SizeChartModal({ images, onClose }) {
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: 'rgba(23,42,41,0.88)', zIndex: 10000 }}
    >
      <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 sm:-top-2 sm:-right-11 w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,253,245,0.15)', color: PAPER }}
          aria-label="Close size chart"
        >
          <X size={20} />
        </button>

        <div className="relative w-full aspect-square" style={{ background: PAPER, borderRadius: '4px', overflow: 'hidden' }}>
          <Image
            src={images[index]}
            alt={`Size chart ${index + 1} of ${images.length}`}
            fill
            className="object-contain"
            sizes="(max-width:640px) 90vw, 448px"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-start pl-2"
                aria-label="Previous size chart image"
              >
                <ChevronLeft size={22} strokeWidth={1.5} style={{ color: INK }} />
              </button>
              <button
                onClick={next}
                className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-end pr-2"
                aria-label="Next size chart image"
              >
                <ChevronRight size={22} strokeWidth={1.5} style={{ color: INK }} />
              </button>
              <div className="absolute bottom-3 right-3 text-[11px] font-medium tracking-wide" style={{ color: INK }}>
                {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}