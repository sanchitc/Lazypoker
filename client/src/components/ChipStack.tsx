import { CHIP_COLORS } from '@common/constants';

interface ChipStackProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function ChipStack({ amount, size = 'md', showLabel = true }: ChipStackProps) {
  // Determine chip color based on amount
  const chipColor = CHIP_COLORS.reduce((best, chip) =>
    amount >= chip.value ? chip : best
  , CHIP_COLORS[0]);

  const sizes = {
    sm: { chip: 'w-6 h-6', text: 'text-xs', stack: 'h-8' },
    md: { chip: 'w-8 h-8', text: 'text-sm', stack: 'h-10' },
    lg: { chip: 'w-10 h-10', text: 'text-base', stack: 'h-12' },
  };

  const s = sizes[size];

  return (
    <div className="flex items-center gap-1.5">
      {/* Visual chip stack */}
      <div className={`relative ${s.stack} w-8 flex items-end`}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`absolute ${s.chip} rounded-full border-2 border-white/30`}
            style={{
              backgroundColor: chipColor.color,
              bottom: `${i * 3}px`,
              left: `${i * 1}px`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className={`${s.text} font-bold tabular-nums`}>
          {amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}
