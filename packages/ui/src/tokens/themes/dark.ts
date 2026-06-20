import { graphite } from '../primitives';

/**
 * Dark theme — the default. Maps CSS variables to graphite primitives.
 * Emitted to :root in globals.css; consumed by `var(--surface-1)` etc.
 */
export const darkTheme = {
  '--surface-0': graphite[0],
  '--surface-1': graphite[50],
  '--surface-2': graphite[100],
  '--surface-3': graphite[200],
  '--surface-4': graphite[300],
  '--border-subtle': graphite[300],
  '--border-strong': graphite[400],
  '--text-primary': graphite[900],
  '--text-secondary': graphite[700],
  '--text-tertiary': graphite[600],
  '--text-disabled': graphite[500],
  '--text-on-accent': '#FFFFFF',

  '--density-row-height': '32px',
  '--density-font-size': '13px',
  '--density-input-height': '32px',
} as const;
