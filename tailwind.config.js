/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      animation: {
        marquee: 'marquee 22s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      colors: {
        // Palette: #064E4A #C49A45 #FFFDF5 #172A29 #E7DCC5
        brand: {
          // New names (use these going forward)
          teal: '#064E4A',       // primary brand color (CTAs, headings, prices)
          tealdark: '#043B38',   // darker teal, for hovers (derived)
          gold: '#C49A45',       // accent
          cream: '#FFFDF5',      // page background
          sand: '#E7DCC5',       // borders, soft fills
          ink: '#172A29',        // text

          // Legacy names: kept so existing classes like bg-brand-magenta keep working.
          // They now resolve to the new palette.
          magenta: '#064E4A',    // was maroon primary -> teal
          rose: '#0B6B66',       // was lighter maroon hover -> lighter teal (derived)
          pink: '#C49A45',       // was bright red accent -> gold
          green: '#2F7F78',      // was light green highlight -> mid teal (derived)
          deepgreen: '#064E4A'   // was forest green -> teal
        }
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)']
      },
      boxShadow: {
        soft: '0 8px 30px -8px rgba(6,78,74,0.18)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};