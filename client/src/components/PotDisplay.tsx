import { Pot } from '@common/types';

interface PotDisplayProps {
  pots: Pot[];
}

export default function PotDisplay({ pots }: PotDisplayProps) {
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  if (totalPot === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full
                      border border-gold/30 pot-pulse">
        <div className="text-gold font-bold text-lg tabular-nums">
          Pot: {totalPot.toLocaleString()}
        </div>
      </div>
      {pots.length > 1 && (
        <div className="flex gap-2">
          {pots.map((pot, i) => (
            pot.amount > 0 && (
              <div key={i} className="bg-black/30 px-2 py-0.5 rounded text-xs text-white/70">
                {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount.toLocaleString()}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
