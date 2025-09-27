import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import React from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-400',
        ghost: 'bg-transparent hover:bg-zinc-800 text-white focus:ring-zinc-700',
        outline: 'border border-zinc-700 hover:bg-zinc-800',
      },
      size: { sm: 'h-9', md: 'h-10', lg: 'h-11 px-6' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
