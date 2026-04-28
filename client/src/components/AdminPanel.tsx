import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Crown, Plus, Minus } from 'lucide-react';

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
  const isHandInProgress = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState.phase);
  const isHandComplete = gameState.phase === 'HAND_COMPLETE' || gameState.phase === 'WAITING';
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 right-3 z-50 flex h-11 w-11 items-center justify-center rounded-full
                   border border-brass/24 bg-panel-strong/82 text-brass
                   flex items-center justify-center shadow-lg
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2
                   hover:border-brass/36 hover:bg-panel active:scale-90 transition-all"
        aria-label="Banker panel"
      >
        <Crown className="h-5 w-5" />
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-sm sm:max-w-sm overflow-y-auto scrollbar-brass felt-noise"
        >
          <SheetHeader>
            <SheetTitle>Banker Panel</SheetTitle>
            <SheetDescription>Manage the table and pot.</SheetDescription>
          </SheetHeader>

          <div className="space-y-3">
            {(isHandComplete || gameState.phase === 'SETUP') && (
              <Button
                variant="check"
                size="lg"
                className="w-full"
                onClick={() => { sendAction({ type: 'START_HAND' }); setIsOpen(false); }}
              >
                Deal New Hand
              </Button>
            )}

            {gameState.mode === 'chip-only' && (isHandInProgress || (isHandComplete && totalPot > 0)) && (
              <Button
                variant="raise"
                size="lg"
                className="w-full"
                onClick={() => { setShowDeclareWinner(true); setSelectedWinners([]); }}
              >
                Declare Winner
              </Button>
            )}

            {showDeclareWinner && (
              <div className="surface-panel-soft rounded-[20px] p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-bone-dim">
                  Select winner(s)
                </div>
                {inHandPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleWinner(p.id)}
                    className={`w-full rounded-xl py-2 px-3 text-left flex items-center justify-between
                      transition-all active:scale-[0.98]
                      ${selectedWinners.includes(p.id)
                        ? 'border border-brass/28 bg-brass/12 text-bone'
                        : 'border border-bone/8 bg-panel/60 text-bone-dim hover:text-bone'}`}
                  >
                    <span className="text-sm">{p.name}</span>
                    {selectedWinners.includes(p.id) && <span className="text-brass">✓</span>}
                  </button>
                ))}
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDeclareWinner(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="raise"
                    className="flex-1"
                    disabled={selectedWinners.length === 0}
                    onClick={handleDeclareWinner}
                  >
                    Award Pot
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Player management */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-bone-dim mb-1">Players</div>
              {gameState.players.filter(p => p.seatIndex >= 0).map(p => (
                <div key={p.id} className="surface-panel-soft flex items-center justify-between rounded-xl py-2 px-3">
                  <div className="min-w-0">
                    <div className="text-sm text-bone truncate">{p.name}</div>
                    <div className="text-[11px] text-bone-dim font-mono tabular-nums">
                      {p.chips.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={showAddChips === p.id ? 'raise' : 'host'}
                      size="sm"
                      onClick={() => {
                        if (showAddChips === p.id) {
                          sendAction({ type: 'ADD_CHIPS', playerId: p.id, amount: addAmount });
                          setShowAddChips(null);
                        } else {
                          setShowAddChips(p.id);
                        }
                      }}
                    >
                      {showAddChips === p.id ? `+${addAmount}` : '+ Chips'}
                    </Button>
                    {p.id !== playerId && (
                      <Button
                        variant="fold"
                        size="sm"
                        onClick={() => sendAction({ type: 'KICK_PLAYER', playerId: p.id })}
                      >
                        Kick
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showAddChips && (
              <div className="surface-panel-soft rounded-[20px] p-3 space-y-2">
                <Label>Add chips amount</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAddAmount(Math.max(100, addAmount - 100))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="text-center font-mono text-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAddAmount(addAmount + 100)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[100, 250, 500, 1000, 2000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setAddAmount(amt)}
                      className={`rounded-full px-2.5 py-1 text-xs font-mono transition-colors
                        ${addAmount === amt
                          ? 'bg-gradient-to-b from-[#f1dca8] to-brass text-obsidian'
                          : 'bg-panel-soft text-bone-dim hover:text-bone'}`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <Button
              variant="fold"
              size="lg"
              className="w-full"
              onClick={() => {
                if (confirm('End the game?')) {
                  sendAction({ type: 'END_GAME' });
                  setIsOpen(false);
                }
              }}
            >
              End Game
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
