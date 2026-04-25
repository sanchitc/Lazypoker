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
        'chip-add': 'chipAdd 0.2s ease-out',
        'chip-bounce': 'chipBounce 0.3s ease-out',
        'pot-grow': 'potGrow 0.4s ease-out',
        'ring-pulse': 'ringPulse 1.5s ease-in-out infinite',
        'scale-pop': 'scalePop 0.25s ease-out',
        'breathe': 'breathe 2s ease-in-out infinite',
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
        chipAdd: {
          '0%': { transform: 'scale(0.6) translateY(8px)', opacity: '0' },
          '60%': { transform: 'scale(1.1) translateY(-2px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        chipBounce: {
          '0%': { transform: 'scale(0.9)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        potGrow: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
        ringPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.5)' },
          '50%': { boxShadow: '0 0 0 6px rgba(59, 130, 246, 0)' },
        },
        scalePop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '70%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
