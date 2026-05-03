import { useMemo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useGame } from '../context/GameContext';
import PlayerSeat from '../components/PlayerSeat';
import PotDisplay from '../components/PotDisplay';
import CommunityCards from '../components/CommunityCards';
import ActionBar from '../components/ActionBar';
import TeenPattiActionBar from '../components/TeenPattiActionBar';
import AdminPanel from '../components/AdminPanel';
import ChipStack from '../components/ChipStack';
import Card from '../components/Card';
import ChipOnlyActionZone from '../components/ChipOnlyActionZone';
import OpponentBand from '../components/OpponentBand';
import ChipPotDisplay from '../components/ChipPotDisplay';
import AwardPotButton from '../components/AwardPotButton';
import HandRankings from '../components/HandRankings';
import WinnerBanner from '../components/WinnerBanner';
import ChatPanel from '../components/ChatPanel';
import { useSocket } from '../context/SocketContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { CHIP_COLORS } from '@common/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameState, Player } from '@common/types';

function getSeatPositions(totalSeats: number, currentPlayerSeatIndex: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const cx = 50, cy = 50;
  // Tightened ellipse radii so seats stay clear of the felt rim on narrow viewports.
  const rx = 36, ry = 30;

  for (let i = 0; i < totalSeats; i++) {
    const offset = currentPlayerSeatIndex >= 0 ? currentPlayerSeatIndex : 0;
    const angle = (2 * Math.PI * (i - offset) / totalSeats) - Math.PI / 2 + Math.PI;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    positions.push({ x, y });
  }
  return positions;
}

const PHASES = [
  { key: 'PRE_FLOP', label: 'Pre-Flop' },
  { key: 'FLOP',     label: 'Flop' },
  { key: 'TURN',     label: 'Turn' },
  { key: 'RIVER',    label: 'River' },
  { key: 'SHOWDOWN', label: 'Showdown' },
];

function PhaseStepper({ phase }: { phase: string }) {
  const currentIndex = PHASES.findIndex(p => p.key === phase);
  return (
    <div className="flex items-center gap-1.5">
      {PHASES.map((p, i) => {
        const isActive = i === currentIndex;
        const isPast = currentIndex >= 0 && i < currentIndex;
        if (isActive) {
          return (
            <span
              key={p.key}
              className="surface-pill rounded-full px-2 py-0.5 text-[9px] sm:px-2.5 sm:py-1 sm:text-[10px] uppercase tracking-[0.18em] text-brass font-display"
            >
              {p.label}
            </span>
          );
        }
        return (
          <span
            key={p.key}
            className={`w-1.5 h-1.5 rounded-full transition-colors
              ${isPast ? 'bg-brass/55' : 'bg-bone/12'}`}
          />
        );
      })}
    </div>
  );
}

function getPositionLabel(player: Player, gameState: GameState): string | null {
  if (player.isDealer) return 'D';
  const seated = gameState.players.filter(p => p.seatIndex >= 0 && !p.isSittingOut);
  const dealerIdx = seated.findIndex(p => p.isDealer);
  if (dealerIdx >= 0) {
    const sbIdx = (dealerIdx + 1) % seated.length;
    const bbIdx = (dealerIdx + 2) % seated.length;
    if (seated[sbIdx]?.id === player.id) return 'SB';
    if (seated[bbIdx]?.id === player.id) return 'BB';
  }
  return null;
}

export default function GameScreen() {
  const { gameState, playerId, roomCode, currentPlayer } = useGame();

  if (!gameState || !playerId || !roomCode || !currentPlayer) return null;

  if (gameState.variant === 'teen-patti') return <TeenPattiLayout />;
  return gameState.mode === 'chip-only' ? <ChipOnlyLayout /> : <FullModeLayout />;
}

