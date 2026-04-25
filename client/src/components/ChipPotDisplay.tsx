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
                className="w-[22px] h-[22px] rounded-full border-2 border-white/25 flex items-center justify-center"
                style={{
                  backgroundColor: chipDef.color,
                  marginTop: j > 0 ? '-14px' : 0,
                  zIndex: j,
                  boxShadow: j === displayCount - 1
                    ? '0 3px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                    : '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                {j === displayCount - 1 && (
                  <span className={`text-[7px] font-bold
                    ${denom >= 500 ? 'text-white' : denom <= 1 ? 'text-gray-600' : 'text-white'}`}>
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
  const isActiveHand = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState.phase);
  const prevPotRef = useRef(totalPot);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (totalPot > prevPotRef.current) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 400);
      return () => clearTimeout(t);
    }
    prevPotRef.current = totalPot;
  }, [totalPot]);

  // Build action line
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

  // To-call context
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

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Phase label */}
      <div className={`text-xs font-bold tracking-widest uppercase
        ${gameState.phase === 'HAND_COMPLETE' ? 'text-gold' : 'text-white/60'}`}>
        {PHASE_LABELS[gameState.phase] ?? gameState.phase}
      </div>

      {/* Main pot display */}
      <div className={`relative px-6 py-3 rounded-2xl transition-all
        ${totalPot > 0
          ? 'bg-black/40 backdrop-blur-sm border border-gold/20 shadow-lg shadow-gold/5'
          : 'bg-black/20 border border-white/5'}
        ${animating ? 'animate-pot-grow' : ''}`}
      >
        {totalPot > 0 ? (
          <>
            <ChipPile amount={pots[0]?.amount ?? 0} />
            <div className="text-center mt-1.5">
              <span className="text-gold font-black text-xl tabular-nums">
                {totalPot.toLocaleString()}
              </span>
            </div>
            {/* Side pots indicator */}
            {pots.length > 1 && (
              <div className="flex gap-2 justify-center mt-1">
                {pots.slice(1).map((pot, i) => (
                  pot.amount > 0 && (
                    <span key={i} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full text-white/50 tabular-nums">
                      Side: {pot.amount.toLocaleString()}
                    </span>
                  )
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-white/20 text-sm py-2 px-4">No pot</div>
        )}
      </div>

      {/* Action line */}
      {actionLine && (
        <div className="text-[11px] text-white/50 animate-fade-in mt-0.5 text-center max-w-[250px]">
          {actionLine}
        </div>
      )}

      {/* Context line */}
      {contextLine && (
        <div className="text-[10px] text-white/35">
          {contextLine}
        </div>
      )}
    </div>
  );
}
