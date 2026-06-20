import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type Tone = 'default' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'critical' | 'live';
type Density = 'compact' | 'default' | 'comfort';
type Padding = 'none' | 'sm' | 'md' | 'lg';

const TONE: Record<Tone, string> = {
  default: 'bg-surface-2 border-border-subtle',
  accent: 'bg-surface-2 border-brand-500/30 ring-1 ring-brand-500/15',
  info: 'bg-info/[0.06] border-info/25',
  success: 'bg-success/[0.06] border-success/25',
  warning: 'bg-warning/[0.06] border-warning/30',
  danger: 'bg-danger/[0.06] border-danger/30',
  critical: 'bg-critical/[0.08] border-critical/40',
  live: 'bg-surface-2 border-border-subtle relative',
};

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const DENSITY: Record<Density, string> = {
  compact: 'text-sm',
  default: 'text-sm',
  comfort: 'text-base',
};

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  density?: Density;
  padding?: Padding;
  interactive?: boolean;
  selected?: boolean;
  children?: ReactNode;
}

const SurfaceRoot = forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      tone = 'default',
      density = 'compact',
      padding = 'md',
      interactive,
      selected,
      className,
      children,
      ...rest
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-tone={tone}
      data-density={density}
      className={cn(
        'rounded-lg border backdrop-blur-[2px] transition-colors duration-fast',
        TONE[tone],
        PADDING[padding],
        DENSITY[density],
        interactive && 'cursor-pointer hover:bg-surface-3',
        selected && 'bg-surface-3 border-brand-500',
        tone === 'live' && 'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-accent-400 before:animate-breathe',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
);
SurfaceRoot.displayName = 'Surface';

interface SectionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}

function SurfaceHeader({ eyebrow, title, trailing, className, children, ...rest }: SectionProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-3 mb-3', className)}
      {...rest}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-wider text-text-tertiary mb-0.5">
            {eyebrow}
          </p>
        )}
        {title && (
          <h3 className="text-md font-semibold text-text-primary truncate">{title}</h3>
        )}
        {children}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

function SurfaceBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-text-secondary', className)} {...rest}>
      {children}
    </div>
  );
}

function SurfaceFooter({
  className,
  align = 'end',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' | 'between' }) {
  return (
    <div
      className={cn(
        'mt-4 pt-3 border-t border-border-subtle flex items-center gap-2',
        align === 'end' && 'justify-end',
        align === 'between' && 'justify-between',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export const Surface = Object.assign(SurfaceRoot, {
  Header: SurfaceHeader,
  Body: SurfaceBody,
  Footer: SurfaceFooter,
});
