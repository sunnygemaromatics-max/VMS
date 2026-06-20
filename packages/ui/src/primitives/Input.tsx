import { forwardRef, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
  mono?: boolean;
}

const baseControl =
  'block w-full bg-surface-1 text-text-primary placeholder:text-text-tertiary border border-border-subtle rounded-md px-3 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-0 focus:border-brand-500 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, suffix, invalid, mono, className, ...rest }, ref) => {
    if (prefix || suffix) {
      return (
        <div
          className={cn(
            'flex items-stretch bg-surface-1 border border-border-subtle rounded-md transition-colors duration-fast focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500',
            invalid && 'border-danger focus-within:ring-danger focus-within:border-danger',
            className,
          )}
        >
          {prefix && (
            <span className="inline-flex items-center px-2 text-text-tertiary border-r border-border-subtle">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'flex-1 bg-transparent px-3 text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50',
              mono && 'font-mono tracking-tight',
            )}
            style={{ height: 'var(--density-input-height, 32px)' }}
            {...rest}
          />
          {suffix && (
            <span className="inline-flex items-center px-2 text-text-tertiary border-l border-border-subtle">
              {suffix}
            </span>
          )}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(
          baseControl,
          mono && 'font-mono tracking-tight',
          invalid && 'border-danger focus:ring-danger focus:border-danger',
          className,
        )}
        style={{ height: 'var(--density-input-height, 32px)' }}
        {...rest}
      />
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ invalid, className, rows = 3, ...rest }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        baseControl,
        'py-2 leading-relaxed',
        invalid && 'border-danger focus:ring-danger focus:border-danger',
        className,
      )}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ invalid, className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        baseControl,
        'pr-8 appearance-none bg-[url(\'data:image/svg+xml;utf8,<svg fill="%239AA3B8" height="16" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M5.516 7.548 10 12.032l4.484-4.484L15.5 8.564 10 14.064 4.5 8.564z"/></svg>\')] bg-no-repeat bg-[right_0.5rem_center]',
        invalid && 'border-danger focus:ring-danger focus:border-danger',
        className,
      )}
      style={{ height: 'var(--density-input-height, 32px)' }}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

interface FieldProps {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, help, error, required, className, children }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-xs uppercase tracking-wider text-text-tertiary">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : help ? (
        <span className="text-xs text-text-tertiary">{help}</span>
      ) : null}
    </label>
  );
}
