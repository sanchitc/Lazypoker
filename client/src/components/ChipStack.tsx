import { CHIP_COLORS } from '@common/constants';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function ChipStack({ amount, size = 'md', showLabel = true }: ChipStackProps) {
  const chipColor = CHIP_COLORS.reduce((best, chip) =>
    amount >= chip.value ? chip : best
  , CHIP_COLORS[0]);

  const sizes = {
    sm: { chip: 24, text: 'text-xs' },
    md: { chip: 32, text: 'text-sm' },
    lg: { chip: 40, text: 'text-base' },
  };

  const s = sizes[size];

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative" style={{ width: s.chip + 2, height: s.chip + 6 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: s.chip,
              height: s.chip,
              bottom: `${i * 3}px`,
              left: `${i * 1}px`,
              background: `radial-gradient(circle at 30% 30%, ${chipColor.color}, color-mix(in oklab, ${chipColor.color} 70%, black) 90%)`,
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,0.28),
                inset 0 -1px 0 rgba(0,0,0,0.4),
                0 3px 6px hsl(206 30% 4% / 0.55)
              `,
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className={`${s.text} font-mono font-semibold tabular-nums text-bone`}>
          {amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}
