import { HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** width / height shortcut */
  w?: string;
  h?: string;
  /** circular avatar */
  circle?: boolean;
}

/**
 * Subtle shimmer that respects reduced-motion. Use over a Surface, not
 * over the page background, so contrast matches the eventual content.
 */
export function Skeleton({ w, h = 'h-4', circle, className, style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse bg-surface-3 rounded-sm',
        circle && 'rounded-full',
        !w && 'w-full',
        h,
        className,
      )}
      style={{ ...style, width: w }}
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          h="h-3"
          w={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}
