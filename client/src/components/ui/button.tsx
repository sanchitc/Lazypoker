import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl border text-sm font-semibold ring-offset-felt-deep transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-35 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          'border-[hsl(40_56%_78%_/_0.36)] bg-gradient-to-b from-brass/95 via-brass to-brass-deep text-obsidian shadow-[0_18px_32px_-24px_hsl(var(--brass-deep)/0.95)] hover:brightness-105',
        secondary:
          'surface-panel-soft text-bone hover:border-brass/24 hover:text-bone',
        outline:
          'border-bone/12 bg-gradient-to-b from-panel-soft/50 to-panel-strong/90 text-bone hover:border-brass/24 hover:bg-panel/90',
        ghost:
          'border-transparent bg-transparent text-bone-dim hover:text-bone hover:bg-bone/5',
        link:
          'border-transparent text-brass underline-offset-4 hover:underline',
        destructive:
          'border-ember/40 bg-gradient-to-b from-ember/25 to-panel-strong text-bone hover:border-ember/60 hover:from-ember/30 hover:to-panel',

        // Poker-specific variants
        fold:
          'border-ember/42 bg-gradient-to-b from-ember/25 to-panel-strong text-bone shadow-[0_18px_30px_-24px_hsl(var(--ember)/0.95)] hover:border-ember/64 hover:from-ember/32 hover:to-panel',
        check:
          'border-ivy/48 bg-gradient-to-b from-ivy/85 to-panel text-bone shadow-[0_18px_30px_-24px_hsl(var(--ivy)/0.95)] hover:brightness-105',
        call:
          'border-ivy/48 bg-gradient-to-b from-ivy/85 to-panel text-bone shadow-[0_18px_30px_-24px_hsl(var(--ivy)/0.95)] hover:brightness-105',
        raise:
          'border-[hsl(40_58%_80%_/_0.38)] bg-gradient-to-b from-[#f2deaf] via-brass to-brass-deep text-obsidian shadow-[0_20px_34px_-24px_hsl(var(--brass-deep)/0.96)] hover:brightness-105',
        allin:
          'relative overflow-hidden border-[#eab987]/45 bg-gradient-to-br from-[#efdca9] via-brass to-[#d57043] text-obsidian shadow-[0_24px_40px_-24px_rgba(143,67,28,0.95)] hover:brightness-110',
        host:
          'border-brass/22 bg-gradient-to-b from-panel-soft/70 to-panel-strong/95 text-brass hover:border-brass/34 hover:bg-panel/90',
      },
      size: {
        sm:  'h-9 px-3.5 text-xs',
        md:  'h-11 px-5 text-sm',
        lg:  'h-12 px-6 text-base',
        xl:  'h-14 px-7 text-base tracking-[0.02em]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
