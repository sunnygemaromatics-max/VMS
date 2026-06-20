import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4 gap-2' : 'py-16 px-6 gap-3',
        className,
      )}
      {...rest}
    >
      {icon && (
        <div
          className={cn(
            'rounded-full bg-surface-3 text-text-tertiary flex items-center justify-center',
            compact ? 'w-10 h-10' : 'w-14 h-14',
            compact ? '[&_svg]:w-5 [&_svg]:h-5' : '[&_svg]:w-6 [&_svg]:h-6',
          )}
        >
          {icon}
        </div>
      )}
      {title && (
        <h3 className={cn('font-semibold text-text-primary', compact ? 'text-sm' : 'text-md')}>
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-text-tertiary max-w-md">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
