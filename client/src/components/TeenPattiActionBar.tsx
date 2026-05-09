import { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface TeenPattiActionBarProps {
  layout?: 'horizontal' | 'vertical';
}

export default function TeenPattiActionBar({ layout = 'horizontal' }: TeenPattiActionBarProps) {
  const { gameState, playerId, roomCode, isMyTurn, currentPlayer } = useGame();
  const { socket } = useSocket();
  const [showRaiseSheet, setShowRaiseSheet] = useState(false);
  const [raiseStake, setRaiseStake] = useState(0);

  const tp = gameState?.teenPatti;
  const stake = gameState?.currentBet ?? 0;
  const seen = !!currentPlayer?.hasSeenCards;

  const { isSideshowEligible, isShowEligible, showCost } = useMemo(() => {
    if (!gameState || !currentPlayer) {
      return { isSideshowEligible: false, isShowEligible: false, showCost: 0 };
    }
    const active = gameState.players
      .filter(p => p.seatIndex >= 0 && !p.isFolded && !p.isSittingOut)
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const activeCount = active.length;

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
    return { isSideshowEligible, isShowEligible, showCost };
  }, [gameState, currentPlayer, seen, stake]);

  if (!gameState || !playerId || !roomCode || !currentPlayer || !tp) return null;

  const sendAction = (action: any) => {
    socket?.emit('action', { roomCode, playerId, action });
    setShowRaiseSheet(false);
  };

  const isVertical = layout === 'vertical';
  // Vertical (landscape) lives inside the right column flex container; horizontal (portrait)
  // is the bottom-anchored control rail. The dock chrome differs slightly to fit each.
  const dockClass = isVertical
    ? 'flex h-full flex-col gap-2 px-2 py-2'
    : 'control-rail px-3 pb-3 pt-2 animate-slide-up';
  const innerClass = isVertical
    ? 'flex flex-col gap-2'
    : 'mx-auto max-w-2xl rounded-[26px] surface-panel p-3 sm:p-4';

  // Sideshow target overlay — full width.
  const pending = gameState.pendingSideshow;
  if (gameState.phase === 'SIDESHOW_PENDING' && pending && pending.targetId === playerId) {
    const requester = gameState.players.find(p => p.id === pending.requesterId);
    return (
      <div className={dockClass}>
        <div className={innerClass}>
          <div className={`text-center text-[12.5px] uppercase tracking-[0.18em] text-brass mb-2 ${isVertical ? 'leading-tight' : ''}`}>
            Sideshow from <span className="text-bone normal-case">{requester?.name ?? 'opponent'}</span>
          </div>
          <div className={isVertical ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-2'}>
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

  if (gameState.phase === 'SIDESHOW_PENDING' && pending && pending.requesterId === playerId) {
    const target = gameState.players.find(p => p.id === pending.targetId);
    return (
      <div className={isVertical ? 'flex h-full items-center px-2' : 'control-rail px-3 py-3 text-center'}>
        <div className={isVertical
          ? 'surface-pill w-full rounded-2xl px-3 py-3 text-center'
          : 'surface-pill mx-auto max-w-2xl rounded-[22px] px-4 py-3'}>
          <div className="text-[12.5px] uppercase tracking-[0.2em] text-bone-dim leading-tight">
            Waiting for <span className="text-bone font-medium normal-case">{target?.name ?? 'opponent'}</span>…
          </div>
        </div>
      </div>
    );
  }

  if (!isMyTurn) {
    const activePlayer = gameState.activePlayerIndex >= 0 ? gameState.players[gameState.activePlayerIndex] : null;
    return (
      <div className={isVertical ? 'flex h-full items-center px-2' : 'control-rail px-3 py-3 text-center'}>
        <div className={isVertical
          ? 'surface-pill w-full rounded-2xl px-3 py-3 text-center'
          : 'surface-pill mx-auto max-w-2xl rounded-[22px] px-4 py-3'}>
          {activePlayer ? (
            <div className="text-[12.5px] uppercase tracking-[0.2em] text-bone-dim leading-tight">
              Waiting for <span className="text-bone font-medium normal-case">{activePlayer.name}</span>
            </div>
          ) : (
            <div className="text-[12.5px] uppercase tracking-[0.2em] text-bone-dim">Waiting…</div>
          )}
        </div>
      </div>
    );
  }

  const chaalCost = (seen ? 2 : 1) * stake;
  const canChaal = currentPlayer.chips >= chaalCost;

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

  const openRaise = () => {
    setRaiseStake(Math.min(maxStake, 2 * stake));
    setShowRaiseSheet(true);
  };

  // ----- PRIMARY actions (always visible) -----
  const primaryButtons = (
    <>
      <Button variant="fold" size="lg" className="w-full" onClick={() => sendAction({ type: 'PACK' })}>
        Pack
      </Button>
      <Button
        variant="call"
        size="lg"
        className="w-full"
        onClick={() => sendAction({ type: 'CHAAL' })}
        disabled={!canChaal}
      >
        {seen ? 'Chaal' : 'Blind'} <span className="ml-1 font-mono">{chaalCost.toLocaleString()}</span>
      </Button>
      {canRaise ? (
        <Button variant="raise" size="lg" className="w-full" onClick={openRaise}>
          Raise
        </Button>
      ) : (
        <Button variant="raise" size="lg" className="w-full" disabled>
          Raise
        </Button>
      )}
    </>
  );

  // ----- CONTEXT actions (only what's available) -----
  const contextButtons: React.ReactNode[] = [];
  if (!seen) {
    contextButtons.push(
      <Button
        key="see"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => sendAction({ type: 'SEE_CARDS' })}
      >
        See cards
      </Button>
    );
  }
  if (isSideshowEligible) {
    contextButtons.push(
      <Button
        key="sideshow"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => sendAction({ type: 'REQUEST_SIDESHOW' })}
        disabled={currentPlayer.chips < chaalCost}
      >
        Sideshow <span className="ml-1 font-mono text-[11px]">{chaalCost.toLocaleString()}</span>
      </Button>
    );
  }
  if (isShowEligible) {
    contextButtons.push(
      <Button
        key="show"
        variant="allin"
        size="lg"
        className="w-full"
        onClick={() => sendAction({ type: 'CALL_SHOW' })}
        disabled={currentPlayer.chips < showCost}
      >
        Show <span className="ml-1 font-mono">{showCost.toLocaleString()}</span>
      </Button>
    );
  }

  // ----- LAYOUT -----
  return (
    <>
      <div className={dockClass}>
        <div className={innerClass}>
          {!isVertical && (
            <div className="text-center text-[11.5px] uppercase tracking-[0.22em] text-brass/80 pb-2">
              Your turn — {seen ? 'Chaal' : 'Blind'} {chaalCost.toLocaleString()}
            </div>
          )}
          {isVertical ? (
            <div className="flex flex-col gap-2">{primaryButtons}</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">{primaryButtons}</div>
          )}
          {contextButtons.length > 0 && (
            <div className={isVertical ? 'flex flex-col gap-2 pt-1' : 'grid grid-cols-3 gap-2 pt-2'}>
              {contextButtons}
              {/* Pad context row to keep buttons full-width in horizontal layout */}
              {!isVertical && contextButtons.length < 3 &&
                Array.from({ length: 3 - contextButtons.length }).map((_, i) => (
                  <div key={`pad-${i}`} aria-hidden />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Raise bottom sheet */}
      <Sheet open={showRaiseSheet} onOpenChange={setShowRaiseSheet}>
        <SheetContent side="bottom" className="rounded-t-[28px] pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Raise</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-bone-dim">New stake</div>
                <div className="mt-1 text-[11px] font-mono tabular-nums text-bone-dim/70">
                  Pay {(costMul * raiseStake).toLocaleString()} ({seen ? '2×' : '1×'} stake)
                </div>
              </div>
              <span className="font-display tabular-display text-[44px] leading-none text-brass">
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

            <div className="grid gap-2 grid-cols-2">
              <Button variant="outline" className="w-full" onClick={() => setShowRaiseSheet(false)}>
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
        </SheetContent>
      </Sheet>

    </>
  );
}
