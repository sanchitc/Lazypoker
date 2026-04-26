import { useMemo, useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import PlayerSeat from '../components/PlayerSeat';
import PotDisplay from '../components/PotDisplay';
import CommunityCards from '../components/CommunityCards';
import ActionBar from '../components/ActionBar';
import AdminPanel from '../components/AdminPanel';
import ChipStack from '../components/ChipStack';
import Card from '../components/Card';
import ChipOnlyActionZone from '../components/ChipOnlyActionZone';
import OpponentBand from '../components/OpponentBand';
import ChipPotDisplay from '../components/ChipPotDisplay';
import AwardPotButton from '../components/AwardPotButton';
import HandRankings from '../components/HandRankings';
import { useSocket } from '../context/SocketContext';
import { CHIP_COLORS } from '@common/constants';

// Calculate seat positions around an oval table
// Current player is always at bottom center
function getSeatPositions(totalSeats: number, currentPlayerSeatIndex: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const cx = 50, cy = 50;
  const rx = 38, ry = 28;

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

  const isChipOnly = gameState.mode === 'chip-only';

  if (isChipOnly) {
    return <ChipOnlyLayout />;
  }

  return <FullModeLayout />;
}

// ============================================================
// CHIP-ONLY MODE LAYOUT — Mobile-first, betting-focused
// ============================================================
function ChipOnlyLayout() {
  const { gameState, playerId, roomCode, currentPlayer, isAdmin, isMyTurn } = useGame();
  const { socket } = useSocket();

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

  const opponents = useMemo(() =>
    seatedPlayers.filter(p => p.id !== playerId),
    [seatedPlayers, playerId]
  );

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

  const isBettingPaused = gameState.activePlayerIndex === -1
    && ['FLOP', 'TURN', 'RIVER'].includes(gameState.phase);

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

  const handleLeaveGame = () => {
    localStorage.removeItem('lazypoker_session');
    socket?.emit('action', { roomCode, playerId, action: { type: 'LEAVE_GAME' } });
  };

  const handleAwardPot = (winnerIds: string[]) => {
    socket?.emit('action', {
      roomCode,
      playerId,
      action: { type: 'DECLARE_WINNER', winnerIds },
    });
  };

  const handleTogglePlayerAward = () => {
    socket?.emit('configure', {
      roomCode,
      playerId,
      config: { allowPlayersAwardPot: !gameState.allowPlayersAwardPot },
    });
  };

  const isHandComplete = gameState.phase === 'HAND_COMPLETE';
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);

  // Can this user award the pot?
  const canAwardPot = isAdmin || gameState.allowPlayersAwardPot;

  // Current player's chip color
  const chipColor = CHIP_COLORS.reduce((best, chip) =>
    currentPlayer.chips >= chip.value ? chip : best
  , CHIP_COLORS[0]);

  // Position badge for current player
  const currentPlayerPosition = (() => {
    if (currentPlayer.isDealer) return 'D';
    const players = gameState.players.filter(p => p.seatIndex >= 0 && !p.isSittingOut);
    const dealerIdx = players.findIndex(p => p.isDealer);
    if (dealerIdx >= 0) {
      const sbIdx = (dealerIdx + 1) % players.length;
      const bbIdx = (dealerIdx + 2) % players.length;
      if (players[sbIdx]?.id === currentPlayer.id) return 'SB';
      if (players[bbIdx]?.id === currentPlayer.id) return 'BB';
    }
    return null;
  })();

  return (
    <div className="h-full flex flex-col bg-felt-dark overflow-hidden">
      {/* ===== COMPACT HEADER ===== */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/5">
        <span className="text-[10px] text-white/40 tabular-nums">
          #{gameState.handNumber} · {gameState.smallBlind}/{gameState.bigBlind}
        </span>
        <div className="flex items-center gap-1.5">
          {turnTimer > 0 && isMyTurn && !isHandComplete && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold tabular-nums
              ${timeLeft <= 5 ? 'bg-red-500/60 text-red-200 animate-pulse' : 'bg-yellow-500/30 text-yellow-300'}`}>
              {timeLeft}s
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-500/20 text-blue-300 uppercase tracking-wider">
            Chip Only
          </span>
        </div>
        <span className="text-[10px] text-white/40">
          {PHASE_LABELS[gameState.phase] || gameState.phase}
        </span>
      </div>

      {/* ===== OPPONENTS ===== */}
      <OpponentBand opponents={opponents} gameState={gameState} currentPlayerId={playerId} />

      {/* ===== CENTER POT ZONE ===== */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative
                      bg-gradient-to-b from-felt-dark via-felt to-felt-dark min-h-0">
        {/* Subtle felt table surface */}
        <div className="absolute inset-x-6 inset-y-3 rounded-3xl bg-felt-light/15 border border-white/5" />

        <div className="relative z-10 flex flex-col items-center gap-2">
          <ChipPotDisplay pots={gameState.pots} gameState={gameState} />

          {/* Advance street button */}
          {isBettingPaused && nextStreetLabels[gameState.phase] && (
            <button
              onClick={handleAdvanceStreet}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white
                         rounded-xl font-bold text-xs shadow-lg uppercase tracking-wide
                         active:scale-95 transition-all animate-pulse"
            >
              {nextStreetLabels[gameState.phase]}
            </button>
          )}
        </div>
      </div>

      {/* ===== MY INFO BAR ===== */}
      <div className="flex items-center justify-between px-3 py-1 bg-black/25 border-t border-white/5">
        {/* Player identity */}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            border shadow-md shadow-black/40
            ${isMyTurn
              ? 'bg-gold text-black border-gold ring-2 ring-gold/50 ring-pulse'
              : 'bg-slate-800 text-white border-white/30'}`}>
            {currentPlayer.name[0].toUpperCase()}
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-white/80">{currentPlayer.name}</span>
              {currentPlayerPosition && (
                <span className="text-[8px] bg-white/20 text-white rounded px-1 py-0.5 font-bold">
                  {currentPlayerPosition}
                </span>
              )}
              {isAdmin && <span className="text-gold text-[10px]">*</span>}
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full border border-white/20"
                style={{ backgroundColor: chipColor.color }}
              />
              <span className="text-xs font-bold tabular-nums text-white/60">
                {currentPlayer.chips.toLocaleString()}
              </span>
              {currentPlayer.currentBet > 0 && (
                <span className="text-[9px] text-gold/70 tabular-nums">
                  (bet: {currentPlayer.currentBet.toLocaleString()})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Award Pot / Leave / Settings */}
        <div className="flex items-center gap-1.5">
          {/* Award pot button - always visible when pot > 0 and user can award */}
          <AwardPotButton
            gameState={gameState}
            canAward={canAwardPot}
            onAward={handleAwardPot}
          />
        </div>
      </div>

      {/* ===== BETTING ACTION ZONE ===== */}
      {isHandComplete ? (
        <HandCompleteZone
          gameState={gameState}
          isAdmin={isAdmin}
          canAwardPot={canAwardPot}
          totalPot={totalPot}
          onNewHand={handleNewHand}
          onAwardPot={handleAwardPot}
          onLeaveGame={handleLeaveGame}
          onTogglePlayerAward={handleTogglePlayerAward}
        />
      ) : (
        <div className="bg-black/20 border-t border-white/5">
          <ChipOnlyActionZone />
        </div>
      )}

      {/* Admin panel */}
      <AdminPanel />

      <HandRankings />
    </div>
  );
}

// ============================================================
// HAND COMPLETE ZONE
// ============================================================
function HandCompleteZone({
  gameState,
  isAdmin,
  canAwardPot,
  totalPot,
  onNewHand,
  onAwardPot,
  onLeaveGame,
  onTogglePlayerAward,
}: {
  gameState: any;
  isAdmin: boolean;
  canAwardPot: boolean;
  totalPot: number;
  onNewHand: () => void;
  onAwardPot: (winnerIds: string[]) => void;
  onLeaveGame: () => void;
  onTogglePlayerAward: () => void;
}) {
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const inHandPlayers = gameState.players.filter((p: any) => !p.isFolded && p.seatIndex >= 0);

  return (
    <div className="px-3 pb-3 pt-2 space-y-2 bg-black/25 border-t border-white/5">
      {/* Last action banner */}
      {gameState.lastAction && (
        <div className="text-gold font-bold text-center text-sm">
          {gameState.lastAction.action}
        </div>
      )}

      {/* Pot still needs awarding */}
      {totalPot > 0 && canAwardPot ? (
        <div className="space-y-2">
          <div className="text-center text-xs text-yellow-300/80 font-medium">
            Select winner(s) — Pot: {totalPot.toLocaleString()}
          </div>
          <div className="space-y-1">
            {inHandPlayers.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelectedWinners(prev =>
                  prev.includes(p.id) ? prev.filter((w: string) => w !== p.id) : [...prev, p.id]
                )}
                className={`w-full py-2 px-3 rounded-xl text-left flex items-center justify-between
                  transition-all active:scale-[0.98]
                  ${selectedWinners.includes(p.id)
                    ? 'bg-gold/20 border-2 border-gold text-white'
                    : 'bg-white/5 border-2 border-transparent text-white/60'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    border shadow-md shadow-black/40
                    ${selectedWinners.includes(p.id)
                      ? 'bg-gold text-black border-gold'
                      : 'bg-slate-800 text-white border-white/30'}`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{p.name}</span>
                </div>
                {selectedWinners.includes(p.id) && (
                  <span className="text-gold font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (selectedWinners.length > 0) {
                onAwardPot(selectedWinners);
                setSelectedWinners([]);
              }
            }}
            disabled={selectedWinners.length === 0}
            className="w-full py-3 bg-gold text-black rounded-xl font-black text-sm uppercase
                       active:scale-[0.97] transition-all disabled:opacity-30"
          >
            Award Pot
          </button>
        </div>
      ) : totalPot > 0 ? (
        <div className="text-white/40 text-xs text-center">
          Waiting for pot to be awarded...
        </div>
      ) : null}

      {/* Deal next hand + leave */}
      <div className="flex gap-2">
        {isAdmin && totalPot === 0 && (
          <button
            onClick={onNewHand}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl
                       font-bold text-sm active:scale-95 transition-all"
          >
            Next Hand
          </button>
        )}
        <button
          onClick={onLeaveGame}
          className="py-2.5 px-4 bg-red-600/25 border border-red-600/40 rounded-xl
                     text-xs text-red-300 active:scale-95 transition-all"
        >
          Leave
        </button>
        {isAdmin && (
          <button
            onClick={onTogglePlayerAward}
            className={`py-2.5 px-3 rounded-xl text-[10px] font-medium transition-all active:scale-95
              ${gameState.allowPlayersAwardPot
                ? 'bg-gold/20 border border-gold/40 text-gold'
                : 'bg-white/5 border border-white/10 text-white/40'}`}
            title={gameState.allowPlayersAwardPot ? 'Players can award pot' : 'Only admin can award pot'}
          >
            {gameState.allowPlayersAwardPot ? 'All Award' : 'Admin Only'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FULL MODE LAYOUT (unchanged from original)
// ============================================================
function FullModeLayout() {
  const { gameState, playerId, roomCode, currentPlayer, isAdmin, isMyTurn } = useGame();
  const { socket } = useSocket();

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

  const [recentActorId, setRecentActorId] = useState<string | null>(null);
  const lastActionKey = gameState?.lastAction
    ? `${gameState.lastAction.playerId}|${gameState.lastAction.action}|${gameState.lastAction.amount ?? ''}`
    : null;
  useEffect(() => {
    if (!gameState?.lastAction) { setRecentActorId(null); return; }
    setRecentActorId(gameState.lastAction.playerId);
    const t = setTimeout(() => setRecentActorId(null), 2500);
    return () => clearTimeout(t);
  }, [lastActionKey]);

  if (!gameState || !playerId || !roomCode || !currentPlayer) return null;

  const showCards = true;
  const isActiveHand = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState.phase);

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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/30 text-purple-300">
              FULL GAME
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
             style={{ top: '10%', bottom: '10%', left: '4%', right: '4%' }} />

        {/* Players */}
        {seatedPlayers.map((player, i) => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={gameState.players[gameState.activePlayerIndex]?.id === player.id}
            isCurrentPlayer={player.id === playerId}
            showCards={showCards}
            position={positions[i] || { x: 50, y: 50 }}
            actionBadge={
              recentActorId === player.id && gameState.lastAction
                ? gameState.lastAction
                : null
            }
          />
        ))}

        {/* Center: Phase label, Pot, Cards */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                        flex flex-col items-center gap-2">
          <PotDisplay pots={gameState.pots} />
          <CommunityCards cards={gameState.communityCards} />
        </div>
      </div>

      {/* Current player's cards (full mode, shown large at bottom) */}
      {currentPlayer.holeCards && !currentPlayer.isFolded && (
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
            {currentPlayer.holeCards && (
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

      <HandRankings />
    </div>
  );
}