// ============================================================
// CHIP-ONLY MODE LAYOUT
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
  const canAwardPot = isAdmin || gameState.allowPlayersAwardPot;

  const chipColor = CHIP_COLORS.reduce((best, chip) =>
    currentPlayer.chips >= chip.value ? chip : best
  , CHIP_COLORS[0]);

  const currentPlayerPosition = getPositionLabel(currentPlayer, gameState);

  return (
    <div className="game-shell h-full flex flex-col overflow-hidden felt-noise vignette mx-auto w-full max-w-3xl">
      {/* HEADER with phase stepper */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-ink/28 backdrop-blur-sm brass-hairline-b">
        <span className="text-[10px] text-bone-dim font-mono tabular-nums whitespace-nowrap">
          #{gameState.handNumber} · {gameState.smallBlind}/{gameState.bigBlind}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {turnTimer > 0 && isMyTurn && !isHandComplete && (
            <Badge variant={timeLeft <= 5 ? 'ember' : 'brass'} className={timeLeft <= 5 ? 'animate-pulse' : ''}>
              {timeLeft}s
            </Badge>
          )}
          <Badge variant="muted">Chip Only</Badge>
        </div>
        <PhaseStepper phase={gameState.phase} />
      </div>

      {/* OPPONENTS */}
      <OpponentBand opponents={opponents} gameState={gameState} currentPlayerId={playerId} />

      {/* CENTER POT ZONE — felt surface elevated on near-black page bg */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-2">
        <div className="absolute inset-x-3 inset-y-3 rounded-[32px] surface-panel-soft" />
        <div className="absolute inset-x-5 inset-y-5 rounded-[28px]
                        bg-[radial-gradient(circle_at_50%_40%,hsl(151_56%_25%)_0%,hsl(var(--felt))_42%,hsl(var(--felt-rim))_84%,hsl(154_43%_13%)_100%)]
                        border border-bone/6
                        shadow-[inset_0_0_48px_rgba(0,0,0,0.35)]" />

        <div className="relative z-10 flex flex-col items-center gap-3">
          <ChipPotDisplay pots={gameState.pots} gameState={gameState} />

          {isBettingPaused && nextStreetLabels[gameState.phase] && (
            <Button
              variant="raise"
              size="lg"
              className="animate-pulse"
              onClick={handleAdvanceStreet}
            >
              {nextStreetLabels[gameState.phase]}
            </Button>
          )}
        </div>
      </div>

      {/* MY INFO BAR */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-ink/24 backdrop-blur-sm brass-hairline-t">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold
            shadow-md shadow-ink/40
            ${isMyTurn
              ? 'border-brass/42 bg-gradient-to-b from-felt-rim to-panel-strong text-bone ring-2 ring-brass/22 ring-pulse'
              : 'border-bone/10 bg-gradient-to-b from-panel-soft to-panel-strong text-bone'}`}>
            {currentPlayer.name[0].toUpperCase()}
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-bone truncate max-w-[100px] sm:max-w-none">{currentPlayer.name}</span>
              {currentPlayerPosition && (
                <Badge variant="brass" className="px-1 py-0 text-[8px] h-3.5 tracking-tight">
                  {currentPlayerPosition}
                </Badge>
              )}
              {isAdmin && <span className="text-brass text-[10px]">★</span>}
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full border border-bone/20 shrink-0"
                style={{ backgroundColor: chipColor.color }}
              />
              <span className="text-xs font-mono font-semibold tabular-nums text-bone-dim">
                {currentPlayer.chips.toLocaleString()}
              </span>
              {currentPlayer.currentBet > 0 && (
                <span className="text-[9px] text-brass/70 font-mono tabular-nums">
                  (bet: {currentPlayer.currentBet.toLocaleString()})
                </span>
              )}
            </div>
          </div>
        </div>

        <AwardPotButton
          gameState={gameState}
          canAward={canAwardPot}
          onAward={handleAwardPot}
        />
      </div>

      {/* BETTING ACTION ZONE */}
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
        <ChipOnlyActionZone />
      )}

      <AdminPanel />
      <HandRankings />
      <ChatPanel />
      <WinnerBanner gameState={gameState} />
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
    <div className="control-rail px-3 pb-3 pt-2">
      <div className="space-y-2 rounded-[26px] surface-panel p-3 mx-auto max-w-2xl">
      {gameState.lastAction && (
        <div className="font-display brass-shimmer-text text-center text-base">
          {gameState.lastAction.action}
        </div>
      )}

      {totalPot > 0 && canAwardPot ? (
        <div className="space-y-2">
          <div className="text-center text-[11px] text-brass/80 font-display italic uppercase tracking-[0.18em]">
            Select winner(s) — Pot: {totalPot.toLocaleString()}
          </div>
          <div className="space-y-1">
            {inHandPlayers.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelectedWinners(prev =>
                  prev.includes(p.id) ? prev.filter((w: string) => w !== p.id) : [...prev, p.id]
                )}
                className={`w-full rounded-xl py-2 px-3 text-left flex items-center justify-between
                  transition-all active:scale-[0.98]
                  ${selectedWinners.includes(p.id)
                    ? 'border border-brass/28 bg-brass/12 text-bone'
                    : 'border border-bone/8 bg-panel-soft/65 text-bone-dim hover:text-bone'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold shadow-md
                    ${selectedWinners.includes(p.id)
                      ? 'border-brass/38 bg-gradient-to-b from-[#f1dca8] to-brass text-obsidian'
                      : 'border-bone/10 bg-gradient-to-b from-panel-soft to-panel-strong text-bone'}`}>
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{p.name}</span>
                </div>
                {selectedWinners.includes(p.id) && (
                  <span className="text-brass font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
          <Button
            variant="raise"
            size="lg"
            className="w-full"
            onClick={() => {
              if (selectedWinners.length > 0) {
                onAwardPot(selectedWinners);
                setSelectedWinners([]);
              }
            }}
            disabled={selectedWinners.length === 0}
          >
            Award Pot
          </Button>
        </div>
      ) : totalPot > 0 ? (
        <div className="text-bone-dim/70 text-xs text-center italic font-display">
          Waiting for pot to be awarded…
        </div>
      ) : null}

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
        {isAdmin && totalPot === 0 && (
          <Button variant="check" className="w-full" onClick={onNewHand}>
            Next Hand
          </Button>
        )}
        <Button variant="fold" size="md" className="w-full" onClick={onLeaveGame}>
          Leave
        </Button>
        {isAdmin && (
          <Button
            variant={gameState.allowPlayersAwardPot ? 'host' : 'outline'}
            size="md"
            className="w-full text-[10px]"
            onClick={onTogglePlayerAward}
            title={gameState.allowPlayersAwardPot ? 'Players can award pot' : 'Only admin can award pot'}
          >
            {gameState.allowPlayersAwardPot ? 'All Award' : 'Admin Only'}
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}

// ============================================================
// FULL MODE LAYOUT
// ============================================================
function FullModeLayout() {
  const { gameState, playerId, roomCode, currentPlayer, isAdmin, isMyTurn } = useGame();
  const { socket } = useSocket();
  const isWide = useMediaQuery('(min-width: 768px)');

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

  const isHandComplete = gameState.phase === 'HAND_COMPLETE';
  const currentPlayerPosition = getPositionLabel(currentPlayer, gameState);

  const chipColor = CHIP_COLORS.reduce((best, chip) =>
    currentPlayer.chips >= chip.value ? chip : best
  , CHIP_COLORS[0]);

  return (
    <div className="game-shell h-full flex flex-col felt-noise vignette mx-auto w-full max-w-6xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-ink/28 backdrop-blur-sm brass-hairline-b">
        <div className="text-[10px] sm:text-xs text-bone-dim font-mono tabular-nums whitespace-nowrap">
          #{gameState.handNumber} · {gameState.smallBlind}/{gameState.bigBlind}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {turnTimer > 0 && isMyTurn && !isHandComplete && (
            <Badge variant={timeLeft <= 5 ? 'ember' : 'brass'} className={timeLeft <= 5 ? 'animate-pulse' : ''}>
              {timeLeft}s
            </Badge>
          )}
          <Badge variant="outline">Full Game</Badge>
        </div>
        <PhaseStepper phase={gameState.phase} />
      </div>

      {isWide ? (
        // ====== TABLET / DESKTOP: Elliptical poker table ======
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,hsl(var(--felt-rim)/0.12),transparent_40%)]" />
          <div className="absolute left-[4%] right-[4%] top-[6%] bottom-[7%] rounded-[50%] table-shell" />
          <div className="absolute left-[5%] right-[5%] top-[7.5%] bottom-[8.5%] rounded-[50%] table-felt" />
          <div className="absolute left-[12%] right-[12%] top-[18%] bottom-[18%] rounded-[50%] table-spotlight opacity-80" />

          {seatedPlayers.map((player, i) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isActive={gameState.players[gameState.activePlayerIndex]?.id === player.id}
              isCurrentPlayer={player.id === playerId}
              showCards={true}
              position={positions[i] || { x: 50, y: 50 }}
              actionBadge={
                recentActorId === player.id && gameState.lastAction
                  ? gameState.lastAction
                  : null
              }
            />
          ))}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                          flex flex-col items-center gap-3">
            <PotDisplay pots={gameState.pots} />
            <CommunityCards cards={gameState.communityCards} />
          </div>
        </div>
      ) : null}

      {isWide && !isHandComplete && (
        <div className="px-3 pb-2">
          <div className="surface-pill mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-[28px] px-4 py-3">
            {currentPlayer.holeCards && !currentPlayer.isFolded && (
              <div className="flex justify-center gap-2">
                <Card card={currentPlayer.holeCards[0]} size="lg" />
                <Card card={currentPlayer.holeCards[1]} size="lg" />
              </div>
            )}
            <div className="rounded-full border border-bone/10 bg-panel-strong/55 px-3 py-2">
              <ChipStack amount={currentPlayer.chips} size="md" />
            </div>
          </div>
        </div>
      )}

      {!isWide && (
        // ====== MOBILE: Stacked layout (band + felt center + self bar) ======
        <>
          <OpponentBand opponents={opponents} gameState={gameState} currentPlayerId={playerId} />

          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-2">
            <div className="absolute inset-x-2 inset-y-2 rounded-[32px] surface-panel-soft" />
            <div className="absolute inset-x-3.5 inset-y-3.5 rounded-[28px]
                            bg-[radial-gradient(circle_at_50%_40%,hsl(151_56%_25%)_0%,hsl(var(--felt))_42%,hsl(var(--felt-rim))_84%,hsl(154_43%_13%)_100%)]
                            border border-bone/6
                            shadow-[inset_0_0_48px_rgba(0,0,0,0.35)]" />

            <div className="relative z-10 flex flex-col items-center gap-4 w-full">
              <PotDisplay pots={gameState.pots} />
              <CommunityCards cards={gameState.communityCards} />
            </div>
          </div>

          <MobileSelfBar
            currentPlayer={currentPlayer}
            position={currentPlayerPosition}
            isAdmin={isAdmin}
            isMyTurn={isMyTurn}
            chipColor={chipColor.color}
          />
        </>
      )}

      {/* Actions */}
      {isHandComplete ? (
        <div className="control-rail px-3 pb-3 pt-2">
          <div className="space-y-3 rounded-[26px] surface-panel p-3 text-center mx-auto max-w-2xl">
            {gameState.lastAction && (
              <div className="font-display brass-shimmer-text text-lg">
                {gameState.lastAction.action}
              </div>
            )}
            {isAdmin ? (
              <Button variant="raise" size="xl" className="w-full" onClick={handleNewHand}>
                Deal Next Hand
              </Button>
            ) : (
              <div className="text-bone-dim text-xs italic font-display">Waiting for next hand…</div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {currentPlayer.holeCards && (
                <Button
                  variant={currentPlayer.wantsToShowCards ? 'host' : 'outline'}
                  className="w-full"
                  onClick={handleShowCards}
                >
                  {currentPlayer.wantsToShowCards ? 'Hide Cards' : 'Show Cards'}
                </Button>
              )}
              <Button variant="fold" className="w-full" onClick={handleLeaveGame}>
                Leave Game
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ActionBar />
      )}

      <AdminPanel />
      <HandRankings />
      <ChatPanel />
      <WinnerBanner gameState={gameState} />
    </div>
  );
}

// ============================================================
// MOBILE SELF BAR — avatar/name/chips + hole cards prominent
// ============================================================
function MobileSelfBar({
  currentPlayer,
  position,
  isAdmin,
  isMyTurn,
  chipColor,
}: {
  currentPlayer: Player;
  position: string | null;
  isAdmin: boolean;
  isMyTurn: boolean;
  chipColor: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-ink/24 backdrop-blur-sm brass-hairline-t">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold
          shadow-md shadow-ink/40
          ${isMyTurn
            ? 'border-brass/42 bg-gradient-to-b from-felt-rim to-panel-strong text-bone ring-2 ring-brass/22 ring-pulse'
            : 'border-bone/10 bg-gradient-to-b from-panel-soft to-panel-strong text-bone'}`}>
          {currentPlayer.name[0].toUpperCase()}
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-bone truncate max-w-[90px]">
              {currentPlayer.name}
            </span>
            {position && (
              <Badge variant="brass" className="px-1 py-0 text-[8px] h-3.5 tracking-tight">
                {position}
              </Badge>
            )}
            {isAdmin && <span className="text-brass text-[10px]">★</span>}
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-full border border-bone/20 shrink-0"
              style={{ backgroundColor: chipColor }}
            />
            <span className="text-xs font-mono font-semibold tabular-nums text-bone-dim">
              {currentPlayer.chips.toLocaleString()}
            </span>
            {currentPlayer.currentBet > 0 && (
              <span className="text-[9px] text-brass/70 font-mono tabular-nums">
                (bet {currentPlayer.currentBet.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      </div>

      {currentPlayer.holeCards && !currentPlayer.isFolded && (
        <div className="flex shrink-0 gap-1">
          {currentPlayer.holeCards.map((card, i) => (
            <Card key={i} card={card} size="md" />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TEEN PATTI LAYOUT
// ============================================================
function TeenPattiLayout() {
  const { gameState, playerId, roomCode, currentPlayer, isAdmin, isMyTurn } = useGame();
  const { socket } = useSocket();
  const isWide = useMediaQuery('(min-width: 768px)');

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

  const positions = useMemo(() => {
    return getSeatPositions(
      seatedPlayers.length,
      seatedPlayers.findIndex(p => p.id === playerId)
    );
  }, [seatedPlayers.length, playerId]);

  // Auto-pack on turn timer expiry (PRD D4).
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
          socket?.emit('action', {
            roomCode: roomCode!,
            playerId: playerId!,
            action: { type: 'PACK' },
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

  // Sideshow resolution toasts. We track the previous pending sideshow and
  // fire when it transitions to null so we can read lastAction (already
  // broadcast) to determine whether the response was a decline or an accept.
  const prevPendingRef = useRef(gameState?.pendingSideshow ?? null);
  useEffect(() => {
    const prev = prevPendingRef.current;
    const curr = gameState?.pendingSideshow ?? null;
    prevPendingRef.current = curr;
    if (!prev || curr) return;
    const last = gameState?.lastAction;
    if (!last) return;
    const requester = gameState?.players.find(p => p.id === prev.requesterId);
    const target = gameState?.players.find(p => p.id === prev.targetId);
    if (last.action === 'sideshow declined' && prev.requesterId === playerId) {
      toast.info(`${target?.name ?? 'Opponent'} declined your sideshow`);
    } else if (last.action === 'sideshow lost — packs') {
      const loserId = last.playerId;
      const winnerId = loserId === prev.requesterId ? prev.targetId : prev.requesterId;
      const winner = gameState?.players.find(p => p.id === winnerId);
      const loser = loserId === requester?.id ? requester : target;
      if (winner && loser) {
        toast.info(`${winner.name} won sideshow over ${loser.name}`);
      }
    }
  }, [gameState?.pendingSideshow, gameState?.lastAction, gameState?.players, playerId]);

  if (!gameState || !playerId || !roomCode || !currentPlayer) return null;

  const handleNewHand = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'START_HAND' } });
  };
  const handleSee = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'SEE_CARDS' } });
  };
  const handleShowCards = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'SHOW_CARDS' } });
  };
  const handleLeaveGame = () => {
    localStorage.removeItem('lazypoker_session');
    socket?.emit('action', { roomCode, playerId, action: { type: 'LEAVE_GAME' } });
  };

  const isHandComplete = gameState.phase === 'HAND_COMPLETE';
  const stake = gameState.currentBet;
  const seen = !!currentPlayer.hasSeenCards;
  const myChaalCost = stake * (seen ? 2 : 1);
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);
  const tpConfig = gameState.teenPatti;

  const chipColor = CHIP_COLORS.reduce((best, chip) =>
    currentPlayer.chips >= chip.value ? chip : best
  , CHIP_COLORS[0]);

  return (
    <div className="game-shell h-full flex flex-col felt-noise vignette mx-auto w-full max-w-6xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-ink/28 backdrop-blur-sm brass-hairline-b">
        <div className="text-[10px] sm:text-xs text-bone-dim font-mono tabular-nums whitespace-nowrap">
          #{gameState.handNumber} · boot {tpConfig?.boot ?? '—'}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {turnTimer > 0 && isMyTurn && !isHandComplete && (
            <Badge variant={timeLeft <= 5 ? 'ember' : 'brass'} className={timeLeft <= 5 ? 'animate-pulse' : ''}>
              {timeLeft}s
            </Badge>
          )}
          <Badge variant="outline">Teen Patti</Badge>
        </div>
        <div className="text-[10px] sm:text-xs text-brass font-display tracking-[0.18em] uppercase whitespace-nowrap">
          Stake {stake.toLocaleString()}
        </div>
      </div>

      {isWide ? (
        // Tablet/desktop: elliptical table
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,hsl(var(--felt-rim)/0.12),transparent_40%)]" />
          <div className="absolute left-[4%] right-[4%] top-[6%] bottom-[7%] rounded-[50%] table-shell" />
          <div className="absolute left-[5%] right-[5%] top-[7.5%] bottom-[8.5%] rounded-[50%] table-felt" />
          <div className="absolute left-[12%] right-[12%] top-[18%] bottom-[18%] rounded-[50%] table-spotlight opacity-80" />

          {seatedPlayers.map((player, i) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isActive={gameState.players[gameState.activePlayerIndex]?.id === player.id}
              isCurrentPlayer={player.id === playerId}
              showCards={true}
              position={positions[i] || { x: 50, y: 50 }}
              cardCount={3}
              seenStatus={
                isHandComplete || !player.holeCards
                  ? null
                  : player.hasSeenCards ? 'seen' : 'blind'
              }
              actionBadge={
                recentActorId === player.id && gameState.lastAction
                  ? gameState.lastAction
                  : null
              }
            />
          ))}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                          flex flex-col items-center gap-3">
            <PotDisplay pots={gameState.pots} />
            <div className="surface-pill rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-brass/85">
              Stake {stake.toLocaleString()}
            </div>
          </div>
        </div>
      ) : null}

      {isWide && !isHandComplete && (
        <div className="px-3 pb-2">
          <div className="surface-pill mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-[28px] px-4 py-3">
            {currentPlayer.holeCards && !currentPlayer.isFolded ? (
              <div className="flex justify-center gap-2">
                {currentPlayer.holeCards.map((card, i) => (
                  <Card key={i} card={card} size="lg" />
                ))}
              </div>
            ) : !currentPlayer.isFolded ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} card={null} faceDown size="lg" />
                  ))}
                </div>
                {isMyTurn && (
                  <Button variant="outline" size="sm" onClick={handleSee}>See</Button>
                )}
              </div>
            ) : null}
            <div className="rounded-full border border-bone/10 bg-panel-strong/55 px-3 py-2">
              <ChipStack amount={currentPlayer.chips} size="md" />
            </div>
            <Badge variant={seen ? 'brass' : 'muted'} className="text-[10px]">
              {seen ? 'SEEN' : 'BLIND'} · chaal {myChaalCost.toLocaleString()}
            </Badge>
          </div>
        </div>
      )}

      {!isWide && (
        <>
          <OpponentBand opponents={opponents} gameState={gameState} currentPlayerId={playerId} />

          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-2">
            <div className="absolute inset-x-2 inset-y-2 rounded-[32px] surface-panel-soft" />
            <div className="absolute inset-x-3.5 inset-y-3.5 rounded-[28px]
                            bg-[radial-gradient(circle_at_50%_40%,hsl(151_56%_25%)_0%,hsl(var(--felt))_42%,hsl(var(--felt-rim))_84%,hsl(154_43%_13%)_100%)]
                            border border-bone/6
                            shadow-[inset_0_0_48px_rgba(0,0,0,0.35)]" />

            <div className="relative z-10 flex flex-col items-center gap-3 w-full">
              <PotDisplay pots={gameState.pots} />
              <div className="surface-pill rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-brass/85">
                Stake {stake.toLocaleString()}
              </div>
              {currentPlayer.holeCards && !currentPlayer.isFolded ? (
                <div className="flex gap-1">
                  {currentPlayer.holeCards.map((card, i) => (
                    <Card key={i} card={card} size="md" />
                  ))}
                </div>
              ) : !currentPlayer.isFolded ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i} card={null} faceDown size="md" />
                    ))}
                  </div>
                  {isMyTurn && (
                    <Button variant="outline" size="sm" onClick={handleSee}>See cards</Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <MobileSelfBar
            currentPlayer={currentPlayer}
            position={null}
            isAdmin={isAdmin}
            isMyTurn={isMyTurn}
            chipColor={chipColor.color}
          />
        </>
      )}

      {isHandComplete ? (
        <div className="control-rail px-3 pb-3 pt-2">
          <div className="space-y-3 rounded-[26px] surface-panel p-3 text-center mx-auto max-w-2xl">
            {gameState.lastAction && (
              <div className="font-display brass-shimmer-text text-lg">
                {gameState.lastAction.action}
              </div>
            )}
            {isAdmin ? (
              <Button variant="raise" size="xl" className="w-full" onClick={handleNewHand}>
                Deal Next Hand
              </Button>
            ) : (
              <div className="text-bone-dim text-xs italic font-display">Waiting for next hand…</div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {currentPlayer.holeCards && (
                <Button
                  variant={currentPlayer.wantsToShowCards ? 'host' : 'outline'}
                  className="w-full"
                  onClick={handleShowCards}
                >
                  {currentPlayer.wantsToShowCards ? 'Hide Cards' : 'Show Cards'}
                </Button>
              )}
              <Button variant="fold" className="w-full" onClick={handleLeaveGame}>
                Leave Game
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <TeenPattiActionBar />
      )}

      <AdminPanel />
      <HandRankings />
      <ChatPanel />
      <WinnerBanner gameState={gameState} />
    </div>
  );
}

