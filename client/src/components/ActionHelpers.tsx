import { useMemo } from 'react';
import { GameState, Player } from '@common/types';

interface ActionHelpersProps {
  gameState: GameState;
  currentPlayer: Player;
  onSetAmount: (amount: number) => void;
  disabled: boolean;
}

interface Helper {
  label: string;
  amount: number;
  variant: 'default' | 'accent' | 'danger';
}

export default function ActionHelpers({ gameState, currentPlayer, onSetAmount, disabled }: ActionHelpersProps) {
  const helpers = useMemo(() => {
    const result: Helper[] = [];
    const toCall = gameState.currentBet - currentPlayer.currentBet;
    const stack = currentPlayer.chips;
    const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);
    const minRaiseTotal = gameState.currentBet + gameState.minRaise;

    // Exact Call
    if (toCall > 0 && toCall < stack) {
      result.push({ label: `Call ${toCall}`, amount: toCall, variant: 'default' });
    }

    // Min Raise / Min Bet
    if (toCall <= 0) {
      const minBet = gameState.minRaise;
      if (minBet < stack) {
        result.push({ label: `Min ${minBet}`, amount: minBet, variant: 'default' });
      }
    } else if (minRaiseTotal <= currentPlayer.currentBet + stack) {
      const minRaiseChips = minRaiseTotal - currentPlayer.currentBet;
      if (minRaiseChips > toCall && minRaiseChips < stack) {
        result.push({ label: `Min ${minRaiseChips}`, amount: minRaiseChips, variant: 'default' });
      }
    }

    // Pot-based helpers
    if (totalPot > 0 && gameState.phase !== 'PRE_FLOP') {
      const halfPot = Math.floor(totalPot / 2);
      const fullPot = totalPot;
      const toHalfPot = toCall > 0 ? Math.max(halfPot, toCall) : halfPot;
      const toFullPot = toCall > 0 ? Math.max(fullPot, toCall) : fullPot;

      if (toHalfPot > 0 && toHalfPot < stack) {
        result.push({ label: '1/2 Pot', amount: toHalfPot, variant: 'accent' });
      }
      if (toFullPot > 0 && toFullPot < stack && toFullPot !== toHalfPot) {
        result.push({ label: 'Pot', amount: toFullPot, variant: 'accent' });
      }
    }

    // All-in
    if (stack > 0) {
      result.push({ label: 'All-in', amount: stack, variant: 'danger' });
    }

    return result;
  }, [gameState, currentPlayer]);

  if (helpers.length === 0) return null;

  const variantStyles = {
    default: 'bg-white/10 border-white/15 text-white/80 hover:bg-white/20',
    accent: 'bg-gold/15 border-gold/25 text-gold hover:bg-gold/25',
    danger: 'bg-red-500/15 border-red-500/25 text-red-300 hover:bg-red-500/25',
  };

  return (
    <div className="flex gap-1.5 flex-wrap justify-center px-1">
      {helpers.map(h => (
        <button
          key={h.label}
          disabled={disabled}
          onClick={() => onSetAmount(h.amount)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border
            ${disabled
              ? 'bg-white/5 border-white/5 text-white/20 cursor-default'
              : `${variantStyles[h.variant]} active:scale-95`
            }`}
          aria-label={`${h.label} ${h.amount}`}
        >
          {h.label}
        </button>
      ))}
    </div>
  );
}
