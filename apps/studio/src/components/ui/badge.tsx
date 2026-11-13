import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] leading-[1.5]',
  {
    variants: {
      tone: {
        plain: 'border-line-strong bg-surface text-ink-2',
        ok: 'border-ok-line bg-ok-weak text-ok',
        bad: 'border-bad-line bg-bad-weak text-bad',
        redo: 'border-[#CFC4F6] bg-accent-weak text-accent-ink',
        run: 'border-run-line bg-run-weak text-run',
      },
    },
    defaultVariants: { tone: 'plain' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
