import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGame } from './context/GameContext';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import ResultScreen from './screens/ResultScreen';
import AdminScreen from './screens/AdminScreen';
import { Toaster } from '@/components/ui/sonner';

function AppContent() {
  const { gameState, playerId, gameSummary } = useGame();

  if (gameSummary) {
    return <ResultScreen />;
  }

  if (!gameState || !playerId) {
    return <JoinScreen />;
  }

  if (gameState.phase === 'WAITING' || gameState.phase === 'SETUP') {
    return <LobbyScreen />;
  }

  return <GameScreen />;
}

export default function App() {
  // Admin URL is its own surface — no socket / game providers needed.
  if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin')) {
    return (
      <div className="h-[100dvh] w-screen overflow-hidden select-none bg-felt-deep text-bone">
        <AdminScreen />
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <GameProvider>
        <div className="h-[100dvh] w-screen overflow-hidden select-none bg-felt-deep text-bone">
          <AppContent />
          <Toaster position="top-center" />
        </div>
      </GameProvider>
    </SocketProvider>
  );
}
