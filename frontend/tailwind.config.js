/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:   '#1E293B',
          accent: '#10B981',
          mid:    '#059669',
          light:  '#34D399',
          pale:   '#ECFDF5',
          muted:  '#D1FAE5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card':     '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
        'elevated': '0 4px 20px rgba(0,0,0,0.08)',
        'topbar':   '0 1px 0 rgba(0,0,0,0.06)',
        'glow':     '0 0 16px rgba(16,185,129,0.22)',
      },
    }
  },
  plugins: []
}
