/**
 * Tailwind preset. Apps extend with content paths only; everything
 * else (colors, type, motion, plugins) flows from here.
 *
 * Usage:
 *   const preset = require('@vms/ui/tailwind-preset');
 *   module.exports = { presets: [preset], content: [...] };
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Chrome — read from CSS vars so theme switching works
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
          // legacy aliases (back-compat with existing pages)
          DEFAULT: 'var(--surface-1)',
          50: '#f8fafc',
          900: 'var(--surface-1)',
          950: 'var(--surface-0)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          'on-accent': 'var(--text-on-accent)',
        },

        // Brand — fixed across themes
        brand: {
          50: '#f2faed',
          100: '#e3f4d8',
          200: '#c8eaae',
          300: '#acd984',
          400: '#8cca5d',
          500: '#78bf45',
          600: '#68ab37',
          700: '#54872f',
          800: '#456b2b',
          900: '#395824',
          950: '#1c3011',
        },
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2f6fb7',
          700: '#285f9d',
          800: '#244f80',
          900: '#23456b',
        },
        magenta: {
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
        },

        // Status — semantic, never decorative
        info: '#38BDF8',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        critical: '#DC2626',
        neutral: '#64748B',

        // Data viz palette (charts/sparklines)
        'data-1': '#6366F1',
        'data-2': '#2F6FB7',
        'data-3': '#78BF45',
        'data-4': '#EC4899',
        'data-5': '#14B8A6',
        'data-6': '#F59E0B',
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, #78bf45 0%, #68ab37 45%, #2f6fb7 100%)',
        'brand-radial':
          'radial-gradient(ellipse at top, rgba(120,191,69,0.16), transparent 55%), radial-gradient(ellipse at bottom right, rgba(47,111,183,0.10), transparent 60%)',
      },
      fontFamily: {
        sans: [
          'InterVariable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono Variable',
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        md: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['22px', { lineHeight: '30px', letterSpacing: '-0.01em' }],
        '2xl': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em' }],
        display: ['36px', { lineHeight: '44px', letterSpacing: '-0.015em' }],
        metric: ['52px', { lineHeight: '56px', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        none: '0',
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        brand: '0 10px 40px -10px rgba(47, 111, 183, 0.35)',
        'brand-glow':
          '0 0 0 1px rgba(104,171,55,0.35), 0 8px 30px rgba(47,111,183,0.22)',
        'op-1':
          '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px var(--border-subtle)',
        'op-2':
          '0 8px 24px -6px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle)',
        'op-3':
          '0 20px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px var(--border-subtle)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0, 0, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        standard: 'cubic-bezier(0.2, 0, 0.2, 1)',
      },
      transitionDuration: {
        instant: '0ms',
        fast: '120ms',
        normal: '200ms',
        slow: '320ms',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.2, 0, 0.2, 1) infinite',
        'fade-in': 'fadeIn 120ms cubic-bezier(0.2, 0, 0, 1)',
        'slide-up': 'slideUp 200ms cubic-bezier(0.2, 0, 0, 1)',
        'breathe': 'breathe 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
};
