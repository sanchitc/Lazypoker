import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ActionBar() {
  const { gameState, playerId, roomCode, isMyTurn, currentPlayer } = useGame();
  const { socket } = useSocket();
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [showAllInConfirm, setShowAllInConfirm] = useState(false);

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

  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);
  const actions = [
    <Button key="fold" variant="fold" size="lg" className="w-full" onClick={() => sendAction('FOLD')}>
      Fold
    </Button>,
    canCheck ? (
      <Button key="check" variant="check" size="lg" className="w-full" onClick={() => sendAction('CHECK')}>
        Check
      </Button>
    ) : canCall ? (
      <Button key="call" variant="call" size="lg" className="w-full" onClick={() => sendAction('CALL')}>
        Call <span className="ml-1 font-mono">{callAmount.toLocaleString()}</span>
      </Button>
    ) : null,
    canRaise ? (
      <Button
        key="raise"
        variant="raise"
        size="lg"
        className="w-full"
        onClick={() => {
          setRaiseAmount(minRaise);
          setShowRaiseSlider(true);
        }}
      >
        Raise
      </Button>
    ) : null,
    <Button key="allin" variant="allin" size="lg" className="w-full" onClick={() => setShowAllInConfirm(true)}>
      All In
    </Button>,
  ].filter(Boolean);

  if (!isMyTurn) {
    const activePlayer = gameState.activePlayerIndex >= 0
      ? gameState.players[gameState.activePlayerIndex]
      : null;
    const isBettingPaused = gameState.mode === 'chip-only'
      && gameState.activePlayerIndex === -1
      && ['FLOP', 'TURN', 'RIVER'].includes(gameState.phase);
    const streetName = gameState.phase === 'FLOP' ? 'flop'
      : gameState.phase === 'TURN' ? 'turn'
      : gameState.phase === 'RIVER' ? 'river' : '';

    return (
      <div className="control-rail px-3 py-3 text-center">
        <div className="surface-pill mx-auto max-w-2xl rounded-[22px] px-4 py-3">
          {isBettingPaused ? (
            <div className="text-xs uppercase tracking-[0.22em] text-brass/80">
              Deal the {streetName} — waiting for host
            </div>
          ) : activePlayer ? (
            <div className="text-xs uppercase tracking-[0.22em] text-bone-dim">
              Waiting for <span className="text-bone font-medium normal-case">{activePlayer.name}</span>
            </div>
          ) : (
            <div className="text-xs uppercase tracking-[0.22em] text-bone-dim">Waiting…</div>
          )}
        </div>
      </div>
    );
  }

  // Snap-to bet sizing — match against current raise amount
  const presets = [
    totalPot > 0 ? { value: 'half', label: '½ Pot', amount: Math.max(minRaise, Math.floor(totalPot / 2)) } : null,
    totalPot > 0 ? { value: 'three-quarter', label: '¾ Pot', amount: Math.max(minRaise, Math.floor(totalPot * 0.75)) } : null,
    totalPot > 0 ? { value: 'pot', label: 'Pot', amount: Math.max(minRaise, totalPot) } : null,
    { value: 'min', label: 'Min', amount: minRaise },
    { value: 'max', label: 'Max', amount: maxRaise },
  ].filter(Boolean).filter(p => p!.amount <= maxRaise) as { value: string; label: string; amount: number }[];

  const matchedPreset = presets.find(p => p.amount === raiseAmount)?.value ?? '';

  return (
    <div className="control-rail px-3 pb-3 pt-2 animate-slide-up">
      <div className="mx-auto max-w-5xl rounded-[26px] surface-panel p-3 sm:p-4">
        {showRaiseSlider ? (
          <div className="space-y-3 rounded-[22px] border border-bone/10 bg-panel-strong/55 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-bone-dim">Raise to</div>
                <div className="mt-1 text-[11px] font-mono tabular-nums text-bone-dim/70">
                  Min {minRaise.toLocaleString()} · Max {maxRaise.toLocaleString()}
                </div>
              </div>
              <span className="font-display tabular-display text-[40px] leading-none text-brass">
                {raiseAmount.toLocaleString()}
              </span>
            </div>

            <Slider
              min={minRaise}
              max={maxRaise}
              step={gameState.bigBlind}
              value={[raiseAmount]}
              onValueChange={(v) => setRaiseAmount(v[0])}
            />

            <div className="flex justify-between text-[10px] font-mono tabular-nums text-bone-dim/60">
              <span>{minRaise.toLocaleString()}</span>
              <span>{maxRaise.toLocaleString()}</span>
            </div>

            <ToggleGroup
              type="single"
              value={matchedPreset}
              onValueChange={(v) => {
                const preset = presets.find(p => p.value === v);
                if (preset) setRaiseAmount(preset.amount);
              }}
              className="w-full flex-wrap"
            >
              {presets.map(p => (
                <ToggleGroupItem key={p.value} value={p.value} className="py-1.5 text-[11px]">
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowRaiseSlider(false)}
              >
                Cancel
              </Button>
              <Button
                variant="raise"
                className="w-full"
                onClick={() => sendAction('RAISE', raiseAmount)}
              >
                Raise to {raiseAmount.toLocaleString()}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:[grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            {actions}
          </div>
        )}
      </div>

      <AlertDialog open={showAllInConfirm} onOpenChange={setShowAllInConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go all in?</AlertDialogTitle>
            <AlertDialogDescription>
              This will commit your entire stack of{' '}
              <span className="font-mono tabular-nums text-bone">
                {currentPlayer.chips.toLocaleString()}
              </span>{' '}
              chips. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                sendAction('ALL_IN');
                setShowAllInConfirm(false);
              }}
            >
              Confirm All In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
