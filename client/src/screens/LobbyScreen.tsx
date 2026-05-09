import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

const FIELD_LABEL = 'block text-[10px] uppercase tracking-[0.16em] text-bone-dim mb-1';
const FIELD_TRIGGER = 'w-full h-9 text-sm font-mono';

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
    <div className="h-full flex flex-col felt-noise vignette mx-auto w-full max-w-4xl">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-brass px-4 pt-3 pb-3">
        {/* Compact header */}
        <div className="text-center mb-3">
          <h2 className="font-display text-2xl font-medium tracking-tight leading-none">
            <span className="text-bone">Lazy</span>
            <span className="italic text-brass">Poker</span>
          </h2>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="font-mono text-2xl tracking-[0.32em] text-brass">{roomCode}</span>
            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={handleCopyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1.5 text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <p className="text-bone-dim/80 text-[10px] mt-1.5 tracking-wide uppercase">
            {isTeenPatti
              ? 'Teen Patti'
              : gameState.mode === 'chip-only' ? 'Chip Only' : 'Full Game'}
            <span className="mx-2 text-brass/40">·</span>
            {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Admin Config — dense 2-col grid */}
        {isAdmin && (
          <Card className="mb-3">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {!isTeenPatti && (
                  <div className="col-span-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-bone-dim">Mode</span>
                    <ToggleGroup
                      type="single"
                      value={gameState.mode}
                      onValueChange={(v) => v && handleConfigure('mode', v)}
                    >
                      <ToggleGroupItem value="chip-only" className="px-3 py-1 text-[11px]">Chip Only</ToggleGroupItem>
                      <ToggleGroupItem value="full" className="px-3 py-1 text-[11px]">Full</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                )}

                <div>
                  <label className={FIELD_LABEL}>Starting Chips</label>
                  <Select
                    value={String(gameState.startingChips)}
                    onValueChange={(v) => handleConfigure('startingChips', parseInt(v))}
                  >
                    <SelectTrigger className={FIELD_TRIGGER}>
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

                <div>
                  <label className={FIELD_LABEL}>Turn Timer</label>
                  <Select
                    value={String(gameState.turnTimer ?? 0)}
                    onValueChange={(v) => handleConfigure('turnTimer', parseInt(v))}
                  >
                    <SelectTrigger className={FIELD_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Off</SelectItem>
                      <SelectItem value="15">15s</SelectItem>
                      <SelectItem value="30">30s</SelectItem>
                      <SelectItem value="60">60s</SelectItem>
                      <SelectItem value="90">90s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isTeenPatti && gameState.teenPatti ? (
                  <>
                    <div>
                      <label className={FIELD_LABEL}>Boot</label>
                      <Select
                        value={String(gameState.teenPatti.boot)}
                        onValueChange={(v) => handleConfigure('boot', parseInt(v))}
                      >
                        <SelectTrigger className={FIELD_TRIGGER}>
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

                    <div>
                      <label className={FIELD_LABEL}>Chaal Limit</label>
                      <Select
                        value={String(gameState.teenPatti.chaalLimitMultiplier)}
                        onValueChange={(v) => handleConfigure('chaalLimitMultiplier', parseInt(v))}
                      >
                        <SelectTrigger className={FIELD_TRIGGER}>
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

                    <div>
                      <label className={FIELD_LABEL}>Blind Limit</label>
                      <Select
                        value={String(gameState.teenPatti.blindLimit ?? 0)}
                        onValueChange={(v) => handleConfigure('blindLimit', parseInt(v))}
                      >
                        <SelectTrigger className={FIELD_TRIGGER}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="font-mono">No limit</SelectItem>
                          {[1, 2, 3, 4].map(v => (
                            <SelectItem key={v} value={String(v)} className="font-mono">
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className={FIELD_LABEL}>Pot Limit</label>
                      <Select
                        value={String(gameState.teenPatti.potLimitMultiplier)}
                        onValueChange={(v) => handleConfigure('potLimitMultiplier', parseInt(v))}
                      >
                        <SelectTrigger className={FIELD_TRIGGER}>
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
                  <div>
                    <label className={FIELD_LABEL}>Blinds</label>
                    <Select
                      value={`${gameState.smallBlind}/${gameState.bigBlind}`}
                      onValueChange={handleBlinds}
                    >
                      <SelectTrigger className={FIELD_TRIGGER}>
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seats Grid */}
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
                className={`p-2.5 rounded-md border text-left transition-all
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
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

      {/* Sticky footer — always visible */}
      <div
        className="flex-shrink-0 px-4 pt-2.5 border-t border-brass/12 bg-[hsl(var(--ink)/0.85)] backdrop-blur"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {isAdmin ? (
          <Button
            variant="raise"
            size="lg"
            className="w-full"
            onClick={handleStartGame}
            disabled={!canStart}
          >
            {canStart
              ? `Deal Cards · ${seatedPlayers.length} player${seatedPlayers.length !== 1 ? 's' : ''}`
              : 'Need at least 2 seated players'}
          </Button>
        ) : (
          <div className="py-3 text-center text-bone-dim text-xs uppercase tracking-[0.18em]">
            Waiting for host…
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5 w-full text-ember/70 hover:text-ember hover:bg-ember/10"
          onClick={() => {
            localStorage.removeItem('lazypoker_session');
            socket?.emit('action', { roomCode, playerId, action: { type: 'LEAVE_GAME' } });
          }}
        >
          Leave Game
        </Button>
      </div>
    </div>
  );
}
