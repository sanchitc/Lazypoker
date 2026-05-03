import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function TeenPattiActionBar() {
  const { gameState, playerId, roomCode, isMyTurn, currentPlayer } = useGame();
  const { socket } = useSocket();
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [raiseStake, setRaiseStake] = useState(0);

  const tp = gameState?.teenPatti;
  const stake = gameState?.currentBet ?? 0;
  const seen = !!currentPlayer?.hasSeenCards;

  const { activeCount, isSideshowEligible, prevSeenAvailable, isShowEligible, showCost } = useMemo(() => {
    if (!gameState || !currentPlayer) {
      return { activeCount: 0, isSideshowEligible: false, prevSeenAvailable: false, isShowEligible: false, showCost: 0 };
    }
    const active = gameState.players
      .filter(p => p.seatIndex >= 0 && !p.isFolded && !p.isSittingOut)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const activeCount = active.length;

    // Sideshow: requires 3+ active, requester seen, previous active player also seen.
    let prevSeenAvailable = false;
    if (seen && activeCount >= 3) {
      const others = active.filter(p => p.seatIndex !== currentPlayer.seatIndex);
      const sorted = others.sort((a, b) => a.seatIndex - b.seatIndex);
      let prev = null as (typeof active[number] | null);
      for (const p of sorted) {
        if (p.seatIndex < currentPlayer.seatIndex) prev = p;
        else break;
      }
      if (!prev) prev = sorted[sorted.length - 1];
      prevSeenAvailable = !!prev?.hasSeenCards;
    }
    const isSideshowEligible =
      seen && activeCount >= 3 && prevSeenAvailable && !currentPlayer.sideshowDeclined;

    // Show: only with exactly 2 active players. Seen-vs-blind by seen caller forbidden.
    let isShowEligible = false;
    let showCost = 0;
    if (activeCount === 2) {
      const opponent = active.find(p => p.id !== currentPlayer.id);
      if (opponent) {
        if (seen && !opponent.hasSeenCards) {
          isShowEligible = false;
        } else {
          isShowEligible = true;
          showCost = (seen ? 2 : 1) * stake;
        }
      }
    }
    return { activeCount, isSideshowEligible, prevSeenAvailable, isShowEligible, showCost };
  }, [gameState, currentPlayer, seen, stake]);

  if (!gameState || !playerId || !roomCode || !currentPlayer || !tp) return null;

  const sendAction = (action: any) => {
    socket?.emit('action', { roomCode, playerId, action });
    setShowRaiseSlider(false);
  };

  // Sideshow pending: target gets accept/decline overlay regardless of turn.
  const pending = gameState.pendingSideshow;
  if (gameState.phase === 'SIDESHOW_PENDING' && pending && pending.targetId === playerId) {
    const requester = gameState.players.find(p => p.id === pending.requesterId);
    return (
      <div className="control-rail px-3 pb-3 pt-2 animate-slide-up">
        <div className="mx-auto max-w-2xl rounded-[26px] surface-panel p-3">
          <div className="text-center text-xs uppercase tracking-[0.18em] text-brass mb-2">
            Sideshow request from <span className="text-bone normal-case">{requester?.name ?? 'opponent'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="check" size="lg" onClick={() => sendAction({ type: 'RESPOND_SIDESHOW', accept: true })}>
              Accept
            </Button>
            <Button variant="fold" size="lg" onClick={() => sendAction({ type: 'RESPOND_SIDESHOW', accept: false })}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Requester sees a waiting pill instead of the regular action bar while
  // the target decides — otherwise the still-active action bar is misleading.
  if (gameState.phase === 'SIDESHOW_PENDING' && pending && pending.requesterId === playerId) {
    const target = gameState.players.find(p => p.id === pending.targetId);
    return (
      <div className="control-rail px-3 py-3 text-center">
        <div className="surface-pill mx-auto max-w-2xl rounded-[22px] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.22em] text-bone-dim">
            Waiting for <span className="text-bone font-medium normal-case">{target?.name ?? 'opponent'}</span> to respond to sideshow…
          </div>
        </div>
      </div>
    );
  }

  if (!isMyTurn) {
    const activePlayer = gameState.activePlayerIndex >= 0 ? gameState.players[gameState.activePlayerIndex] : null;
    return (
      <div className="control-rail px-3 py-3 text-center">
        <div className="surface-pill mx-auto max-w-2xl rounded-[22px] px-4 py-3">
          {activePlayer ? (
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

  const chaalCost = (seen ? 2 : 1) * stake;
  const canChaal = currentPlayer.chips >= chaalCost;

  // Raise stake bounds: new stake > current; cost = (seen?2:1)*newStake; cost ≤ chaalLimit*currentStake.
  const chaalLimit = tp.chaalLimitMultiplier * stake;
  const costMul = seen ? 2 : 1;
  const minStake = stake + 1;
  const maxStakeFromLimit = Math.floor(chaalLimit / costMul);
  const maxStakeFromChips = Math.floor(currentPlayer.chips / costMul);
  const maxStake = Math.min(maxStakeFromLimit, maxStakeFromChips);
  const canRaise = maxStake >= minStake;

  const presets = [
    { value: '2x', label: '2× stake', amount: 2 * stake },
    { value: '3x', label: '3× stake', amount: 3 * stake },
    { value: 'max', label: 'Max', amount: maxStake },
  ].filter(p => p.amount >= minStake && p.amount <= maxStake);
  const matchedPreset = presets.find(p => p.amount === raiseStake)?.value ?? '';

  return (
    <div className="control-rail px-3 pb-3 pt-2 animate-slide-up">
      <div className="mx-auto max-w-5xl rounded-[26px] surface-panel p-3 sm:p-4">
        {showRaiseSlider ? (
          <div className="space-y-3 rounded-[22px] border border-bone/10 bg-panel-strong/55 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-bone-dim">New stake</div>
                <div className="mt-1 text-[11px] font-mono tabular-nums text-bone-dim/70">
                  Pay {(costMul * raiseStake).toLocaleString()} ({seen ? '2×' : '1×'} stake)
                </div>
              </div>
              <span className="font-display tabular-display text-[40px] leading-none text-brass">
                {raiseStake.toLocaleString()}
              </span>
            </div>

            <Slider
              min={minStake}
              max={maxStake}
              step={1}
              value={[raiseStake]}
              onValueChange={(v) => setRaiseStake(v[0])}
            />

            <div className="flex justify-between text-[10px] font-mono tabular-nums text-bone-dim/60">
              <span>{minStake.toLocaleString()}</span>
              <span>{maxStake.toLocaleString()}</span>
            </div>

            {presets.length > 0 && (
              <ToggleGroup
                type="single"
                value={matchedPreset}
                onValueChange={(v) => {
                  const preset = presets.find(p => p.value === v);
                  if (preset) setRaiseStake(preset.amount);
                }}
                className="w-full flex-wrap"
              >
                {presets.map(p => (
                  <ToggleGroupItem key={p.value} value={p.value} className="py-1.5 text-[11px]">
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" className="w-full" onClick={() => setShowRaiseSlider(false)}>
                Cancel
              </Button>
              <Button
                variant="raise"
                className="w-full"
                onClick={() => sendAction({ type: 'RAISE_TP', amount: raiseStake })}
              >
                Raise to {raiseStake.toLocaleString()}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center text-[10px] uppercase tracking-[0.22em] text-brass/80 pb-2">
              Stake {stake.toLocaleString()} · your chaal {chaalCost.toLocaleString()} ({seen ? '2×' : '1×'})
            </div>
            <div className="grid gap-2 grid-cols-2 sm:[grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
              <Button variant="fold" size="lg" className="w-full" onClick={() => sendAction({ type: 'PACK' })}>
                Pack
              </Button>
              {!seen && (
                <Button variant="outline" size="lg" className="w-full" onClick={() => sendAction({ type: 'SEE_CARDS' })}>
                  See Cards
                </Button>
              )}
              <Button
                variant="call"
                size="lg"
                className="w-full"
                onClick={() => sendAction({ type: 'CHAAL' })}
                disabled={!canChaal}
              >
                Chaal <span className="ml-1 font-mono">{chaalCost.toLocaleString()}</span>
              </Button>
              {canRaise && (
                <Button
                  variant="raise"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setRaiseStake(Math.min(maxStake, 2 * stake));
                    setShowRaiseSlider(true);
                  }}
                >
                  Raise
                </Button>
              )}
              {isSideshowEligible && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => sendAction({ type: 'REQUEST_SIDESHOW' })}
                  disabled={currentPlayer.chips < chaalCost}
                >
                  Sideshow <span className="ml-1 font-mono text-[11px]">{chaalCost.toLocaleString()}</span>
                </Button>
              )}
              {isShowEligible && (
                <Button
                  variant="allin"
                  size="lg"
                  className="w-full"
                  onClick={() => sendAction({ type: 'CALL_SHOW' })}
                  disabled={currentPlayer.chips < showCost}
                >
                  Show <span className="ml-1 font-mono">{showCost.toLocaleString()}</span>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
