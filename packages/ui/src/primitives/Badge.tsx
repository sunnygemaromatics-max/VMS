import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type Tone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'critical';
type Variant = 'soft' | 'solid' | 'outline';

const TONE: Record<Tone, { soft: string; solid: string; outline: string }> = {
  neutral: {
    soft: 'bg-surface-3 text-text-secondary',
    solid: 'bg-neutral text-white',
    outline: 'border border-border-strong text-text-secondary',
  },
  brand: {
    soft: 'bg-brand-500/12 text-brand-300',
    solid: 'bg-brand-600 text-white',
    outline: 'border border-brand-500/40 text-brand-300',
  },
  info: {
    soft: 'bg-info/12 text-info',
    solid: 'bg-info text-white',
    outline: 'border border-info/40 text-info',
  },
  success: {
    soft: 'bg-success/12 text-success',
    solid: 'bg-success text-white',
    outline: 'border border-success/40 text-success',
  },
  warning: {
    soft: 'bg-warning/12 text-warning',
    solid: 'bg-warning text-white',
    outline: 'border border-warning/40 text-warning',
  },
  danger: {
    soft: 'bg-danger/12 text-danger',
    solid: 'bg-danger text-white',
    outline: 'border border-danger/40 text-danger',
  },
  critical: {
    soft: 'bg-critical/15 text-critical',
    solid: 'bg-critical text-white',
    outline: 'border border-critical/50 text-critical',
  },
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: Variant;
  icon?: ReactNode;
  dot?: boolean;
  mono?: boolean;
}

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  icon,
  dot,
  mono,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium leading-none whitespace-nowrap',
        TONE[tone][variant],
        mono && 'font-mono tracking-tight',
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full',
            tone === 'critical' ? 'bg-critical animate-pulse' : 'bg-current',
          )}
        />
      )}
      {icon && <span className="shrink-0 [&_svg]:w-3 [&_svg]:h-3">{icon}</span>}
      {children}
    </span>
  );
}
