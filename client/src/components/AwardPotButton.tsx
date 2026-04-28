import { useState } from 'react';
import { GameState } from '@common/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trophy } from 'lucide-react';

interface AwardPotButtonProps {
  gameState: GameState;
  canAward: boolean;
  onAward: (winnerIds: string[]) => void;
}

export default function AwardPotButton({ gameState, canAward, onAward }: AwardPotButtonProps) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
    }
  };

  const winnersLabel = selectedWinners.length === 0
    ? 'Select a winner'
    : selectedWinners.length === 1
      ? `Award ${totalPot.toLocaleString()} to ${inHandPlayers.find(p => p.id === selectedWinners[0])?.name}`
      : `Split ${totalPot.toLocaleString()} between ${selectedWinners.length} players`;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) setSelectedWinners([]); }}
    >
      <AlertDialogTrigger asChild>
        <button
          className="relative flex items-center gap-1.5 rounded-full px-3.5 py-2
                     border border-brass/20 bg-panel-strong/75 text-brass
                     text-xs font-bold uppercase tracking-[0.12em]
                     hover:border-brass/32 hover:bg-panel/90 active:scale-95 transition-all
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2"
        >
          <Trophy className="h-3.5 w-3.5" />
          Award Pot
          <span className="absolute inset-0 rounded-full shimmer pointer-events-none" />
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent className="felt-noise">
        <AlertDialogHeader>
          <AlertDialogTitle>Award Pot</AlertDialogTitle>
          <AlertDialogDescription>
            Pot: <span className="font-mono text-brass">{totalPot.toLocaleString()}</span>
            <span className="ml-1.5 text-bone-dim/70">— select winner(s)</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          {inHandPlayers.map(p => {
            const isSelected = selectedWinners.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleWinner(p.id)}
                className={`w-full rounded-xl py-2.5 px-3 text-left flex items-center justify-between
                  transition-all active:scale-[0.98]
                  ${isSelected
                    ? 'border border-brass/28 bg-brass/12 text-bone'
                    : 'border border-bone/8 bg-panel-soft/70 text-bone-dim hover:text-bone hover:bg-panel-soft/90'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold
                    ${isSelected
                      ? 'border-brass/38 bg-gradient-to-b from-[#f1dca8] to-brass text-obsidian'
                      : 'border-bone/10 bg-gradient-to-b from-panel-soft to-panel-strong text-bone'}`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-bone">{p.name}</div>
                    <div className="text-[11px] text-bone-dim font-mono tabular-nums">
                      {p.chips.toLocaleString()}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-brass rounded-full flex items-center justify-center">
                    <span className="text-[hsl(220_18%_8%)] font-bold text-sm">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={selectedWinners.length === 0}
            onClick={handleAward}
          >
            {winnersLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
