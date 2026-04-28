import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'mono';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-12 w-full bg-transparent px-1 py-2 text-base text-bone',
          'placeholder:text-bone-dim/55',
          'border-0 border-b border-brass/35',
          'transition-colors',
          'focus:outline-none focus:border-brass focus:ring-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'mono' && 'font-mono tracking-[0.4em] text-center text-2xl uppercase',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
