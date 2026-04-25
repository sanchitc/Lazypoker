import { useState, useMemo, useCallback, useEffect } from 'react';
import { GameState, Player } from '@common/types';
import { decomposeChips, chipMapTotal, DENOMINATIONS } from '../utils/chipUtils';

export type InferredAction =
  | { type: 'CHECK' }
  | { type: 'CALL'; amount: number }
  | { type: 'BET'; amount: number }
  | { type: 'RAISE'; amount: number }
  | { type: 'ALL_IN'; amount: number }
  | { type: 'INVALID'; reason: string };

interface ChipInteractionState {
  /** Map of denomination → count selected */
  pendingChips: Map<number, number>;
  /** Ordered history of added denominations (for undo) */
  addHistory: number[];
  /** Total pending amount */
  pendingTotal: number;
  /** Inferred action from the pending amount */
  inferredAction: InferredAction;
  /** Available denominations with remaining counts */
  availableDenoms: { value: number; count: number; maxCount: number }[];
  /** Whether the commit button should be enabled */
  canCommit: boolean;

  // Actions
  addChip: (denomination: number) => void;
  undoChip: () => void;
  clearChips: () => void;
  setExactAmount: (amount: number) => void;
}

export function useChipInteraction(
  gameState: GameState | null,
  currentPlayer: Player | null,
  isMyTurn: boolean,
): ChipInteractionState {
  const [pendingChips, setPendingChips] = useState<Map<number, number>>(new Map());
  const [addHistory, setAddHistory] = useState<number[]>([]);

  // Reset pending when turn changes or game state advances
  const activeIndex = gameState?.activePlayerIndex ?? -1;
  const phase = gameState?.phase ?? 'SETUP';
  useEffect(() => {
    setPendingChips(new Map());
    setAddHistory([]);
  }, [activeIndex, phase]);

  const pendingTotal = useMemo(() => chipMapTotal(pendingChips), [pendingChips]);

  // Compute what's available from the player's stack
  const stackTotal = currentPlayer?.chips ?? 0;

  // Derive a visual denomination breakdown of the player's full stack
  const fullStackBreakdown = useMemo(() => decomposeChips(stackTotal), [stackTotal]);

  const availableDenoms = useMemo(() => {
    return DENOMINATIONS
      .filter(d => stackTotal >= d)
      .map(d => {
        const maxCount = fullStackBreakdown.get(d) ?? 0;
        const used = pendingChips.get(d) ?? 0;
        return { value: d, count: Math.max(0, maxCount - used), maxCount };
      })
      .reverse(); // ascending order for display
  }, [stackTotal, fullStackBreakdown, pendingChips]);

  // Infer action from pending amount + game state
  const inferredAction: InferredAction = useMemo(() => {
    if (!gameState || !currentPlayer) return { type: 'INVALID', reason: 'No game state' };

    const toCall = gameState.currentBet - currentPlayer.currentBet;
    const isFullStack = pendingTotal >= stackTotal;

    if (pendingTotal === 0) {
      if (toCall <= 0) return { type: 'CHECK' };
      return { type: 'INVALID', reason: `Need ${toCall.toLocaleString()} to call` };
    }

    // All-in: selected full stack
    if (isFullStack) {
      return { type: 'ALL_IN', amount: stackTotal };
    }

    // No bet to match — this is a bet
    if (toCall <= 0) {
      const minBet = gameState.minRaise; // min opening bet = big blind
      if (pendingTotal < minBet) {
        return { type: 'INVALID', reason: `Minimum bet is ${minBet.toLocaleString()}` };
      }
      return { type: 'BET', amount: pendingTotal };
    }

    // Facing a bet
    if (pendingTotal < toCall) {
      return { type: 'INVALID', reason: `Need ${toCall.toLocaleString()} to call` };
    }

    if (pendingTotal === toCall) {
      return { type: 'CALL', amount: toCall };
    }

    // More than call — check if valid raise
    const minRaiseTotal = gameState.currentBet + gameState.minRaise;
    const raiseTotal = currentPlayer.currentBet + pendingTotal;

    if (raiseTotal < minRaiseTotal) {
      return { type: 'INVALID', reason: `Minimum raise is ${minRaiseTotal.toLocaleString()}` };
    }

    return { type: 'RAISE', amount: raiseTotal };
  }, [gameState, currentPlayer, pendingTotal, stackTotal]);

  const canCommit = inferredAction.type !== 'INVALID';

  const addChip = useCallback((denomination: number) => {
    if (!isMyTurn) return;
    // Check if adding this chip would exceed stack
    const currentPending = chipMapTotal(pendingChips);
    if (currentPending + denomination > stackTotal) return;
    // Check denomination availability
    const maxCount = fullStackBreakdown.get(denomination) ?? 0;
    const used = pendingChips.get(denomination) ?? 0;
    if (used >= maxCount) return;

    setPendingChips(prev => {
      const next = new Map(prev);
      next.set(denomination, (next.get(denomination) ?? 0) + 1);
      return next;
    });
    setAddHistory(prev => [...prev, denomination]);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);
  }, [isMyTurn, pendingChips, stackTotal, fullStackBreakdown]);

  const undoChip = useCallback(() => {
    if (addHistory.length === 0) return;
    const lastDenom = addHistory[addHistory.length - 1];
    setPendingChips(prev => {
      const next = new Map(prev);
      const count = next.get(lastDenom) ?? 0;
      if (count <= 1) {
        next.delete(lastDenom);
      } else {
        next.set(lastDenom, count - 1);
      }
      return next;
    });
    setAddHistory(prev => prev.slice(0, -1));
    if (navigator.vibrate) navigator.vibrate(5);
  }, [addHistory]);

  const clearChips = useCallback(() => {
    setPendingChips(new Map());
    setAddHistory([]);
    if (navigator.vibrate) navigator.vibrate(5);
  }, []);

  const setExactAmount = useCallback((amount: number) => {
    const clamped = Math.min(amount, stackTotal);
    const breakdown = decomposeChips(clamped);
    setPendingChips(breakdown);
    // Build a synthetic history from the breakdown
    const history: number[] = [];
    for (const [denom, count] of breakdown) {
      for (let i = 0; i < count; i++) history.push(denom);
    }
    setAddHistory(history);
    if (navigator.vibrate) navigator.vibrate(10);
  }, [stackTotal]);

  return {
    pendingChips,
    addHistory,
    pendingTotal,
    inferredAction,
    availableDenoms,
    canCommit,
    addChip,
    undoChip,
    clearChips,
    setExactAmount,
  };
}
