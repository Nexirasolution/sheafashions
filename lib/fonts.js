import { Fraunces, Inter } from 'next/font/google';

// Declared once and shared. Italic Fraunces removed (doubles the font files);
// add `style: ['normal', 'italic']` back only if you actually use italics.
export const display = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-display',
});

export const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
});