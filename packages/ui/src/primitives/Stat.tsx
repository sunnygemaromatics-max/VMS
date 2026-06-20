import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';
import { Skeleton } from './Skeleton';

type Tone = 'default' | 'positive' | 'warning' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const TONE: Record<Tone, string> = {
  default: 'text-text-primary',
  positive: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const SIZE: Record<Size, string> = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-display',
};

interface StatProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  size?: Size;
  loading?: boolean;
  /** Pulses the top border when value updates — for live metrics */
  live?: boolean;
}

export function Stat({
  label,
  value,
  delta,
  hint,
  icon,
  tone = 'default',
  size = 'md',
  loading,
  live,
  className,
  ...rest
}: StatProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-1',
        live && 'before:absolute before:inset-x-0 before:top-[-1px] before:h-px before:bg-accent-400 before:animate-breathe',
        className,
      )}
      {...rest}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-text-tertiary">{label}</span>
        {icon && <span className="text-text-tertiary [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton h="h-9" w="60%" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={cn('font-mono font-semibold leading-none tracking-tight', SIZE[size], TONE[tone])}>
            {value}
          </span>
          {delta && (
            <span className={cn('text-xs font-medium tabular-nums', TONE[tone === 'default' ? 'positive' : tone])}>
              {delta}
            </span>
          )}
        </div>
      )}
      {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
    </div>
  );
}
