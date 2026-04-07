import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useGame } from '../context/GameContext';
import { GameMode } from '@common/types';

export default function JoinScreen() {
  const { socket, connected, serverUrl, setServerUrl } = useSocket();
  const { dispatch } = useGame();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<GameMode>('chip-only');
  const [view, setView] = useState<'home' | 'join' | 'create'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverInput, setServerInput] = useState('');

  // Check URL for room code
  useEffect(() => {
    const path = window.location.pathname.slice(1).toUpperCase();
    if (path && path.length === 4) {
      setRoomCode(path);
      setView('join');
    }
  }, []);

  // Try to reconnect from saved session
  useEffect(() => {
    if (!socket || !connected) return;
    const saved = localStorage.getItem('lazypoker_session');
    if (saved) {
      try {
        const { playerId, roomCode: savedRoom } = JSON.parse(saved);
        socket.emit('reconnect-player', { roomCode: savedRoom, playerId }, (response) => {
          if (response.success) {
            dispatch({ type: 'SET_PLAYER', playerId, roomCode: savedRoom });
          } else {
            localStorage.removeItem('lazypoker_session');
          }
        });
      } catch {
        localStorage.removeItem('lazypoker_session');
      }
    }
  }, [socket, connected]);

  const handleCreate = () => {
    if (!socket || !name.trim()) return;
    setLoading(true);
    setError('');
    socket.emit('create', { playerName: name.trim(), mode }, (response) => {
      setLoading(false);
      dispatch({ type: 'SET_PLAYER', playerId: response.playerId, roomCode: response.roomCode });
      window.history.pushState(null, '', `/${response.roomCode}`);
    });
  };

  const handleJoin = () => {
    if (!socket || !name.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError('');
    socket.emit('join', { playerName: name.trim(), roomCode: roomCode.toUpperCase() }, (response) => {
      setLoading(false);
      if (response.success && response.playerId) {
        dispatch({ type: 'SET_PLAYER', playerId: response.playerId, roomCode: roomCode.toUpperCase() });
      } else {
        setError(response.error || 'Failed to join');
      }
    });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="text-5xl mb-2">♠ ♥ ♦ ♣</div>
        <h1 className="text-4xl font-bold tracking-tight">
          Lazy<span className="text-gold">Poker</span>
        </h1>
        <p className="text-white/60 mt-2">No chips? No problem.</p>
      </div>

      {!serverUrl && (
        <div className="space-y-3 w-full max-w-xs mb-4 animate-fade-in">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-sm text-white/70 text-center">
              Enter the game server address to connect
            </p>
            <input
              type="text"
              placeholder="http://192.168.1.x:3000"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              className="w-full py-3 px-4 bg-white/10 border border-white/20 rounded-xl
                         text-white placeholder-white/40 text-center text-sm
                         focus:outline-none focus:border-gold"
            />
            <button
              onClick={() => {
                if (serverInput.trim()) {
                  setServerUrl(serverInput.trim().replace(/\/$/, ''));
                }
              }}
              disabled={!serverInput.trim()}
              className="w-full py-3 bg-gold text-black font-bold rounded-xl
                         hover:bg-gold/90 active:scale-95 transition-all disabled:opacity-50"
            >
              Connect
            </button>
            <p className="text-xs text-white/40 text-center">
              The host runs the server locally and shares the address
            </p>
          </div>
        </div>
      )}

      {serverUrl && !connected && (
        <div className="text-yellow-400 mb-4 text-sm">Connecting to server...</div>
      )}

      {view === 'home' && serverUrl && (
        <div className="space-y-3 w-full max-w-xs animate-fade-in">
          <button
            onClick={() => setView('create')}
            disabled={!connected}
            className="w-full py-4 bg-gold text-black font-bold rounded-xl text-lg
                       hover:bg-gold/90 active:scale-95 transition-all disabled:opacity-50"
          >
            Create Game
          </button>
          <button
            onClick={() => setView('join')}
            disabled={!connected}
            className="w-full py-4 bg-white/10 border border-white/20 rounded-xl text-lg
                       hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
          >
            Join Game
          </button>
        </div>
      )}

      {view === 'create' && (
        <div className="space-y-4 w-full max-w-xs animate-slide-up">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={15}
            autoFocus
            className="w-full py-3 px-4 bg-white/10 border border-white/20 rounded-xl
                       text-white placeholder-white/40 text-center text-lg
                       focus:outline-none focus:border-gold"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setMode('chip-only')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all
                ${mode === 'chip-only'
                  ? 'bg-gold text-black'
                  : 'bg-white/10 border border-white/20'}`}
            >
              Chip Only
            </button>
            <button
              onClick={() => setMode('full')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all
                ${mode === 'full'
                  ? 'bg-gold text-black'
                  : 'bg-white/10 border border-white/20'}`}
            >
              Full Game
            </button>
          </div>

          <p className="text-xs text-white/50 text-center">
            {mode === 'chip-only'
              ? 'Use your own cards. App tracks chips & bets.'
              : 'Cards dealt on your phone. Full digital poker.'}
          </p>

          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="w-full py-4 bg-gold text-black font-bold rounded-xl text-lg
                       hover:bg-gold/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Start Game'}
          </button>

          <button
            onClick={() => setView('home')}
            className="w-full py-2 text-white/50 text-sm"
          >
            Back
          </button>
        </div>
      )}

      {view === 'join' && (
        <div className="space-y-4 w-full max-w-xs animate-slide-up">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={15}
            autoFocus
            className="w-full py-3 px-4 bg-white/10 border border-white/20 rounded-xl
                       text-white placeholder-white/40 text-center text-lg
                       focus:outline-none focus:border-gold"
          />
          <input
            type="text"
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="w-full py-3 px-4 bg-white/10 border border-white/20 rounded-xl
                       text-white placeholder-white/40 text-center text-2xl tracking-[0.5em]
                       font-mono focus:outline-none focus:border-gold"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={!name.trim() || !roomCode.trim() || loading}
            className="w-full py-4 bg-gold text-black font-bold rounded-xl text-lg
                       hover:bg-gold/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join Game'}
          </button>

          <button
            onClick={() => { setView('home'); setError(''); }}
            className="w-full py-2 text-white/50 text-sm"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
