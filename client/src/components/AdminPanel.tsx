import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Player } from '@common/types';

export default function AdminPanel() {
  const { gameState, playerId, roomCode, isAdmin } = useGame();
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddChips, setShowAddChips] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState(500);
  const [showDeclareWinner, setShowDeclareWinner] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);

  if (!isAdmin || !gameState || !playerId || !roomCode) return null;

  const sendAction = (action: any) => {
    socket?.emit('action', { roomCode, playerId, action });
  };

  const handleDeclareWinner = () => {
    if (selectedWinners.length > 0) {
      sendAction({ type: 'DECLARE_WINNER', winnerIds: selectedWinners });
      setShowDeclareWinner(false);
      setSelectedWinners([]);
    }
  };

  const toggleWinner = (id: string) => {
    setSelectedWinners(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const inHandPlayers = gameState.players.filter(p => !p.isFolded && p.seatIndex >= 0);
  const isHandInProgress = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'BETTING_ROUND'].includes(gameState.phase);
  const isHandComplete = gameState.phase === 'HAND_COMPLETE' || gameState.phase === 'WAITING';

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 right-3 z-50 w-10 h-10 bg-gold text-black rounded-full
                   font-bold text-lg shadow-lg active:scale-90 transition-transform"
      >
        ★
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center"
             onClick={() => setIsOpen(false)}>
          <div className="w-full max-w-md bg-felt-dark rounded-t-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gold font-bold text-lg">Banker Panel</h3>
              <button onClick={() => setIsOpen(false)} className="text-white/50 text-2xl">&times;</button>
            </div>

            {/* Start new hand */}
            {(isHandComplete || gameState.phase === 'SETUP') && (
              <button
                onClick={() => { sendAction({ type: 'START_HAND' }); setIsOpen(false); }}
                className="w-full py-3 bg-green-600 rounded-xl font-bold active:scale-95 transition-all"
              >
                Deal New Hand
              </button>
            )}

            {/* Chip-only mode controls */}
            {gameState.mode === 'chip-only' && isHandInProgress && (
              <>
                <button
                  onClick={() => sendAction({ type: 'NEXT_ROUND' })}
                  className="w-full py-3 bg-blue-600 rounded-xl font-bold active:scale-95 transition-all"
                >
                  Next Betting Round
                </button>

                <button
                  onClick={() => { setShowDeclareWinner(true); setSelectedWinners([]); }}
                  className="w-full py-3 bg-gold text-black rounded-xl font-bold active:scale-95 transition-all"
                >
                  Declare Winner
                </button>
              </>
            )}

            {/* Declare winner modal */}
            {showDeclareWinner && (
              <div className="bg-white/5 rounded-xl p-3 space-y-2">
                <h4 className="text-sm font-semibold text-white/70">Select winner(s):</h4>
                {inHandPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleWinner(p.id)}
                    className={`w-full py-2 px-3 rounded-lg text-left flex items-center justify-between
                      ${selectedWinners.includes(p.id)
                        ? 'bg-gold/30 border border-gold'
                        : 'bg-white/5 border border-white/10'}`}
                  >
                    <span>{p.name}</span>
                    {selectedWinners.includes(p.id) && <span className="text-gold">✓</span>}
                  </button>
                ))}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setShowDeclareWinner(false)}
                    className="flex-1 py-2 bg-white/10 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeclareWinner}
                    disabled={selectedWinners.length === 0}
                    className="flex-1 py-2 bg-gold text-black rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    Award Pot
                  </button>
                </div>
              </div>
            )}

            {/* Player management */}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white/50 mt-2">Players</h4>
              {gameState.players.filter(p => p.seatIndex >= 0).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                  <div>
                    <span className="text-sm">{p.name}</span>
                    <span className="text-xs text-white/50 ml-2">{p.chips.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (showAddChips === p.id) {
                          sendAction({ type: 'ADD_CHIPS', playerId: p.id, amount: addAmount });
                          setShowAddChips(null);
                        } else {
                          setShowAddChips(p.id);
                        }
                      }}
                      className="px-2 py-1 bg-green-600/50 rounded text-xs hover:bg-green-600"
                    >
                      {showAddChips === p.id ? `+${addAmount}` : '+Chips'}
                    </button>
                    {p.id !== playerId && (
                      <button
                        onClick={() => sendAction({ type: 'KICK_PLAYER', playerId: p.id })}
                        className="px-2 py-1 bg-red-600/50 rounded text-xs hover:bg-red-600"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add chips amount selector */}
            {showAddChips && (
              <div className="flex gap-1 flex-wrap">
                {[100, 250, 500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAddAmount(amt)}
                    className={`px-2 py-1 rounded text-xs ${addAmount === amt ? 'bg-gold text-black' : 'bg-white/10'}`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            )}

            {/* End game */}
            <button
              onClick={() => {
                if (confirm('End the game?')) {
                  sendAction({ type: 'END_GAME' });
                  setIsOpen(false);
                }
              }}
              className="w-full py-3 bg-red-600/50 rounded-xl text-sm active:scale-95 transition-all"
            >
              End Game
            </button>
          </div>
        </div>
      )}
    </>
  );
}
