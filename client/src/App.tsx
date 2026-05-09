import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGame } from './context/GameContext';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import ResultScreen from './screens/ResultScreen';
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
