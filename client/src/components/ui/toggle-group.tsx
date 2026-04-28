import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('inline-flex gap-1 rounded-xl border border-bone/10 bg-panel-strong/75 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]', className)}
    {...props}
  />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2',
      'text-xs font-medium tracking-[0.12em] text-bone-dim transition-all',
      'hover:text-bone hover:bg-bone/5',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=on]:border data-[state=on]:border-brass/34 data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#f1dba7] data-[state=on]:to-brass data-[state=on]:text-obsidian data-[state=on]:font-semibold',
      className
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
