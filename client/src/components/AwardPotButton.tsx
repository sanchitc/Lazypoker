import { useState } from 'react';
import { GameState, Player } from '@common/types';

interface AwardPotButtonProps {
  gameState: GameState;
  canAward: boolean;
  onAward: (winnerIds: string[]) => void;
}

export default function AwardPotButton({ gameState, canAward, onAward }: AwardPotButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);
  const inHandPlayers = gameState.players.filter(p => !p.isFolded && p.seatIndex >= 0);

  if (totalPot === 0 || !canAward) return null;

  const toggleWinner = (id: string) => {
    setSelectedWinners(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const handleAward = () => {
    if (selectedWinners.length > 0) {
      onAward(selectedWinners);
      setSelectedWinners([]);
      setIsOpen(false);
    }
  };

  // Collapsed: just a button
  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setSelectedWinners([]); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   bg-amber-900/40 border border-amber-700/40 text-amber-300
                   hover:bg-amber-900/60 active:scale-95 transition-all text-xs font-bold"
      >
        <span className="text-sm">&#x1F3C6;</span>
        Award Pot
      </button>
    );
  }

  // Expanded: winner selection
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
         onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-md bg-felt-dark rounded-t-2xl p-4 space-y-3 slide-in-up"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gold font-bold text-base">Award Pot</h3>
            <p className="text-white/40 text-xs">
              Select winner(s) — Pot: {totalPot.toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50"
          >
            ✕
          </button>
        </div>

        {/* Player selection */}
        <div className="space-y-1.5">
          {inHandPlayers.map(p => {
            const isSelected = selectedWinners.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleWinner(p.id)}
                className={`w-full py-2.5 px-3 rounded-xl text-left flex items-center justify-between
                  transition-all active:scale-[0.98]
                  ${isSelected
                    ? 'bg-gold/20 border-2 border-gold text-white'
                    : 'bg-white/5 border-2 border-transparent text-white/70 hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${isSelected ? 'bg-gold text-black' : 'bg-white/15 text-white'}`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-white/40 text-xs ml-2">{p.chips.toLocaleString()}</span>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-sm">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Award button */}
        <button
          onClick={handleAward}
          disabled={selectedWinners.length === 0}
          className="w-full py-3.5 bg-gold text-black rounded-xl font-black text-sm uppercase
                     active:scale-[0.97] transition-all disabled:opacity-30 disabled:cursor-default
                     shadow-lg shadow-gold/20"
        >
          {selectedWinners.length === 0
            ? 'Select a winner'
            : selectedWinners.length === 1
              ? `Award ${totalPot.toLocaleString()} to ${inHandPlayers.find(p => p.id === selectedWinners[0])?.name}`
              : `Split ${totalPot.toLocaleString()} between ${selectedWinners.length} players`}
        </button>
      </div>
    </div>
  );
}
