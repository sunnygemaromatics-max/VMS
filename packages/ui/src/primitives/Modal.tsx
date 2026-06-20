'use client';

import { ReactNode, useEffect } from 'react';
import { cn } from '../utils/cn';

type Size = 'sm' | 'md' | 'lg';
type Intent = 'default' | 'destructive';

const SIZE: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: Size;
  intent?: Intent;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Disables click-outside + Esc close (e.g. during a destructive confirm). */
  forceConfirm?: boolean;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  size = 'md',
  intent = 'default',
  title,
  subtitle,
  footer,
  forceConfirm,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !forceConfirm) onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, forceConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-8 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={forceConfirm ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full mt-12 bg-surface-2 border border-border-subtle rounded-xl shadow-op-3 overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] animate-slide-up',
          SIZE[size],
        )}
      >
        {(title || subtitle) && (
          <header
            className={cn(
              'flex items-start justify-between gap-3 p-5 border-b border-border-subtle',
              intent === 'destructive' && 'bg-critical/5',
            )}
          >
            <div className="min-w-0">
              {title && (
                <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-text-tertiary mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1 -m-1 rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer
            className={cn(
              'flex items-center justify-end gap-2 p-4 border-t border-border-subtle bg-surface-1',
              intent === 'destructive' && 'border-t-critical/30',
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
