import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Check } from 'lucide-react';

const SEAT_LABELS = [
  'Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5',
  'Seat 6', 'Seat 7', 'Seat 8', 'Seat 9', 'Seat 10',
];

export default function LobbyScreen() {
  const { gameState, playerId, roomCode, isAdmin } = useGame();
  const { socket } = useSocket();
  const [copied, setCopied] = useState(false);

  if (!gameState || !playerId || !roomCode) return null;

  const handleSeatSelect = (seatIndex: number) => {
    socket?.emit('select-seat', { roomCode, playerId, seatIndex });
  };

  const handleStartGame = () => {
    socket?.emit('action', { roomCode, playerId, action: { type: 'START_HAND' } });
  };

  const handleConfigure = (key: string, value: number | string) => {
    socket?.emit('configure', { roomCode, playerId, config: { [key]: value } });
  };

  const handleBlinds = (val: string) => {
    const [sb, bb] = val.split('/').map(Number);
    handleConfigure('smallBlind', sb);
    setTimeout(() => handleConfigure('bigBlind', bb), 50);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const seatedPlayers = gameState.players.filter(p => p.seatIndex >= 0);
  const canStart = seatedPlayers.length >= 2;
  const isTeenPatti = gameState.variant === 'teen-patti';

  return (
    <div className="h-full flex flex-col p-4 felt-noise vignette mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="font-display text-3xl font-medium tracking-tight leading-none">
          <span className="text-bone">Lazy</span>
          <span className="italic text-brass">Poker</span>
        </h2>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="font-mono text-3xl tracking-[0.4em] text-brass">{roomCode}</span>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1.5 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
        <p className="text-bone-dim/80 text-xs mt-2 tracking-wide uppercase">
          {isTeenPatti
            ? 'Teen Patti'
            : gameState.mode === 'chip-only' ? 'Chip Only' : 'Full Game'}
          <span className="mx-2 text-brass/40">·</span>
          {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Admin Config */}
      {isAdmin && (
        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            {!isTeenPatti && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Mode</span>
                  <ToggleGroup
                    type="single"
                    value={gameState.mode}
                    onValueChange={(v) => v && handleConfigure('mode', v)}
                  >
                    <ToggleGroupItem value="chip-only" className="px-3 py-1 text-[11px]">Chip Only</ToggleGroupItem>
                    <ToggleGroupItem value="full" className="px-3 py-1 text-[11px]">Full</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <Separator />
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Starting Chips</span>
              <Select
                value={String(gameState.startingChips)}
                onValueChange={(v) => handleConfigure('startingChips', parseInt(v))}
              >
                <SelectTrigger className="w-32 h-9 text-sm font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[500, 1000, 2000, 5000, 10000].map(v => (
                    <SelectItem key={v} value={String(v)} className="font-mono">
                      {v.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Turn Timer</span>
              <Select
                value={String(gameState.turnTimer ?? 0)}
                onValueChange={(v) => handleConfigure('turnTimer', parseInt(v))}
              >
                <SelectTrigger className="w-32 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Off</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="90">90 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {isTeenPatti && gameState.teenPatti ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Boot</span>
                  <Select
                    value={String(gameState.teenPatti.boot)}
                    onValueChange={(v) => handleConfigure('boot', parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-9 text-sm font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 20, 50, 100].map(v => (
                        <SelectItem key={v} value={String(v)} className="font-mono">
                          {v.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Chaal Limit</span>
                  <Select
                    value={String(gameState.teenPatti.chaalLimitMultiplier)}
                    onValueChange={(v) => handleConfigure('chaalLimitMultiplier', parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-9 text-sm font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 8].map(v => (
                        <SelectItem key={v} value={String(v)} className="font-mono">
                          {v}× stake
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Pot Limit</span>
                  <Select
                    value={String(gameState.teenPatti.potLimitMultiplier)}
                    onValueChange={(v) => handleConfigure('potLimitMultiplier', parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-9 text-sm font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[64, 128, 256, 512].map(v => (
                        <SelectItem key={v} value={String(v)} className="font-mono">
                          {v}× boot
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Blinds</span>
                <Select
                  value={`${gameState.smallBlind}/${gameState.bigBlind}`}
                  onValueChange={handleBlinds}
                >
                  <SelectTrigger className="w-32 h-9 text-sm font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[[1, 2], [5, 10], [10, 20], [25, 50], [50, 100], [100, 200]].map(([sb, bb]) => (
                      <SelectItem key={`${sb}/${bb}`} value={`${sb}/${bb}`} className="font-mono">
                        {sb}/{bb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seats Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-brass">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: gameState.maxPlayers }, (_, i) => {
            const seated = gameState.players.find(p => p.seatIndex === i);
            const isMe = seated?.id === playerId;
            const myCurrentSeat = gameState.players.find(p => p.id === playerId)?.seatIndex;
            const isClickable = !seated;

            return (
              <button
                key={i}
                onClick={() => isClickable && handleSeatSelect(i)}
                disabled={!!seated && !isMe}
                className={`p-3 rounded-md border text-left transition-all
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-brass
                  ${isMe
                    ? 'border-brass/70 bg-brass/15'
                    : seated
                      ? 'border-brass/15 bg-felt-rim/40'
                      : 'border-brass/15 bg-felt-rim/30 hover:border-brass/50 hover:bg-felt-rim/55'
                  }
                  ${isClickable ? 'cursor-pointer active:scale-[0.98]' : ''}`}
              >
                <div className="font-display text-[10px] uppercase tracking-[0.22em] text-bone-dim/70">
                  {SEAT_LABELS[i]}
                </div>
                {seated ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                      brass-hairline shadow-md
                      ${isMe ? 'bg-brass text-[hsl(220_18%_8%)]' : 'bg-felt-rim text-bone'}`}>
                      {seated.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-bone truncate">
                        {seated.name}
                        {seated.isAdmin && <span className="text-brass ml-1 text-xs">★</span>}
                      </div>
                      <div className="text-[11px] text-bone-dim font-mono tabular-nums">
                        {seated.chips.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-bone-dim/55 text-xs mt-1.5 italic">
                    {myCurrentSeat === undefined || myCurrentSeat === -1 ? 'Tap to sit' : 'Empty'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start / status */}
      {isAdmin ? (
        <div className="mt-4">
          <Button
            variant="raise"
            size="xl"
            className="w-full"
            onClick={handleStartGame}
            disabled={!canStart}
          >
            {canStart
              ? `Deal Cards · ${seatedPlayers.length} player${seatedPlayers.length !== 1 ? 's' : ''}`
              : 'Need at least 2 seated players'}
          </Button>
        </div>
      ) : (
        <div className="mt-4 text-center text-bone-dim text-xs uppercase tracking-[0.18em]">
          Waiting for host…
        </div>
      )}

      <Button
        variant="ghost"
        className="mt-3 w-full text-ember/70 hover:text-ember hover:bg-ember/10"
        onClick={() => {
          localStorage.removeItem('lazypoker_session');
          socket?.emit('action', { roomCode, playerId, action: { type: 'LEAVE_GAME' } });
        }}
      >
        Leave Game
      </Button>
    </div>
  );
}
