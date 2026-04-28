import { Pot } from '@common/types';

interface PotDisplayProps {
  pots: Pot[];
}

export default function PotDisplay({ pots }: PotDisplayProps) {
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  if (totalPot === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="surface-pill pot-pulse rounded-full px-6 py-2.5">
        <span className="mr-2 align-middle text-[10px] uppercase tracking-[0.26em] text-bone-dim">
          Pot
        </span>
        <span className="font-display tabular-display brass-shimmer-text align-middle text-[28px] leading-none">
          {totalPot.toLocaleString()}
        </span>
      </div>
      {pots.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {pots.map((pot, i) => (
            pot.amount > 0 && (
              <div
                key={i}
                className="surface-panel-soft rounded-full px-2.5 py-1 text-[10px] font-mono tabular-nums text-bone-dim"
              >
                {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount.toLocaleString()}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
