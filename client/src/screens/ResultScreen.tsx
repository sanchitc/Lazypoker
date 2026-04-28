import { useGame } from '../context/GameContext';
import { Button } from '@/components/ui/button';

const CONFETTI = Array.from({ length: 12 });

export default function ResultScreen() {
  const { gameSummary, dispatch } = useGame();

  if (!gameSummary) return null;

  const sorted = [...gameSummary.players].sort((a, b) => b.net - a.net);
  const winner = sorted[0];

  return (
    <div className="h-full flex flex-col items-center p-6 felt-noise vignette relative overflow-hidden">
      {/* Brass particle confetti */}
      {CONFETTI.map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-0 w-1.5 h-3 bg-brass rounded-sm opacity-70 animate-pulse"
          style={{
            left: `${(i * 8.3) % 100}%`,
            top: `${(i * 13) % 80}%`,
            animationDelay: `${(i * 230) % 1500}ms`,
            animationDuration: `${1500 + (i * 137) % 1200}ms`,
            transform: `rotate(${(i * 47) % 360}deg)`,
          }}
        />
      ))}

      <div className="text-center mb-8 relative z-10">
        <div className="text-2xl mb-3 tracking-[0.6em] text-brass/40 select-none">
          ♠ ♥ ♦ ♣
        </div>
        <div className="text-[10px] font-display italic uppercase tracking-[0.32em] text-bone-dim mb-1">
          Winner
        </div>
        <h1 className="font-display italic text-5xl text-bone tracking-tight leading-none">
          {winner?.name ?? 'Game Over'}
        </h1>
        <div className="font-display tabular-display brass-shimmer-text text-3xl mt-3">
          {winner.net > 0 ? '+' : ''}{winner.net.toLocaleString()}
        </div>
        <p className="text-bone-dim/80 text-xs mt-3 uppercase tracking-[0.2em]">
          {gameSummary.handsPlayed} hand{gameSummary.handsPlayed !== 1 ? 's' : ''} played
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2 relative z-10">
        {sorted.map((player, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-3 rounded-md
              ${i === 0
                ? 'bg-brass/15 border border-brass/40'
                : 'bg-felt-rim/40 border border-brass/15'}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-sm font-bold
                brass-hairline shadow-md
                ${i === 0 ? 'bg-brass text-[hsl(220_18%_8%)]' : 'bg-felt-rim text-bone'}`}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-bone truncate">{player.name}</div>
                <div className="text-[11px] text-bone-dim font-mono tabular-nums">
                  Buy {player.buyIn.toLocaleString()} · Cash {player.cashOut.toLocaleString()}
                </div>
              </div>
            </div>
            <div className={`font-display tabular-display text-lg
              ${player.net > 0 ? 'text-[hsl(142_46%_64%)]' : player.net < 0 ? 'text-ember' : 'text-bone-dim'}`}>
              {player.net > 0 ? '+' : ''}{player.net.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="raise"
        size="xl"
        className="mt-8 px-10 relative z-10"
        onClick={() => {
          localStorage.removeItem('lazypoker_session');
          dispatch({ type: 'RESET' });
          window.history.pushState(null, '', '/');
        }}
      >
        New Game
      </Button>
    </div>
  );
}
