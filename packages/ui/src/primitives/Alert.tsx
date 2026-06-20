import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'critical';

const TONE: Record<Tone, { container: string; icon: string }> = {
  info: { container: 'bg-info/[0.07] border-info/30 text-info', icon: 'text-info' },
  success: { container: 'bg-success/[0.07] border-success/30 text-success', icon: 'text-success' },
  warning: { container: 'bg-warning/[0.08] border-warning/35 text-warning', icon: 'text-warning' },
  danger: { container: 'bg-danger/[0.08] border-danger/35 text-danger', icon: 'text-danger' },
  critical: { container: 'bg-critical/[0.10] border-critical/45 text-critical', icon: 'text-critical' },
};

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: Tone;
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
}

export function Alert({
  tone = 'info',
  title,
  icon,
  actions,
  onDismiss,
  className,
  children,
  ...rest
}: AlertProps) {
  const t = TONE[tone];
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-3 rounded-md border px-3 py-2.5', t.container, className)}
      {...rest}
    >
      {icon && <span className={cn('shrink-0 mt-0.5 [&_svg]:w-4 [&_svg]:h-4', t.icon)}>{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-text-primary">{title}</p>}
        <div className="text-sm text-text-secondary">{children}</div>
        {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors duration-fast"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
