import { HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

/**
 * Keyboard shortcut chip. Use inline next to a label to advertise
 * a hotkey: <Kbd>⌘</Kbd> <Kbd>K</Kbd>
 */
export function Kbd({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-xs',
        'bg-surface-3 border border-border-subtle text-text-secondary',
        'font-mono text-[10px] leading-none uppercase',
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
