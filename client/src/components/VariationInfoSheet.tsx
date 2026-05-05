import { TeenPattiVariation } from '@common/types';
import { TEEN_PATTI_VARIATIONS } from '@common/teen-patti-variations';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface VariationInfoSheetProps {
  variation: TeenPattiVariation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VariationInfoSheet({ variation, open, onOpenChange }: VariationInfoSheetProps) {
  const meta = TEEN_PATTI_VARIATIONS[variation];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-sm overflow-y-auto scrollbar-brass felt-noise"
      >
        <SheetHeader>
          <SheetTitle>{meta.label}</SheetTitle>
          <SheetDescription>{meta.tagline}</SheetDescription>
        </SheetHeader>

        <ul className="space-y-2 text-sm text-bone">
          {meta.rules.map((rule, i) => (
            <li
              key={i}
              className="rounded-[14px] surface-panel-soft px-3 py-2 leading-relaxed"
            >
              {rule}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
