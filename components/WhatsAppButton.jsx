'use client';

import { useState } from 'react';

export default function WhatsAppButton({
  phone = '919092955054',
  message = "Hi! I'd like to know more about your products.",
}) {
  const [hovered, setHovered] = useState(false);

  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-20 left-4 sm:bottom-5 sm:left-5 z-[60] flex items-center gap-2 rounded-full bg-[#25D366] text-white shadow-md hover:shadow-lg transition-all duration-300 px-4 py-3"
      style={{ paddingRight: hovered ? '1.25rem' : '0.75rem' }}
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7 shrink-0" fill="currentColor">
        <path d="M16.004 3C9.373 3 4 8.373 4 15.005c0 2.65.87 5.1 2.34 7.08L5 29l7.1-1.87a11.94 11.94 0 0 0 3.9.66h.004C22.63 27.79 28 22.42 28 15.788 28 8.373 22.63 3 16.004 3zm0 21.6c-1.29 0-2.55-.31-3.66-.9l-.26-.15-4.21 1.11 1.12-4.1-.17-.27a9.55 9.55 0 0 1-1.47-5.09c0-5.27 4.29-9.56 9.57-9.56 5.27 0 9.56 4.29 9.56 9.56 0 5.27-4.29 9.4-9.54 9.4zm5.24-7.14c-.29-.14-1.7-.84-1.96-.93-.26-.1-.45-.14-.64.14-.19.29-.74.93-.9 1.12-.17.19-.33.21-.62.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.59.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.39s1.02 2.77 1.16 2.96c.14.19 2 3.05 4.84 4.28.68.29 1.21.47 1.62.6.68.22 1.3.19 1.79.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33z" />
      </svg>
      <span
        className="overflow-hidden whitespace-nowrap font-medium text-sm transition-all duration-300"
        style={{ maxWidth: hovered ? '160px' : '0px', opacity: hovered ? 1 : 0 }}
      >
        Chat with us
      </span>
    </a>
  );
}