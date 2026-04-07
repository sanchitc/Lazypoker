import { useMemo, useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import PlayerSeat from '../components/PlayerSeat';
import PotDisplay from '../components/PotDisplay';
import CommunityCards from '../components/CommunityCards';
import ActionBar from '../components/ActionBar';
import AdminPanel from '../components/AdminPanel';
import ChipStack from '../components/ChipStack';
import Card from '../components/Card';
import { useSocket } from '../context/SocketContext';

// Calculate seat positions around an oval table
// Current player is always at bottom center
function getSeatPositions(totalSeats: number, currentPlayerSeatIndex: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const cx = 50, cy = 42;
  const rx = 42, ry = 34;

  for (let i = 0; i < totalSeats; i++) {
    const offset = currentPlayerSeatIndex >= 0 ? currentPlayerSeatIndex : 0;
    const angle = (2 * Math.PI * (i - offset) / totalSeats) - Math.PI / 2 + Math.PI;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    positions.push({ x, y });
  }
  return positions;
}

const PHASE_LABELS: Record<string, string> = {
  'PRE_FLOP': 'Pre-Flop',
  'FLOP': 'Flop',
  'TURN': 'Turn',
  'RIVER': 'River',
  'SHOWDOWN': 'Showdown',
  'HAND_COMPLETE': 'Hand Complete',
};

export default function GameScreen() {
  const { gameState, playerId, roomCode, currentPlayer, isAdmin, isMyTurn } = useGame();
  const { socket } = useSocket();

  // Per-turn timer — all hooks must come before early returns
  const turnTimer = gameState?.turnTimer ?? 0;
  const [timeLeft, setTimeLeft] = useState<number>(turnTimer);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePlayerIdRef = useRef<string | null>(null);

  const seatedPlayers = useMemo(() =>
    (gameState?.players ?? [])
      .filter(p => p.seatIndex >= 0)
      .sort((a, b) => a.seatIndex - b.seatIndex),
    [gameState?.players]
  );

  const positions = useMemo(() => {
    return getSeatPositions(
      seatedPlayers.length,
      seatedPlayers.findIndex(p => p.id === playerId)
    );
  }, [seatedPlayers.length, playerId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!turnTimer || !isMyTurn || !gameState || gameState.phase === 'HAND_COMPLETE') {
      setTimeLeft(turnTimer);
      return;
    }

    const activeId = gameState.players[gameState.activePlayerIndex]?.id ?? null;
    if (activeId !== activePlayerIdRef.current) {
      activePlayerIdRef.current = activeId;
      setTimeLeft(turnTimer);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-act: check if no bet to call, otherwise fold
          const canCheck = (currentPlayer?.currentBet ?? 0) >= (gameState?.currentBet ?? 0);
          socket?.emit('action', {
            roomCode: roomCode!,
            playerId: playerId!,
            action: { type: canCheck ? 'CHECK' : 'FOLD' },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isMyTurn, gameState?.activePlayerIndex, turnTimer, gameState?.phase]);

  if (!gameState || !playerId || !roomCode || !currentPlayer) return null;

  const showCards = gameState.mode === 'full';
  const isChipOnly = gameState.mode === 'chip-only';
  const isBettingPaused = isChipOnly && gameState.activePlayerIndex === -1
    && ['FLOP', 'TURN', 'RIVER'].includes(gameState.phase);
  const isActiveHand = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState.phase);

  const nextStreetLabels: Record<string, string> = {
    'FLOP': 'Deal Flop',
    'TURN': 'Deal Turn',
    'RIVER': 'Deal River',
  };

  const handleAdvanceStreet = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'NEXT_ROUND' } });
  };

  const handleNewHand = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'START_HAND' } });
  };

  const handleShowCards = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'SHOW_CARDS' } });
  };

  const handleLeaveGame = () => {
    localStorage.removeItem('lazypoker_session');
    socket?.emit('action', { roomCode, playerId, action: { type: 'LEAVE_GAME' } });
  };

  return (
    <div className="h-full flex flex-col bg-felt-dark">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/20">
        <div className="text-xs text-white/50">
          Hand #{gameState.handNumber} · {gameState.smallBlind}/{gameState.bigBlind}
        </div>
        <div className="text-xs">
          {turnTimer > 0 && isMyTurn && gameState.phase !== 'HAND_COMPLETE' ? (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
              ${timeLeft <= 5 ? 'bg-red-500/60 text-red-200 animate-pulse' : 'bg-yellow-500/30 text-yellow-300'}`}>
              {timeLeft}s
            </span>
          ) : (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
              ${gameState.mode === 'chip-only' ? 'bg-blue-500/30 text-blue-300' : 'bg-purple-500/30 text-purple-300'}`}>
              {gameState.mode === 'chip-only' ? 'CHIP ONLY' : 'FULL GAME'}
            </span>
          )}
        </div>
        <div className="text-xs text-white/50">
          {PHASE_LABELS[gameState.phase] || gameState.phase}
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 relative">
        {/* Green felt table */}
        <div className="absolute inset-4 rounded-[50%] bg-gradient-to-b from-felt-light to-felt
                        border-4 border-amber-900/60 shadow-inner"
             style={{ top: '5%', bottom: '15%', left: '5%', right: '5%' }} />

        {/* Players */}
        {seatedPlayers.map((player, i) => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={gameState.players[gameState.activePlayerIndex]?.id === player.id}
            isCurrentPlayer={player.id === playerId}
            showCards={showCards}
            position={positions[i] || { x: 50, y: 50 }}
          />
        ))}

        {/* Center: Phase label, Pot, Cards / Advance button */}
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2
                        flex flex-col items-center gap-2">
          {/* Chip-only: prominent current street label */}
          {isChipOnly && isActiveHand && (
            <div className="text-white/90 text-xl font-bold tracking-wide uppercase">
              {PHASE_LABELS[gameState.phase] || gameState.phase}
            </div>
          )}

          <PotDisplay pots={gameState.pots} />
          {showCards && <CommunityCards cards={gameState.communityCards} />}

          {/* Chip-only: advance street button (anyone can tap) */}
          {isBettingPaused && nextStreetLabels[gameState.phase] && (
            <button
              onClick={handleAdvanceStreet}
              className="mt-1 px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-white
                         rounded-xl font-bold text-sm shadow-lg
                         active:scale-95 transition-all animate-pulse"
            >
              {nextStreetLabels[gameState.phase]}
            </button>
          )}
        </div>

        {/* Last action banner */}
        {gameState.lastAction && (
          <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2
                          bg-black/50 px-3 py-1 rounded-full text-xs text-white/70 animate-fade-in">
            {gameState.players.find(p => p.id === gameState.lastAction!.playerId)?.name}:{' '}
            {gameState.lastAction.action}
            {gameState.lastAction.amount !== undefined && ` ${gameState.lastAction.amount.toLocaleString()}`}
          </div>
        )}
      </div>

      {/* Current player's cards (full mode, shown large at bottom) */}
      {showCards && currentPlayer.holeCards && !currentPlayer.isFolded && (
        <div className="flex justify-center gap-2 pb-1">
          <Card card={currentPlayer.holeCards[0]} size="lg" />
          <Card card={currentPlayer.holeCards[1]} size="lg" />
        </div>
      )}

      {/* My chip stack display */}
      <div className="flex items-center justify-center py-1 bg-black/20">
        <ChipStack amount={currentPlayer.chips} size="md" />
      </div>

      {/* Action bar / Hand complete controls */}
      {gameState.phase === 'HAND_COMPLETE' ? (
        <div className="p-3 text-center space-y-2">
          {gameState.lastAction && (
            <div className="text-gold font-bold text-lg">
              {gameState.lastAction.action}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={handleNewHand}
              className="w-full py-3 bg-gold text-black rounded-xl font-bold
                         active:scale-95 transition-all"
            >
              Deal Next Hand
            </button>
          )}
          {!isAdmin && (
            <div className="text-white/50 text-sm">Waiting for next hand...</div>
          )}
          <div className="flex gap-2">
            {showCards && currentPlayer.holeCards && (
              <button
                onClick={handleShowCards}
                className={`flex-1 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all
                  ${currentPlayer.wantsToShowCards
                    ? 'bg-blue-500/40 border border-blue-400 text-blue-200'
                    : 'bg-white/10 border border-white/20'}`}
              >
                {currentPlayer.wantsToShowCards ? 'Hide Cards' : 'Show Cards'}
              </button>
            )}
            <button
              onClick={handleLeaveGame}
              className="flex-1 py-2 bg-red-600/30 border border-red-600/50 rounded-xl
                         text-sm text-red-300 active:scale-95 transition-all"
            >
              Leave Game
            </button>
          </div>
        </div>
      ) : (
        <ActionBar />
      )}

      {/* Admin panel */}
      <AdminPanel />
    </div>
  );
}
