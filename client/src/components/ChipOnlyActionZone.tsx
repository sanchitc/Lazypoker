import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { useChipInteraction } from '../hooks/useChipInteraction';
import ChipRail from './ChipRail';
import PendingWager from './PendingWager';
import CommitButton from './CommitButton';
import ActionHelpers from './ActionHelpers';
import { Button } from '@/components/ui/button';

export default function ChipOnlyActionZone() {
  const { gameState, playerId, roomCode, isMyTurn, currentPlayer } = useGame();
  const { socket } = useSocket();
  const chip = useChipInteraction(gameState, currentPlayer, isMyTurn);

  if (!gameState || !playerId || !roomCode || !currentPlayer) return null;

  const sendAction = (type: string, amount?: number) => {
    socket?.emit('action', {
      roomCode,
      playerId,
      action: amount !== undefined ? { type, amount } as any : { type } as any,
    });
  };

  const handleCommit = () => {
    const action = chip.inferredAction;
    switch (action.type) {
      case 'CHECK': sendAction('CHECK'); break;
      case 'CALL': sendAction('CALL'); break;
      case 'BET':
      case 'RAISE': sendAction('RAISE', action.amount); break;
      case 'ALL_IN': sendAction('ALL_IN'); break;
    }
  };

  const handleFold = () => sendAction('FOLD');

  const isBettingPaused = gameState.activePlayerIndex === -1
    && ['FLOP', 'TURN', 'RIVER'].includes(gameState.phase);
  const isHandComplete = gameState.phase === 'HAND_COMPLETE';
  const isShowdown = gameState.phase === 'SHOWDOWN';

  if (!isMyTurn && !isHandComplete && !isShowdown) {
    const activePlayer = gameState.activePlayerIndex >= 0
      ? gameState.players[gameState.activePlayerIndex]
      : null;
    const streetName = gameState.phase === 'FLOP' ? 'flop'
      : gameState.phase === 'TURN' ? 'turn'
      : gameState.phase === 'RIVER' ? 'river' : '';

    return (
      <div className="control-rail px-3 py-3">
        <div className="surface-pill text-center rounded-[22px] px-4 py-3">
          {isBettingPaused ? (
            <div className="text-brass/75 text-xs font-display italic uppercase tracking-[0.18em] breathe">
              Waiting for {streetName} to be dealt…
            </div>
          ) : activePlayer ? (
            <div className="text-bone-dim text-xs uppercase tracking-[0.18em]">
              Waiting for <span className="text-bone font-medium normal-case">{activePlayer.name}</span>
            </div>
          ) : (
            <div className="text-bone-dim/60 text-xs uppercase tracking-[0.18em] breathe">Waiting…</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="control-rail px-3 pb-3 pt-2 animate-slide-up">
      <div className="space-y-2 rounded-[26px] surface-panel p-3">
        <ActionHelpers
          gameState={gameState}
          currentPlayer={currentPlayer}
          onSetAmount={chip.setExactAmount}
          disabled={!isMyTurn}
        />

        <ChipRail
          availableDenoms={chip.availableDenoms}
          onAddChip={chip.addChip}
          disabled={!isMyTurn}
        />

        <PendingWager
          pendingChips={chip.pendingChips}
          pendingTotal={chip.pendingTotal}
          inferredAction={chip.inferredAction}
          onUndo={chip.undoChip}
          onClear={chip.clearChips}
          disabled={!isMyTurn}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="fold" size="lg" className="w-full" onClick={handleFold} disabled={!isMyTurn}>
            Fold
          </Button>
          <div className="w-full">
            <CommitButton
              inferredAction={chip.inferredAction}
              canCommit={chip.canCommit}
              onCommit={handleCommit}
              disabled={!isMyTurn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
