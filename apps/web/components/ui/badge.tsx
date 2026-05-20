import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'outline';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    default: 'bg-muted text-fg',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    outline: 'border text-fg',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
