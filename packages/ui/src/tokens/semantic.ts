/**
 * Semantic tokens — purpose-named, theme-aware. This is what features
 * import. Each value is a CSS variable reference resolved at runtime.
 *
 * Theme files (themes/dark.ts, themes/light.ts) supply the actual
 * color for each variable.
 */

import { brand, data, heat, motion, radius, space, status, typeScale, fontFamily } from './primitives';

export const tokens = {
  // Chrome
  surface: {
    0: 'var(--surface-0)',
    1: 'var(--surface-1)',
    2: 'var(--surface-2)',
    3: 'var(--surface-3)',
    4: 'var(--surface-4)',
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
    onAccent: 'var(--text-on-accent)',
  },

  // Brand (rarely used in chrome; reserved for logo / auth / hero)
  accent: {
    primary: brand.violet[600],
    primaryHover: brand.violet[700],
    primaryActive: brand.violet[500],
    secondary: brand.magenta[600],
    tertiary: brand.orange[500],
    gradient: `linear-gradient(135deg, ${brand.violet[600]} 0%, ${brand.magenta[600]} 50%, ${brand.orange[500]} 100%)`,
  },

  // Status — surface/border/text/solid quartets
  status,

  // Data visualisation
  data,
  heat,

  // Geometry
  radius,
  space,

  // Typography
  type: typeScale,
  font: fontFamily,

  // Motion
  motion,

  // Density (overridable per [data-density])
  density: {
    rowHeight: 'var(--density-row-height)',
    fontSize: 'var(--density-font-size)',
    inputHeight: 'var(--density-input-height)',
  },
} as const;

export type SemanticTokens = typeof tokens;
