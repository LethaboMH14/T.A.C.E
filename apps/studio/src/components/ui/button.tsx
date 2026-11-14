import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-white rounded-field shadow-[0_1px_0_rgba(255,255,255,.2)_inset,0_6px_14px_-6px_rgba(100,71,219,.6)] hover:bg-accent-ink active:translate-y-px disabled:bg-[#A99BE6] disabled:shadow-none',
        outline: 'border border-line-strong bg-surface text-ink-2 rounded-field hover:bg-sunken',
        ghost: 'text-ink-2 rounded-field hover:bg-sunken',
      },
      size: {
        default: 'h-9 px-4 text-sm',
        icon: 'h-[34px] w-[34px] p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
