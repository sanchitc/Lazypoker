import { Player } from '@common/types';
import ChipStack from './ChipStack';
import Card from './Card';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isCurrentPlayer: boolean;
  showCards: boolean;
  position: { x: number; y: number };
  actionBadge?: { action: string; amount?: number } | null;
}

function getActionChipStyle(action: string, amount?: number): { label: string; classes: string } | null {
  const a = action.toLowerCase();
  const amt = amount !== undefined ? ` ${amount.toLocaleString()}` : '';
  if (a.includes('fold'))   return { label: 'FOLD',           classes: 'bg-red-500 text-white' };
  if (a.includes('check'))  return { label: 'CHECK',          classes: 'bg-white text-slate-900' };
  if (a.includes('call'))   return { label: `CALL${amt}`,     classes: 'bg-emerald-500 text-white' };
  if (a.includes('raise'))  return { label: `RAISE${amt}`,    classes: 'bg-gold text-black' };
  if (a.includes('bet'))    return { label: `BET${amt}`,      classes: 'bg-gold text-black' };
  if (a.includes('all-in')) return { label: `ALL IN${amt}`,   classes: 'bg-yellow-400 text-black animate-pulse' };
  return null;
}

export default function PlayerSeat({ player, isActive, isCurrentPlayer, showCards, position, actionBadge }: PlayerSeatProps) {
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

      {/* Action chip — pops away from the table center so it never covers community cards */}
      {actionBadge && (() => {
        const style = getActionChipStyle(actionBadge.action, actionBadge.amount);
        if (!style) return null;
        const isBottomSeat = position.y > 55;
        const placement = isBottomSeat
          ? 'bottom-0 translate-y-[calc(100%+0.5rem)]'
          : '-top-8 -translate-y-full';
        return (
          <div className={`absolute left-1/2 -translate-x-1/2 ${placement}
                           px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide
                           whitespace-nowrap shadow-lg shadow-black/50 border border-black/20
                           animate-scale-pop z-10 ${style.classes}`}>
            {style.label}
          </div>
        );
      })()}

      {/* Avatar */}
      <div className={`relative ${isActive ? 'active-glow' : ''} rounded-full`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold
          border-2 shadow-lg shadow-black/40
          ${isCurrentPlayer
            ? 'bg-gold text-black border-gold'
            : 'bg-slate-800 text-white border-white/30'
          }`}
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
