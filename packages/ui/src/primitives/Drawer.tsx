'use client';

import { ReactNode, useEffect } from 'react';
import { cn } from '../utils/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  width?: number;
  title?: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  side = 'right',
  width = 520,
  title,
  subtitle,
  trailing,
  footer,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] animate-fade-in" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={cn(
          'absolute top-0 bottom-0 bg-surface-2 border-border-subtle shadow-op-3 flex flex-col',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
        )}
        style={{
          width: `${width}px`,
          maxWidth: '100vw',
          animation: `slideUp 200ms cubic-bezier(0.2, 0, 0, 1)`,
        }}
      >
        {(title || trailing) && (
          <header className="flex items-start justify-between gap-3 p-5 border-b border-border-subtle">
            <div className="min-w-0">
              {title && <h2 className="text-md font-semibold text-text-primary">{title}</h2>}
              {subtitle && (
                <p className="text-sm text-text-tertiary mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {trailing}
              <button
                onClick={onClose}
                className="p-1 rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="p-4 border-t border-border-subtle bg-surface-1">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
