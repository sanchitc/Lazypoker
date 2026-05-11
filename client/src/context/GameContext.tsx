import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { GameState, GameSummary } from '@common/types';
import { useSocket } from './SocketContext';

interface GameContextState {
  gameState: GameState | null;
  playerId: string | null;
  roomCode: string | null;
  gameSummary: GameSummary | null;
}

type GameAction =
  | { type: 'SET_STATE'; state: GameState }
  | { type: 'SET_PLAYER'; playerId: string; roomCode: string }
  | { type: 'SET_SUMMARY'; summary: GameSummary }
  | { type: 'RESET' };

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, gameState: action.state };
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, roomCode: action.roomCode };
    case 'SET_SUMMARY':
      return { ...state, gameSummary: action.summary };
    case 'RESET':
      return { gameState: null, playerId: null, roomCode: null, gameSummary: null };
    default:
      return state;
  }
}

interface GameContextValue extends GameContextState {
  dispatch: React.Dispatch<GameAction>;
  currentPlayer: GameState['players'][0] | null;
  isAdmin: boolean;
  isMyTurn: boolean;
}

const GameContext = createContext<GameContextValue>({
  gameState: null,
  playerId: null,
  roomCode: null,
  gameSummary: null,
  dispatch: () => {},
  currentPlayer: null,
  isAdmin: false,
  isMyTurn: false,
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [state, dispatch] = useReducer(gameReducer, {
    gameState: null,
    playerId: null,
    roomCode: null,
    gameSummary: null,
  });

  useEffect(() => {
    if (!socket) return;

    const handleStateUpdate = (gameState: GameState) => {
      dispatch({ type: 'SET_STATE', state: gameState });
    };

    const handleError = (data: { message: string }) => {
      toast.error(data.message);
    };

    const handleGameEnded = (data: { summary: GameSummary }) => {
      // Clear session immediately so stale reconnects don't re-join a deleted room
      localStorage.removeItem('lazypoker_session');
      dispatch({ type: 'SET_SUMMARY', summary: data.summary });
    };

    socket.on('state:update', handleStateUpdate);
    socket.on('error', handleError);
    socket.on('game:ended', handleGameEnded);

    return () => {
      socket.off('state:update', handleStateUpdate);
      socket.off('error', handleError);
      socket.off('game:ended', handleGameEnded);
    };
  }, [socket]);

  // Persist session for reconnection
  useEffect(() => {
    if (state.playerId && state.roomCode) {
      localStorage.setItem('lazypoker_session', JSON.stringify({
        playerId: state.playerId,
        roomCode: state.roomCode,
      }));
    }
  }, [state.playerId, state.roomCode]);

  // Restore session from localStorage on mount so the rest of the app sees
  // the playerId immediately; the actual server-side re-association happens
  // in the next effect, gated on socket connectivity.
  useEffect(() => {
    const saved = localStorage.getItem('lazypoker_session');
    if (!saved) return;
    try {
      const { playerId, roomCode } = JSON.parse(saved);
      if (playerId && roomCode) {
        dispatch({ type: 'SET_PLAYER', playerId, roomCode });
      }
    } catch {
      localStorage.removeItem('lazypoker_session');
    }
  }, []);

  // Re-emit `reconnect-player` on every socket (re)connect. socket.io
  // auto-reconnects with a NEW socket id when the network drops; without
  // this the server's playerSocketMap stays empty and broadcastState
  // silently skips this client until the page is refreshed.
  const sessionRef = useRef<{ playerId: string | null; roomCode: string | null }>({
    playerId: null,
    roomCode: null,
  });
  useEffect(() => {
    sessionRef.current = { playerId: state.playerId, roomCode: state.roomCode };
  }, [state.playerId, state.roomCode]);

  useEffect(() => {
    if (!socket) return;

    const doReconnect = () => {
      const { playerId, roomCode } = sessionRef.current;
      if (!playerId || !roomCode) return;
      socket.emit('reconnect-player', { roomCode, playerId }, (response) => {
        if (!response.success) {
          // Room is gone server-side — drop the stale session so the user
          // lands back on the join screen instead of looping forever.
          localStorage.removeItem('lazypoker_session');
          dispatch({ type: 'RESET' });
        }
      });
    };

    // Catch the race where the socket already fired 'connect' before this
    // listener attached (common on initial mount).
    if (socket.connected) doReconnect();
    socket.on('connect', doReconnect);

    return () => {
      socket.off('connect', doReconnect);
    };
  }, [socket]);

  const currentPlayer = state.gameState?.players.find(p => p.id === state.playerId) || null;
  const isAdmin = currentPlayer?.isAdmin || false;
  const isMyTurn = state.gameState
    ? state.gameState.activePlayerIndex >= 0 &&
      state.gameState.players[state.gameState.activePlayerIndex]?.id === state.playerId
    : false;

  return (
    <GameContext.Provider value={{ ...state, dispatch, currentPlayer, isAdmin, isMyTurn }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
