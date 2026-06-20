/**
 * Primitive design tokens — raw values. Never imported by feature code.
 * Semantic tokens (semantic.ts) consume these.
 *
 * Editing a primitive ripples across every theme.
 */

export const graphite = {
  0: '#060814',
  50: '#0B0F1F',
  100: '#11162A',
  200: '#171D34',
  300: '#1F2641',
  400: '#2A3158',
  500: '#3B4263',
  600: '#5A6480',
  700: '#9AA3B8',
  800: '#CBD3E5',
  900: '#F3F5FA',
} as const;

export const brand = {
  violet: {
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
  },
  magenta: {
    500: '#D946EF',
    600: '#C026D3',
  },
  orange: {
    400: '#FB923C',
    500: '#F97316',
  },
} as const;

export const status = {
  info: '#38BDF8',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  critical: '#DC2626',
  neutral: '#64748B',
} as const;

export const data = {
  1: '#6366F1',
  2: '#06B6D4',
  3: '#8B5CF6',
  4: '#EC4899',
  5: '#14B8A6',
  6: '#F59E0B',
} as const;

export const heat = {
  0: '#0B0F1F',
  1: '#1E3A8A',
  2: '#4338CA',
  3: '#7E22CE',
  4: '#BE185D',
  5: '#DC2626',
} as const;

export const radius = {
  none: '0px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const space = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const typeScale = {
  xs: ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
  sm: ['13px', { lineHeight: '20px' }],
  base: ['14px', { lineHeight: '22px' }],
  md: ['16px', { lineHeight: '24px' }],
  lg: ['18px', { lineHeight: '26px' }],
  xl: ['22px', { lineHeight: '30px', letterSpacing: '-0.01em' }],
  '2xl': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em' }],
  display: ['36px', { lineHeight: '44px', letterSpacing: '-0.015em' }],
  metric: ['52px', { lineHeight: '56px', letterSpacing: '-0.02em' }],
} as const;

export const fontFamily = {
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
    'JetBrains Mono',
    'JetBrains Mono Variable',
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'monospace',
  ],
} as const;

export const motion = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    normal: '200ms',
    slow: '320ms',
    pulse: '2000ms',
  },
  easing: {
    out: 'cubic-bezier(0.2, 0, 0, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    standard: 'cubic-bezier(0.2, 0, 0.2, 1)',
  },
} as const;
