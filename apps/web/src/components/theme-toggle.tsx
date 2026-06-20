'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

/**
 * Two-state theme toggle. Renders as a small pill button — neutral in either
 * theme, using semantic tokens so it stays legible without overrides.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`group relative flex items-center justify-center w-9 h-9 rounded-lg border border-border-subtle bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors ${className}`}
    >
      <Icon className="w-4 h-4 transition-transform group-active:scale-90" />
    </button>
  );
}
