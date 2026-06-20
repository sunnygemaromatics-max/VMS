import { darkTheme } from './dark';
import { lightTheme } from './light';

export type ThemeName = 'dark' | 'light';

export const themes: Record<ThemeName, Record<string, string>> = {
  dark: darkTheme,
  light: lightTheme,
};

/**
 * Build a CSS string declaring every theme variable on its [data-theme]
 * selector. Inject once in globals.css.
 */
export function themeCss(): string {
  const block = (selector: string, vars: Record<string, string>) =>
    `${selector} {\n${Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')}\n}`;

  return [
    block(':root, [data-theme="dark"]', darkTheme),
    block('[data-theme="light"]', lightTheme),
    // Density overrides
    `[data-density="default"] { --density-row-height: 40px; --density-font-size: 13px; --density-input-height: 36px; }`,
    `[data-density="comfort"] { --density-row-height: 48px; --density-font-size: 14px; --density-input-height: 40px; }`,
  ].join('\n\n');
}
