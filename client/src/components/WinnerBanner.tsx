import { useEffect, useState } from 'react';
import { GameState } from '@common/types';
import { Trophy } from 'lucide-react';

interface WinnerBannerProps {
  gameState: GameState;
}

export default function WinnerBanner({ gameState }: WinnerBannerProps) {
  const summary = gameState.lastHandSummary;
  const [visible, setVisible] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);

  // Re-trigger every time we get a new summary (different handNumber).
  useEffect(() => {
    if (!summary) { setVisible(false); return; }
    if (gameState.phase !== 'HAND_COMPLETE') { setVisible(false); return; }
    if (dismissedFor === summary.handNumber) return;
    setVisible(true);
  }, [summary?.handNumber, gameState.phase, dismissedFor]);

  if (!summary || !visible) return null;

  const winnerPlayers = summary.winners.map(w => {
    const p = gameState.players.find(pl => pl.id === w.playerId);
    return { ...w, name: p?.name ?? 'Unknown' };
  });

  const isSplit = winnerPlayers.length > 1;
  const headline = summary.reason === 'fold'
    ? 'Wins by Fold'
    : isSplit
      ? 'Split Pot'
      : 'Hand Winner';

  // First winner's hand description is representative when reason is showdown.
  // For split pots all winners share the same rank by definition.
  const handDesc = winnerPlayers[0]?.handDescription;

  const handleDismiss = () => {
    setDismissedFor(summary.handNumber);
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4
                 pointer-events-none"
      role="dialog"
      aria-label="Hand winner announcement"
    >
      <div
        className="pointer-events-auto relative w-full max-w-sm rounded-[28px]
                   surface-panel border border-brass/28
                   shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(212,168,67,0.18)_inset]
                   overflow-hidden animate-winner-pop"
        onClick={handleDismiss}
      >
        {/* Brass shimmer top accent */}
        <div className="absolute inset-x-0 top-0 h-px
                        bg-gradient-to-r from-transparent via-brass to-transparent" />
        {/* Soft radial spotlight */}
        <div className="absolute inset-0 pointer-events-none
                        bg-[radial-gradient(circle_at_50%_0%,hsl(40_70%_60%/0.18),transparent_60%)]" />

        <div className="relative px-5 pt-5 pb-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brass" />
            <span className="font-display text-[10px] uppercase tracking-[0.24em] text-brass/85">
              {headline}
            </span>
            <Trophy className="h-4 w-4 text-brass scale-x-[-1]" />
          </div>

          <div className="flex flex-col items-center gap-1 w-full">
            {winnerPlayers.map((w) => (
              <div key={w.playerId} className="flex items-center gap-2.5 w-full justify-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full
                                border border-brass/40
                                bg-gradient-to-b from-[#f1dca8] to-brass
                                text-obsidian text-sm font-bold shadow-md shadow-ink/40">
                  {w.name[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-base text-bone">{w.name}</span>
                  <span className="font-mono text-xs tabular-nums text-brass">
                    +{w.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {handDesc && (
            <div className="font-display brass-shimmer-text text-base text-center mt-1">
              {handDesc}
            </div>
          )}

          <div className="font-mono text-[11px] tabular-nums text-bone-dim/80 mt-1">
            Pot {summary.totalAwarded.toLocaleString()}
            {isSplit && ` · split ${winnerPlayers.length} ways`}
          </div>

          <button
            onClick={handleDismiss}
            className="mt-1 text-[10px] uppercase tracking-[0.18em] text-bone-dim/70
                       hover:text-bone transition-colors"
          >
            tap to dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
