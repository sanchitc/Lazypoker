import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { GameState, GameSummary } from '@common/types';
import { useSocket } from './SocketContext';

interface GameContextState {
  gameState: GameState | null;
  playerId: string | null;
  roomCode: string | null;
  error: string | null;
  gameSummary: GameSummary | null;
}

type GameAction =
  | { type: 'SET_STATE'; state: GameState }
  | { type: 'SET_PLAYER'; playerId: string; roomCode: string }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_SUMMARY'; summary: GameSummary }
  | { type: 'RESET' };

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, gameState: action.state, error: null };
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, roomCode: action.roomCode };
    case 'SET_ERROR':
      return { ...state, error: action.message };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_SUMMARY':
      return { ...state, gameSummary: action.summary };
    case 'RESET':
      return { gameState: null, playerId: null, roomCode: null, error: null, gameSummary: null };
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
  error: null,
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
    error: null,
    gameSummary: null,
  });

  useEffect(() => {
    if (!socket) return;

    const handleStateUpdate = (gameState: GameState) => {
      dispatch({ type: 'SET_STATE', state: gameState });
    };

    const handleError = (data: { message: string }) => {
      dispatch({ type: 'SET_ERROR', message: data.message });
    };

    const handleGameEnded = (data: { summary: GameSummary }) => {
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
