import { Player } from '@common/types';
import ChipStack from './ChipStack';
import Card from './Card';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isCurrentPlayer: boolean;
  showCards: boolean;
  position: { x: number; y: number };
}

export default function PlayerSeat({ player, isActive, isCurrentPlayer, showCards, position }: PlayerSeatProps) {
  const statusColor = player.isFolded
    ? 'opacity-40'
    : player.isAllIn
      ? 'ring-2 ring-yellow-400'
      : !player.isConnected
        ? 'opacity-30'
        : '';

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center
                   transition-all duration-300 ${statusColor}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      {/* Bet indicator */}
      {player.currentBet > 0 && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
          <div className="bg-black/60 px-2 py-0.5 rounded-full text-xs text-gold font-bold">
            {player.currentBet.toLocaleString()}
          </div>
        </div>
      )}

      {/* Avatar */}
      <div className={`relative ${isActive ? 'active-glow' : ''} rounded-full`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
          ${isCurrentPlayer
            ? 'bg-gold text-black'
            : 'bg-white/20 text-white'
          }
          ${player.isFolded ? 'bg-white/10' : ''}`}
        >
          {player.name[0].toUpperCase()}
        </div>
        {player.isDealer && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black rounded-full
                          text-[10px] font-bold flex items-center justify-center shadow">
            D
          </div>
        )}
        {player.isAllIn && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-black
                          px-1.5 py-0 rounded text-[9px] font-bold whitespace-nowrap">
            ALL IN
          </div>
        )}
      </div>

      {/* Name */}
      <div className="text-xs font-medium mt-1 max-w-[70px] truncate text-center">
        {player.name}
        {player.isAdmin && <span className="text-gold ml-0.5">★</span>}
      </div>

      {/* Stack */}
      <ChipStack amount={player.chips} size="sm" />

      {/* Hole cards - only visible for current player */}
      {showCards && player.holeCards && (
        <div className="flex gap-0.5 mt-1">
          <Card card={player.holeCards[0]} size="sm" />
          <Card card={player.holeCards[1]} size="sm" />
        </div>
      )}
      {showCards && !player.holeCards && !player.isFolded && !isCurrentPlayer && (
        <div className="flex gap-0.5 mt-1">
          <Card card={null} faceDown size="sm" />
          <Card card={null} faceDown size="sm" />
        </div>
      )}
    </div>
  );
}
