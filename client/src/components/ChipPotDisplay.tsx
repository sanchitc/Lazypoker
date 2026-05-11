import { useMemo, useRef, useEffect, useState } from 'react';
import { Pot, GameState } from '@common/types';
import { decomposeChips } from '../utils/chipUtils';
import { CHIP_COLORS } from '@common/constants';

interface ChipPotDisplayProps {
  pots: Pot[];
  gameState: GameState;
}

const PHASE_LABELS: Record<string, string> = {
  'PRE_FLOP': 'Pre-Flop',
  'FLOP': 'Flop',
  'TURN': 'Turn',
  'RIVER': 'River',
  'SHOWDOWN': 'Showdown',
  'HAND_COMPLETE': 'Hand Complete',
};

function ChipPile({ amount }: { amount: number }) {
  if (amount <= 0) return null;

  const breakdown = decomposeChips(amount);
  const topChips = Array.from(breakdown.entries())
    .sort(([a], [b]) => b - a)
    .slice(0, 5);

  return (
    <div className="flex items-end justify-center gap-0.5">
      {topChips.map(([denom, count]) => {
        const chipDef = CHIP_COLORS.find(c => c.value === denom) ?? CHIP_COLORS[0];
        const displayCount = Math.min(count, 4);
        return (
          <div key={denom} className="relative flex flex-col items-center" style={{ width: '22px' }}>
            {Array.from({ length: displayCount }).map((_, j) => (
              <div
                key={j}
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${chipDef.color}, color-mix(in oklab, ${chipDef.color} 65%, black))`,
                  marginTop: j > 0 ? '-14px' : 0,
                  zIndex: j,
                  border: '1px solid rgba(255,255,255,0.22)',
                  boxShadow: j === displayCount - 1
                    ? 'inset 0 1px 0 rgba(255,255,255,0.32), 0 4px 10px hsl(160 35% 6% / 0.55)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                {j === displayCount - 1 && (
                  <span
                    className="text-[7px] font-mono font-bold"
                    style={{
                      color: denom <= 1 ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)',
                      textShadow: 'inset 0 -1px 0 rgba(0,0,0,0.5)',
                    }}
                  >
                    {denom >= 1000 ? `${denom / 1000}K` : denom}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function ChipPotDisplay({ pots, gameState }: ChipPotDisplayProps) {
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
  const prevPotRef = useRef(totalPot);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (totalPot > prevPotRef.current) {
      setAnimating(true);
      prevPotRef.current = totalPot;
      const t = setTimeout(() => setAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevPotRef.current = totalPot;
  }, [totalPot]);

  const actionLine = useMemo(() => {
    if (!gameState.lastAction) return '';
    const actor = gameState.players.find(p => p.id === gameState.lastAction!.playerId);
    const name = actor?.name ?? 'Player';
    const action = gameState.lastAction.action;
    const amount = gameState.lastAction.amount;
    if (action.includes('raise') || action.includes('RAISE')) return `${name} raised to ${amount?.toLocaleString() ?? ''}`;
    if (action.includes('bet') || action.includes('BET')) return `${name} bet ${amount?.toLocaleString() ?? ''}`;
    if (action.includes('call') || action.includes('CALL')) return `${name} called${amount ? ` ${amount.toLocaleString()}` : ''}`;
    if (action.includes('check') || action.includes('CHECK')) return `Checked to you`;
    if (action.includes('fold') || action.includes('FOLD')) return `${name} folded`;
    if (action.includes('all') || action.includes('ALL')) return `${name} all-in${amount ? ` ${amount.toLocaleString()}` : ''}`;
    if (action.includes('wins')) return action;
    return `${name}: ${action}`;
  }, [gameState.lastAction, gameState.players]);

  const activePlayer = gameState.activePlayerIndex >= 0
    ? gameState.players[gameState.activePlayerIndex]
    : null;

  let contextLine = '';
  if (activePlayer && gameState.currentBet > activePlayer.currentBet) {
    const toCall = gameState.currentBet - activePlayer.currentBet;
    contextLine = `${toCall.toLocaleString()} to call`;
  } else if (activePlayer && gameState.currentBet <= activePlayer.currentBet) {
    contextLine = 'Check or bet';
  }

  if (totalPot === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-[10px] font-display italic tracking-[0.22em] uppercase
        ${gameState.phase === 'HAND_COMPLETE' ? 'text-brass' : 'text-bone-dim/75'}`}>
        {PHASE_LABELS[gameState.phase] ?? gameState.phase}
      </div>

      <div className={`relative rounded-[26px] px-6 py-4 transition-all
        ${totalPot > 0
          ? 'surface-panel'
          : 'surface-panel-soft'}
        ${animating ? 'animate-pot-grow' : ''}`}
      >
        {totalPot > 0 ? (
          <>
            <ChipPile amount={pots[0]?.amount ?? 0} />
            <div className="mt-2 text-center">
              <div className="mb-1 text-[9px] uppercase tracking-[0.3em] text-bone-dim">
                Pot
              </div>
              <span className="font-display tabular-display brass-shimmer-text text-[30px] leading-none">
                {totalPot.toLocaleString()}
              </span>
            </div>
            {pots.length > 1 && (
              <div className="mt-2 flex justify-center gap-2 pt-2 brass-hairline-t">
                {pots.slice(1).map((pot, i) => (
                  pot.amount > 0 && (
                    <span
                      key={i}
                      className="rounded-full border border-bone/10 bg-panel-soft/70 px-2 py-0.5 text-[9px] font-mono tabular-nums text-bone-dim"
                    >
                      Side: {pot.amount.toLocaleString()}
                    </span>
                  )
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="px-5 py-2 text-xs italic text-bone-dim/50 font-display">No pot</div>
        )}
      </div>

      {actionLine && (
        <div className="mt-0.5 max-w-[280px] text-center text-[11px] text-bone-dim/85 animate-fade-in">
          {actionLine}
        </div>
      )}

      {contextLine && (
        <div className="rounded-full border border-bone/8 bg-panel-strong/45 px-2.5 py-0.5 text-[10px] font-mono tabular-nums text-bone-dim/70">
          {contextLine}
        </div>
      )}
    </div>
  );
}
