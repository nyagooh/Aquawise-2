/**
 * Tailwind is used only for Tremor components (dashboard charts and cards).
 * Preflight is off so the existing hand-written CSS is untouched.
 */
import colors from 'tailwindcss/colors';
import headlessui from '@headlessui/tailwindcss';

/* AquaWise blue as a full Tailwind palette so Tremor can use color="aqua". */
const aqua = {
  50: '#EEF5FF', 100: '#DAE8FE', 200: '#BCD5FD', 300: '#8EB9FB', 400: '#5994F6',
  500: '#1769E8', 600: '#1257C4', 700: '#10479F', 800: '#123D82', 900: '#14356B', 950: '#0F2245'
};

const TONES = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|aqua';
const SHADES = '50|100|200|300|400|500|600|700|800|900|950';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './node_modules/@tremor/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  corePlugins: { preflight: false },
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      colors: {
        aqua,
        blue: aqua, // Tremor's color="blue" renders AquaWise blue
        tremor: {
          brand: { faint: aqua[50], muted: aqua[200], subtle: aqua[400], DEFAULT: aqua[500], emphasis: aqua[700], inverted: colors.white },
          background: { muted: '#F7F8FA', subtle: colors.gray[100], DEFAULT: colors.white, emphasis: colors.gray[700] },
          border: { DEFAULT: '#E5E7EB' },
          ring: { DEFAULT: '#E5E7EB' },
          content: { subtle: colors.gray[400], DEFAULT: '#667085', emphasis: colors.gray[700], strong: '#111827', inverted: colors.white }
        },
        'dark-tremor': {
          brand: { faint: '#0B1229', muted: aqua[950], subtle: aqua[800], DEFAULT: aqua[400], emphasis: aqua[300], inverted: aqua[950] },
          background: { muted: '#0E0F13', subtle: colors.gray[800], DEFAULT: '#0A0A0B', emphasis: colors.gray[300] },
          border: { DEFAULT: colors.gray[800] },
          ring: { DEFAULT: colors.gray[800] },
          content: { subtle: colors.gray[600], DEFAULT: colors.gray[400], emphasis: colors.gray[200], strong: colors.gray[50], inverted: colors.gray[950] }
        }
      },
      boxShadow: {
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
      },
      borderRadius: { 'tremor-small': '0.375rem', 'tremor-default': '0.625rem', 'tremor-full': '9999px' },
      fontSize: {
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }]
      }
    }
  },
  safelist: ['bg', 'text', 'border', 'ring', 'stroke', 'fill'].map(p => ({
    pattern: new RegExp(`^(${p}-(?:${TONES})-(?:${SHADES}))$`),
    ...(p === 'bg' || p === 'text' || p === 'border' || p === 'ring' ? { variants: ['hover', 'ui-selected'] } : {})
  })),
  plugins: [headlessui]
};
