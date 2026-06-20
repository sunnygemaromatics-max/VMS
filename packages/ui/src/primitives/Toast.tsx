'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'critical';

interface ToastInput {
  title?: ReactNode;
  body?: ReactNode;
  tone?: Tone;
  /** ms; default 3000 (5000 for danger, ∞ for critical) */
  duration?: number;
  /** Undo / retry action */
  action?: { label: ReactNode; onClick: () => void };
}

interface ToastEntry extends ToastInput {
  id: string;
  expiresAt?: number;
}

interface ToastCtx {
  show: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  /** Shorthand helpers */
  success: (title: ReactNode, body?: ReactNode) => string;
  error: (title: ReactNode, body?: ReactNode) => string;
  info: (title: ReactNode, body?: ReactNode) => string;
}

const Ctx = createContext<ToastCtx | null>(null);

const TONE: Record<Tone, string> = {
  info: 'border-info/40 text-info',
  success: 'border-success/40 text-success',
  warning: 'border-warning/45 text-warning',
  danger: 'border-danger/45 text-danger',
  critical: 'border-critical/55 text-critical bg-critical/10',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((curr) => curr.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      const id = Math.random().toString(36).slice(2, 10);
      const tone = input.tone ?? 'info';
      const ttl =
        input.duration ??
        (tone === 'critical' ? Number.POSITIVE_INFINITY : tone === 'danger' ? 5000 : 3000);
      const entry: ToastEntry = { ...input, id, tone };
      setToasts((curr) => [...curr.slice(-2), entry]); // cap at 3 visible
      if (Number.isFinite(ttl)) {
        const t = setTimeout(() => dismiss(id), ttl);
        timers.current.set(id, t);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const value: ToastCtx = {
    show,
    dismiss,
    success: (title, body) => show({ title, body, tone: 'success' }),
    error: (title, body) => show({ title, body, tone: 'danger' }),
    info: (title, body) => show({ title, body, tone: 'info' }),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto bg-surface-2 border rounded-md shadow-op-2 px-3 py-2.5 flex items-start gap-3 animate-slide-up',
              TONE[t.tone ?? 'info'],
            )}
          >
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-medium text-text-primary">{t.title}</p>}
              {t.body && <p className="text-xs text-text-secondary mt-0.5">{t.body}</p>}
            </div>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="text-xs font-medium text-brand-300 hover:text-brand-200"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}
