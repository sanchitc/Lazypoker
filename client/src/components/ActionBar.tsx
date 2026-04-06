import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';

export default function ActionBar() {
  const { gameState, playerId, roomCode, isMyTurn, currentPlayer } = useGame();
  const { socket } = useSocket();
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);

  if (!gameState || !playerId || !roomCode || !currentPlayer) return null;

  const { callAmount, minRaise, maxRaise, canCheck, canCall, canRaise } = useMemo(() => {
    const toCall = gameState.currentBet - currentPlayer.currentBet;
    const min = gameState.currentBet + gameState.minRaise;
    const max = currentPlayer.chips + currentPlayer.currentBet;
    return {
      callAmount: Math.min(toCall, currentPlayer.chips),
      minRaise: Math.min(min, max),
      maxRaise: max,
      canCheck: toCall <= 0,
      canCall: toCall > 0 && toCall < currentPlayer.chips,
      canRaise: currentPlayer.chips > toCall,
    };
  }, [gameState, currentPlayer]);

  const sendAction = (type: string, amount?: number) => {
    socket?.emit('action', {
      roomCode,
      playerId,
      action: amount !== undefined ? { type, amount } as any : { type } as any,
    });
    setShowRaiseSlider(false);
  };

  // Calculate pot for bet sizing buttons
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);

  if (!isMyTurn) {
    // Show waiting state
    const activePlayer = gameState.activePlayerIndex >= 0
      ? gameState.players[gameState.activePlayerIndex]
      : null;

    return (
      <div className="p-4 text-center">
        {activePlayer ? (
          <div className="text-white/50 text-sm">
            Waiting for <span className="text-white font-medium">{activePlayer.name}</span>...
          </div>
        ) : (
          <div className="text-white/50 text-sm">Waiting...</div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 animate-slide-up">
      {/* Raise slider */}
      {showRaiseSlider && (
        <div className="bg-white/5 rounded-xl p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Raise to:</span>
            <span className="text-gold font-bold tabular-nums">{raiseAmount.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            step={gameState.bigBlind}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
            className="w-full accent-gold"
          />
          <div className="flex gap-1.5 flex-wrap">
            {/* Quick bet buttons */}
            {totalPot > 0 && [
              { label: '½ Pot', amount: Math.max(minRaise, Math.floor(totalPot / 2)) },
              { label: '¾ Pot', amount: Math.max(minRaise, Math.floor(totalPot * 0.75)) },
              { label: 'Pot', amount: Math.max(minRaise, totalPot) },
            ].filter(b => b.amount <= maxRaise).map(b => (
              <button
                key={b.label}
                onClick={() => setRaiseAmount(b.amount)}
                className="px-2 py-1 bg-white/10 rounded text-xs hover:bg-white/20"
              >
                {b.label}
              </button>
            ))}
            <button
              onClick={() => setRaiseAmount(minRaise)}
              className="px-2 py-1 bg-white/10 rounded text-xs hover:bg-white/20"
            >
              Min
            </button>
            <button
              onClick={() => setRaiseAmount(maxRaise)}
              className="px-2 py-1 bg-white/10 rounded text-xs hover:bg-white/20"
            >
              Max
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRaiseSlider(false)}
              className="flex-1 py-2 bg-white/10 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => sendAction('RAISE', raiseAmount)}
              className="flex-1 py-2 bg-gold text-black rounded-lg text-sm font-bold"
            >
              Raise to {raiseAmount.toLocaleString()}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showRaiseSlider && (
        <div className="flex gap-2">
          {/* Fold */}
          <button
            onClick={() => sendAction('FOLD')}
            className="flex-1 py-3 bg-red-600/80 hover:bg-red-600 rounded-xl font-bold text-sm
                       active:scale-95 transition-all"
          >
            Fold
          </button>

          {/* Check/Call */}
          {canCheck ? (
            <button
              onClick={() => sendAction('CHECK')}
              className="flex-1 py-3 bg-green-600/80 hover:bg-green-600 rounded-xl font-bold text-sm
                         active:scale-95 transition-all"
            >
              Check
            </button>
          ) : canCall ? (
            <button
              onClick={() => sendAction('CALL')}
              className="flex-1 py-3 bg-green-600/80 hover:bg-green-600 rounded-xl font-bold text-sm
                         active:scale-95 transition-all"
            >
              Call {callAmount.toLocaleString()}
            </button>
          ) : null}

          {/* Raise */}
          {canRaise && (
            <button
              onClick={() => {
                setRaiseAmount(minRaise);
                setShowRaiseSlider(true);
              }}
              className="flex-1 py-3 bg-gold/80 hover:bg-gold text-black rounded-xl font-bold text-sm
                         active:scale-95 transition-all"
            >
              Raise
            </button>
          )}

          {/* All-in */}
          <button
            onClick={() => sendAction('ALL_IN')}
            className="py-3 px-4 bg-yellow-500/80 hover:bg-yellow-500 text-black rounded-xl font-bold text-xs
                       active:scale-95 transition-all"
          >
            All In
          </button>
        </div>
      )}
    </div>
  );
}
