import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useGame } from '../context/GameContext';
import { GameMode, GameVariant } from '@common/types';
import { getPlayerKey } from '@/lib/playerKey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import StatsScreen from './StatsScreen';

export default function JoinScreen() {
  const { socket, connected, serverUrl, setServerUrl } = useSocket();
  const { dispatch } = useGame();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [variant, setVariant] = useState<GameVariant>('poker');
  const [mode, setMode] = useState<GameMode>('chip-only');
  const [view, setView] = useState<'home' | 'join' | 'create' | 'stats'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverInput, setServerInput] = useState('');

  useEffect(() => {
    const path = window.location.pathname.slice(1).toUpperCase();
    if (path && path.length === 4) {
      setRoomCode(path);
      setView('join');
    }
  }, []);

  const handleCreate = () => {
    if (!socket || !name.trim()) return;
    setLoading(true);
    setError('');
    socket.emit('create', { playerName: name.trim(), mode, variant, playerKey: getPlayerKey() }, (response) => {
      setLoading(false);
      dispatch({ type: 'SET_PLAYER', playerId: response.playerId, roomCode: response.roomCode });
      window.history.pushState(null, '', `/${response.roomCode}`);
    });
  };

  const handleJoin = () => {
    if (!socket || !name.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError('');
    socket.emit('join', { playerName: name.trim(), roomCode: roomCode.toUpperCase(), playerKey: getPlayerKey() }, (response) => {
      setLoading(false);
      if (response.success && response.playerId) {
        dispatch({ type: 'SET_PLAYER', playerId: response.playerId, roomCode: roomCode.toUpperCase() });
      } else {
        setError(response.error || 'Failed to join');
      }
    });
  };

  if (view === 'stats') {
    return <StatsScreen onBack={() => setView('home')} />;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 felt-noise vignette">
      {/* Wordmark */}
      <div className="mb-10 text-center">
        <div className="text-2xl mb-3 tracking-[0.6em] text-brass/40 select-none">
          ♠ ♥ ♦ ♣
        </div>
        <h1 className="font-display text-6xl font-medium tracking-tight leading-none">
          <span className="text-bone">Lazy</span>
          <span className="italic text-brass">Poker</span>
        </h1>
        <p className="font-display italic text-bone-dim text-sm mt-3 tracking-wide">
          No chips? No problem.
        </p>
      </div>

      {!serverUrl && (
        <Card className="w-full max-w-xs mb-4 animate-fade-in">
          <CardContent className="p-5 space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-bone-dim text-center">
              Server Address
            </p>
            <Input
              type="text"
              placeholder="http://192.168.1.x:3000"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              className="text-center text-sm"
            />
            <Button
              variant="raise"
              size="lg"
              className="w-full"
              onClick={() => {
                if (serverInput.trim()) {
                  setServerUrl(serverInput.trim().replace(/\/$/, ''));
                }
              }}
              disabled={!serverInput.trim()}
            >
              Connect
            </Button>
            <p className="text-[10px] text-bone-dim/70 text-center leading-relaxed">
              The host runs the server locally and shares the address.
            </p>
          </CardContent>
        </Card>
      )}

      {serverUrl && !connected && (
        <div className="text-brass/80 mb-4 text-xs uppercase tracking-[0.2em] animate-pulse">
          Connecting…
        </div>
      )}

      {view === 'home' && serverUrl && (
        <div className="space-y-3 w-full max-w-xs animate-fade-in">
          <Button
            variant="raise"
            size="xl"
            className="w-full"
            onClick={() => setView('create')}
            disabled={!connected}
          >
            Create Game
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="w-full"
            onClick={() => setView('join')}
            disabled={!connected}
          >
            Join Game
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-bone-dim"
            onClick={() => setView('stats')}
          >
            View my stats
          </Button>
        </div>
      )}

      {view === 'create' && (
        <Card className="w-full max-w-xs animate-slide-up">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Your name</Label>
              <Input
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={15}
                autoFocus
                className="text-center text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Game</Label>
              <ToggleGroup
                type="single"
                value={variant}
                onValueChange={(v) => v && setVariant(v as GameVariant)}
                className="w-full"
              >
                <ToggleGroupItem value="poker">Poker</ToggleGroupItem>
                <ToggleGroupItem value="teen-patti">Teen Patti</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {variant === 'poker' && (
              <div className="space-y-2">
                <Label>Mode</Label>
                <ToggleGroup
                  type="single"
                  value={mode}
                  onValueChange={(v) => v && setMode(v as GameMode)}
                  className="w-full"
                >
                  <ToggleGroupItem value="chip-only">Chip Only</ToggleGroupItem>
                  <ToggleGroupItem value="full">Full Game</ToggleGroupItem>
                </ToggleGroup>
                <p className="text-[11px] text-bone-dim/70 text-center leading-relaxed pt-1">
                  {mode === 'chip-only'
                    ? 'Use your own cards. App tracks chips & bets.'
                    : 'Cards dealt on your phone. Full digital poker.'}
                </p>
              </div>
            )}

            {variant === 'teen-patti' && (
              <p className="text-[11px] text-bone-dim/70 text-center leading-relaxed">
                3-card Teen Patti. 2–6 players. Blind/seen, sideshow & show.
              </p>
            )}

            <Button
              variant="raise"
              size="xl"
              className="w-full"
              onClick={handleCreate}
              disabled={!name.trim() || loading}
            >
              {loading ? 'Creating…' : 'Start Game'}
            </Button>

            <Button variant="ghost" className="w-full" onClick={() => setView('home')}>
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {view === 'join' && (
        <Card className="w-full max-w-xs animate-slide-up">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Your name</Label>
              <Input
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={15}
                autoFocus
                className="text-center text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Room code</Label>
              <Input
                type="text"
                variant="mono"
                placeholder="XXXX"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={4}
              />
            </div>

            {error && (
              <p className="text-ember text-xs text-center font-medium">{error}</p>
            )}

            <Button
              variant="raise"
              size="xl"
              className="w-full"
              onClick={handleJoin}
              disabled={!name.trim() || !roomCode.trim() || loading}
            >
              {loading ? 'Joining…' : 'Join Game'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => { setView('home'); setError(''); }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
