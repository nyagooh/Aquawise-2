/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: '#E8EEF8', dark: '#1A2332' },
        surface: { DEFAULT: '#FFFFFF', dark: '#212B3D', subtle: '#EDF2FB', 'subtle-dark': '#1E2738' },
        primary: { DEFAULT: '#2563EB', hover: '#1D4FCC', dark: '#3B82F6', 'dark-hover': '#60A5FA' },
        ok:      { DEFAULT: '#22C55E', soft: '#ECFDF5', 'soft-dark': '#052E16' },
        warn:    { DEFAULT: '#EAB308' },
        err:     { DEFAULT: '#EF4444' },
        txt:     { DEFAULT: '#0F172A', secondary: '#334155', muted: '#64748B',
                   dark: '#F1F5F9', 'dark-secondary': '#CBD5E1', 'dark-muted': '#64748B' },
        line:    { DEFAULT: '#E2E8F0', dark: '#293650' },
      },
      fontFamily: {
        sans: ['"Geist Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs':  ['11.5px', '16px'],
        'sm':  ['13px', '18px'],
        'base': ['14px', '20px'],
        'md':  ['15px', '22px'],
        'lg':  ['17px', '26px'],
        'xl':  ['21px', '30px'],
        '2xl': ['28px', '36px'],
        '3xl': ['34px', '42px'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
