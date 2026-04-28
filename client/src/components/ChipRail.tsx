import { useRef, useCallback } from 'react';
import { CHIP_COLOR_MAP } from '../utils/chipUtils';

interface ChipRailProps {
  availableDenoms: { value: number; count: number; maxCount: number }[];
  onAddChip: (denomination: number) => void;
  disabled: boolean;
}

export default function ChipRail({ availableDenoms, onAddChip, disabled }: ChipRailProps) {
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeatRef.current) {
      clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
  }, []);

  const startRepeat = useCallback((denom: number) => {
    stopRepeat();
    repeatRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => {
        onAddChip(denom);
      }, 100) as any;
    }, 250) as any;
  }, [onAddChip, stopRepeat]);

  return (
    <div className="surface-panel-soft flex items-center justify-center gap-2 rounded-[22px] px-2 py-2">
      {availableDenoms.map(({ value, count }) => {
        const color = CHIP_COLOR_MAP.get(value) ?? '#888';
        const exhausted = count <= 0;
        const isDisabled = disabled || exhausted;

        return (
          <button
            key={value}
            disabled={isDisabled}
            onClick={() => !isDisabled && onAddChip(value)}
            onPointerDown={() => !isDisabled && startRepeat(value)}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
            className={`flex flex-col items-center gap-0 select-none transition-all chip-wobble
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brass rounded-full
              ${isDisabled ? 'opacity-25 cursor-default' : 'active:scale-90 cursor-pointer'}`}
            aria-label={`Add ${value} chip`}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${color}, color-mix(in oklab, ${color} 65%, black) 90%)`,
                border: '1px solid rgba(255,255,255,0.22)',
                boxShadow: `
                  inset 0 1px 0 rgba(255,255,255,0.32),
                  inset 0 -1px 0 rgba(0,0,0,0.32),
                  0 6px 12px hsl(206 30% 4% / 0.6)
                `,
              }}
            >
              <div className="absolute inset-[3px] rounded-full border border-bone/15" />
              <span
                className={`font-mono font-bold tabular-nums relative z-10
                  ${value >= 1000 ? 'text-[10px]' : 'text-xs'}`}
                style={{
                  color: value <= 1 ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)',
                }}
              >
                {value >= 1000 ? `${value / 1000}K` : value}
              </span>
            </div>
            <span className={`mt-0.5 text-[9px] font-mono tabular-nums
              ${exhausted ? 'text-bone-dim/28' : 'text-bone-dim/65'}`}>
              {exhausted ? '—' : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
