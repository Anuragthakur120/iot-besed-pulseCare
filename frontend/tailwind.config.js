/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#dce5f1',
          200: '#b8cde4',
          800: '#112948',
          900: '#0B1F3A',
          950: '#061222'
        },
        teal: {
          400: '#2dd4bf',
          500: '#14B8A6',
          600: '#0d9488',
          700: '#0f766e'
        },
        blue: {
          500: '#3b82f6',
          600: '#2563EB',
          700: '#1d4ed8'
        },
        hospital: {
          bg: 'var(--hospital-bg)',
          card: 'var(--hospital-card)',
          border: 'var(--hospital-border)',
          text: 'var(--hospital-text)',
          muted: 'var(--hospital-muted)'
        },
        status: {
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#DC2626',
          info: '#0EA5E9',
          neutral: '#64748B'
        }
      },
      borderRadius: {
        card: '14px',
        input: '10px'
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(11, 31, 58, 0.06), 0 1px 4px -1px rgba(11, 31, 58, 0.03)',
        'soft-hover': '0 10px 25px -4px rgba(11, 31, 58, 0.09), 0 4px 10px -2px rgba(11, 31, 58, 0.04)',
        card: '0 4px 20px -2px rgba(11, 31, 58, 0.06)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
};
