import { SocketProvider } from './context/SocketContext';
import { GameProvider, useGame } from './context/GameContext';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import ResultScreen from './screens/ResultScreen';

function AppContent() {
  const { gameState, playerId, gameSummary } = useGame();

  // Show results if game ended
  if (gameSummary) {
    return <ResultScreen />;
  }

  // Not joined yet
  if (!gameState || !playerId) {
    return <JoinScreen />;
  }

  // In lobby
  if (gameState.phase === 'WAITING' || gameState.phase === 'SETUP') {
    return <LobbyScreen />;
  }

  // In game
  return <GameScreen />;
}

export default function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <div className="h-screen w-screen overflow-hidden select-none">
          <AppContent />
        </div>
      </GameProvider>
    </SocketProvider>
  );
}
