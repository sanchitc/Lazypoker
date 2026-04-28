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

    if (toCall > 0 && toCall < stack) {
      result.push({ label: `Call ${toCall}`, amount: toCall, variant: 'default' });
    }

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

    if (totalPot > 0 && gameState.phase !== 'PRE_FLOP') {
      const halfPot = Math.floor(totalPot / 2);
      const fullPot = totalPot;
      const toHalfPot = toCall > 0 ? Math.max(halfPot, toCall) : halfPot;
      const toFullPot = toCall > 0 ? Math.max(fullPot, toCall) : fullPot;

      if (toHalfPot > 0 && toHalfPot < stack) {
        result.push({ label: '½ Pot', amount: toHalfPot, variant: 'accent' });
      }
      if (toFullPot > 0 && toFullPot < stack && toFullPot !== toHalfPot) {
        result.push({ label: 'Pot', amount: toFullPot, variant: 'accent' });
      }
    }

    if (stack > 0) {
      result.push({ label: 'All-in', amount: stack, variant: 'danger' });
    }

    return result;
  }, [gameState, currentPlayer]);

  if (helpers.length === 0) return null;

  const variantStyles = {
    default: 'bg-panel-soft/72 border-bone/10 text-bone hover:border-brass/26 hover:bg-panel-soft/90',
    accent: 'bg-brass/12 border-brass/28 text-brass hover:bg-brass/18',
    danger: 'bg-ember/12 border-ember/30 text-[hsl(10_78%_76%)] hover:bg-ember/18',
  };

  return (
    <div className="flex flex-wrap justify-center gap-1.5 px-1">
      {helpers.map(h => (
        <button
          key={h.label}
          disabled={disabled}
          onClick={() => onSetAmount(h.amount)}
          className={`rounded-full border px-3.5 py-1.5 text-[11px] font-mono font-semibold tabular-nums transition-all
            focus:outline-none focus-visible:ring-2 focus-visible:ring-brass
            ${disabled
              ? 'bg-panel-strong/45 border-bone/6 text-bone-dim/30 cursor-default'
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
