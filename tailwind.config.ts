import type { Config } from 'tailwindcss';

export default {
  content: ['./client/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        felt: '#1a6b37',
        'felt-dark': '#145a2d',
        'felt-light': '#1f7d42',
        gold: '#d4a843',
        'chip-white': '#f0f0f0',
        'chip-red': '#e63946',
        'chip-green': '#2a9d8f',
        'chip-blue': '#457b9d',
        'chip-black': '#1d3557',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
