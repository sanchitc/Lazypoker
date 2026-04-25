import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { useChipInteraction } from '../hooks/useChipInteraction';
import ChipRail from './ChipRail';
import PendingWager from './PendingWager';
import CommitButton from './CommitButton';
import ActionHelpers from './ActionHelpers';

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

  // Waiting state
  if (!isMyTurn && !isHandComplete && !isShowdown) {
    const activePlayer = gameState.activePlayerIndex >= 0
      ? gameState.players[gameState.activePlayerIndex]
      : null;

    const streetName = gameState.phase === 'FLOP' ? 'flop'
      : gameState.phase === 'TURN' ? 'turn'
      : gameState.phase === 'RIVER' ? 'river' : '';

    return (
      <div className="px-3 py-3">
        <div className="text-center">
          {isBettingPaused ? (
            <div className="text-yellow-300/60 text-xs breathe">
              Waiting for {streetName} to be dealt...
            </div>
          ) : activePlayer ? (
            <div className="text-white/40 text-xs">
              Waiting for <span className="text-white/70 font-medium">{activePlayer.name}</span>
            </div>
          ) : (
            <div className="text-white/30 text-xs breathe">Waiting...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2 space-y-1.5 animate-slide-up">
      {/* Quick action helpers */}
      <ActionHelpers
        gameState={gameState}
        currentPlayer={currentPlayer}
        onSetAmount={chip.setExactAmount}
        disabled={!isMyTurn}
      />

      {/* Chip rail */}
      <ChipRail
        availableDenoms={chip.availableDenoms}
        onAddChip={chip.addChip}
        disabled={!isMyTurn}
      />

      {/* Pending wager display */}
      <PendingWager
        pendingChips={chip.pendingChips}
        pendingTotal={chip.pendingTotal}
        inferredAction={chip.inferredAction}
        onUndo={chip.undoChip}
        onClear={chip.clearChips}
        disabled={!isMyTurn}
      />

      {/* Bottom: Fold + Commit */}
      <div className="flex gap-2">
        <button
          onClick={handleFold}
          disabled={!isMyTurn}
          className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wide transition-all
            ${!isMyTurn
              ? 'bg-white/8 text-white/20 cursor-default'
              : 'bg-red-600/80 hover:bg-red-600 text-white active:scale-95'
            }`}
          aria-label="Fold"
        >
          Fold
        </button>
        <div className="flex-1">
          <CommitButton
            inferredAction={chip.inferredAction}
            canCommit={chip.canCommit}
            onCommit={handleCommit}
            disabled={!isMyTurn}
          />
        </div>
      </div>
    </div>
  );
}
