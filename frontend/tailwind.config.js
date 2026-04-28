/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#0a0f1e',
        'surface': '#111827',
        'surface-2': '#1a2238',
        'surface-3': '#1f2d45',
        'accent-gold': '#f59e0b',
        'accent-emerald': '#10b981',
        'accent-red': '#ef4444',
        'accent-blue': '#3b82f6',
        'accent-teal': '#14b8a6',
        'text-primary': '#f9fafb',
        'text-muted': '#6b7280',
        'text-secondary': '#9ca3af',
        'border-dark': '#1f2d45',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'bid-flash': 'bidFlash 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(245,158,11,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(245,158,11,0.8), 0 0 40px rgba(245,158,11,0.3)' },
        },
        bidFlash: {
          '0%': { backgroundColor: 'rgba(16,185,129,0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(135deg, #0a0f1e 0%, #111827 50%, #0a0f1e 100%)',
      },
    },
  },
  plugins: [],
}
