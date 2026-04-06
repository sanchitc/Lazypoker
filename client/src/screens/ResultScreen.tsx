import { useGame } from '../context/GameContext';

export default function ResultScreen() {
  const { gameSummary, dispatch } = useGame();

  if (!gameSummary) return null;

  const sorted = [...gameSummary.players].sort((a, b) => b.net - a.net);

  return (
    <div className="h-full flex flex-col items-center p-6">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">♠ ♥ ♦ ♣</div>
        <h1 className="text-2xl font-bold">Game Over</h1>
        <p className="text-white/50 text-sm mt-1">
          {gameSummary.handsPlayed} hand{gameSummary.handsPlayed !== 1 ? 's' : ''} played
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        {sorted.map((player, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-3 rounded-xl
              ${i === 0 ? 'bg-gold/20 border border-gold/40' : 'bg-white/5 border border-white/10'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${i === 0 ? 'bg-gold text-black' : 'bg-white/20'}`}>
                {i + 1}
              </div>
              <div>
                <div className="font-medium">{player.name}</div>
                <div className="text-xs text-white/50">
                  Buy-in: {player.buyIn.toLocaleString()} · Cash: {player.cashOut.toLocaleString()}
                </div>
              </div>
            </div>
            <div className={`font-bold tabular-nums
              ${player.net > 0 ? 'text-green-400' : player.net < 0 ? 'text-red-400' : 'text-white/50'}`}>
              {player.net > 0 ? '+' : ''}{player.net.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          localStorage.removeItem('lazypoker_session');
          dispatch({ type: 'RESET' });
          window.history.pushState(null, '', '/');
        }}
        className="mt-8 py-3 px-8 bg-gold text-black font-bold rounded-xl
                   active:scale-95 transition-all"
      >
        New Game
      </button>
    </div>
  );
}
