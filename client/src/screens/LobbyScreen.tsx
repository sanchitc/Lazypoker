import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';

const SEAT_LABELS = ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5',
                     'Seat 6', 'Seat 7', 'Seat 8', 'Seat 9', 'Seat 10'];

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const seatedPlayers = gameState.players.filter(p => p.seatIndex >= 0);
  const canStart = seatedPlayers.length >= 2;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">
          Lazy<span className="text-gold">Poker</span>
        </h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-3xl font-mono tracking-[0.3em] text-gold">{roomCode}</span>
          <button
            onClick={handleCopyLink}
            className="text-xs bg-white/10 px-3 py-1 rounded-lg hover:bg-white/20 transition"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <p className="text-white/50 text-sm mt-1">
          {gameState.mode === 'chip-only' ? 'Chip Only Mode' : 'Full Game Mode'}
          {' · '}
          {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Admin Config */}
      {isAdmin && (
        <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-sm text-gold">Game Settings</h3>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Mode</span>
            <div className="flex gap-1">
              <button
                onClick={() => handleConfigure('mode', 'chip-only')}
                className={`px-3 py-1 rounded text-xs ${gameState.mode === 'chip-only' ? 'bg-gold text-black' : 'bg-white/10'}`}
              >
                Chip Only
              </button>
              <button
                onClick={() => handleConfigure('mode', 'full')}
                className={`px-3 py-1 rounded text-xs ${gameState.mode === 'full' ? 'bg-gold text-black' : 'bg-white/10'}`}
              >
                Full
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Starting Chips</span>
            <select
              value={gameState.startingChips}
              onChange={(e) => handleConfigure('startingChips', parseInt(e.target.value))}
              className="bg-white/10 rounded px-2 py-1 text-sm"
            >
              {[500, 1000, 2000, 5000, 10000].map(v => (
                <option key={v} value={v}>{v.toLocaleString()}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Turn Timer</span>
            <select
              value={gameState.turnTimer ?? 0}
              onChange={(e) => handleConfigure('turnTimer', parseInt(e.target.value))}
              className="bg-white/10 rounded px-2 py-1 text-sm"
            >
              <option value={0}>Off</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={90}>90s</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Blinds</span>
            <select
              value={`${gameState.smallBlind}/${gameState.bigBlind}`}
              onChange={(e) => {
                const [sb, bb] = e.target.value.split('/').map(Number);
                handleConfigure('smallBlind', sb);
                setTimeout(() => handleConfigure('bigBlind', bb), 50);
              }}
              className="bg-white/10 rounded px-2 py-1 text-sm"
            >
              {[
                [1, 2], [5, 10], [10, 20], [25, 50], [50, 100], [100, 200],
              ].map(([sb, bb]) => (
                <option key={`${sb}/${bb}`} value={`${sb}/${bb}`}>{sb}/{bb}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Seats Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: gameState.maxPlayers }, (_, i) => {
            const seated = gameState.players.find(p => p.seatIndex === i);
            const isMe = seated?.id === playerId;
            const myCurrentSeat = gameState.players.find(p => p.id === playerId)?.seatIndex;

            return (
              <button
                key={i}
                onClick={() => !seated && handleSeatSelect(i)}
                disabled={!!seated && !isMe}
                className={`p-3 rounded-xl border transition-all text-left
                  ${isMe
                    ? 'border-gold bg-gold/20'
                    : seated
                      ? 'border-white/10 bg-white/5'
                      : 'border-white/10 bg-white/5 hover:border-gold/50 hover:bg-white/10'
                  }
                  ${!seated ? 'cursor-pointer' : ''}
                `}
              >
                <div className="text-xs text-white/40">{SEAT_LABELS[i]}</div>
                {seated ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${isMe ? 'bg-gold text-black' : 'bg-white/20'}`}>
                      {seated.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {seated.name}
                        {seated.isAdmin && <span className="text-gold ml-1 text-xs">★</span>}
                      </div>
                      <div className="text-xs text-white/50">{seated.chips.toLocaleString()} chips</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/30 text-sm mt-1">
                    {myCurrentSeat === undefined || myCurrentSeat === -1 ? 'Tap to sit' : 'Empty'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      {isAdmin && (
        <div className="mt-4">
          <button
            onClick={handleStartGame}
            disabled={!canStart}
            className="w-full py-4 bg-gold text-black font-bold rounded-xl text-lg
                       hover:bg-gold/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {canStart
              ? `Deal Cards (${seatedPlayers.length} players)`
              : 'Need at least 2 seated players'}
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="mt-4 text-center text-white/50 text-sm">
          Waiting for host to start the game...
        </div>
      )}

      <button
        onClick={() => {
          localStorage.removeItem('lazypoker_session');
          socket?.emit('action', { roomCode, playerId, action: { type: 'LEAVE_GAME' } });
        }}
        className="mt-3 w-full py-2 text-red-400/70 text-sm border border-red-600/20 rounded-xl
                   hover:text-red-300 hover:border-red-600/40 active:scale-95 transition-all"
      >
        Leave Game
      </button>
    </div>
  );
}
