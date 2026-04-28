import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./client/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        // shadcn semantic tokens
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Editorial Casino Noir tokens
        felt: {
          DEFAULT: 'hsl(var(--felt))',
          deep: 'hsl(var(--felt-deep))',
          rim: 'hsl(var(--felt-rim))',
        },
        panel: {
          DEFAULT: 'hsl(var(--panel))',
          soft: 'hsl(var(--panel-soft))',
          strong: 'hsl(var(--panel-strong))',
        },
        ink: 'hsl(var(--ink))',
        bone: {
          DEFAULT: 'hsl(var(--bone))',
          dim: 'hsl(var(--bone-dim))',
        },
        brass: {
          DEFAULT: 'hsl(var(--brass))',
          deep: 'hsl(var(--brass-deep))',
        },
        ember: 'hsl(var(--ember))',
        velvet: 'hsl(var(--velvet))',
        ivy: 'hsl(var(--ivy))',
        obsidian: 'hsl(var(--obsidian))',
        cardface: {
          DEFAULT: 'hsl(var(--card-face))',
          shadow: 'hsl(var(--card-shadow))',
        },
        suit: {
          dark: 'hsl(var(--suit-dark))',
          red: 'hsl(var(--suit-red))',
        },

        // Legacy aliases (kept temporarily for any unmigrated rules)
        gold: 'hsl(var(--brass))',
        'felt-dark': 'hsl(var(--felt-deep))',
        'felt-light': 'hsl(var(--felt-rim))',
        'chip-white': '#f0f0f0',
        'chip-red': '#e63946',
        'chip-green': '#2a9d8f',
        'chip-blue': '#457b9d',
        'chip-black': '#1d3557',
      },
      fontFamily: {
        display: ['"Bodoni Moda"', 'Georgia', 'serif'],
        sans: ['"Albert Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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
        breathe: 'breathe 2s ease-in-out infinite',
        'brass-shimmer': 'brassShimmer 3.6s ease-in-out infinite',
        'felt-drift': 'feltDrift 18s ease-in-out infinite',
        'card-lift': 'cardLift 0.45s cubic-bezier(0.2, 0.9, 0.3, 1) both',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
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
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--brass) / 0.5)' },
          '50%': { boxShadow: '0 0 0 6px hsl(var(--brass) / 0)' },
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
        brassShimmer: {
          '0%, 100%': { backgroundPosition: '-100% 50%' },
          '50%': { backgroundPosition: '200% 50%' },
        },
        feltDrift: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(-1.5%, -0.6%, 0)' },
        },
        cardLift: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '60%': { transform: 'translateY(-1px)', opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
