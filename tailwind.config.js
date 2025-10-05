/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'fx-slate': '#f1f5f9',
        'fx-deep': '#0f172a',
        'fx-accent': '#2563eb',
        'fx-accent-soft': '#22d3ee'
      },
      boxShadow: {
        'fx-card': '0 28px 80px rgba(15, 23, 42, 0.08)'
      },
      borderRadius: {
        '2xl': '1rem'
      }
    }
  },
  plugins: []
};
