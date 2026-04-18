import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

const buttonVariants = cva(
  'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-mono text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30',
  {
    variants: {
      variant: {
        default:
          'border border-border bg-surface text-text-muted hover:bg-surface-light hover:text-text',
        accent:
          'border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20',
        ghost:
          'text-text-muted hover:bg-surface-light hover:text-text',
        muted:
          'bg-surface-light text-text-muted hover:bg-accent/10 hover:text-accent',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-2.5 py-1 text-[10px]',
        icon: 'size-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
