import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-bone/10 bg-panel-soft/75 text-bone',
        brass: 'border-brass/28 bg-brass/12 text-brass',
        ember: 'border-ember/34 bg-ember/12 text-[hsl(10_78%_76%)]',
        ivy: 'border-ivy/34 bg-ivy/18 text-[hsl(146_40%_79%)]',
        outline: 'border-bone/12 bg-panel-strong/60 text-bone-dim',
        muted: 'border-bone/10 bg-bone/8 text-bone-dim',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
