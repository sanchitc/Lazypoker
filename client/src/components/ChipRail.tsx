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
    <div className="flex gap-1 justify-center items-center px-1">
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
              ${isDisabled ? 'opacity-25 cursor-default' : 'active:scale-90 cursor-pointer'}`}
            aria-label={`Add ${value} chip`}
          >
            {/* Single chip visual */}
            <div
              className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center
                         shadow-md relative overflow-hidden"
              style={{
                backgroundColor: color,
                boxShadow: `0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2),
                             inset 0 -1px 0 rgba(0,0,0,0.2)`,
              }}
            >
              {/* Inner ring detail */}
              <div className="absolute inset-[3px] rounded-full border border-white/15" />
              <span className={`text-xs font-black tabular-nums relative z-10
                ${value >= 500 ? 'text-white' : value <= 1 ? 'text-gray-600' : 'text-white'}
                ${value >= 1000 ? 'text-[10px]' : ''}`}
              >
                {value >= 1000 ? `${value / 1000}K` : value}
              </span>
            </div>
            {/* Count badge */}
            <span className={`text-[9px] tabular-nums mt-0.5 font-medium
              ${exhausted ? 'text-white/20' : 'text-white/45'}`}>
              {exhausted ? '-' : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
