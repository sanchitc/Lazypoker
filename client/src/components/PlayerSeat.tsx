import { Player } from '@common/types';
import ChipStack from './ChipStack';
import Card from './Card';
import { Badge } from '@/components/ui/badge';

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
  if (a.includes('fold'))   return { label: 'FOLD',         classes: 'border border-ember/36 bg-ember/14 text-[hsl(10_78%_76%)]' };
  if (a.includes('check'))  return { label: 'CHECK',        classes: 'border border-ivy/34 bg-ivy/18 text-[hsl(146_40%_79%)]' };
  if (a.includes('call'))   return { label: `CALL${amt}`,   classes: 'border border-ivy/34 bg-ivy/18 text-[hsl(146_40%_79%)]' };
  if (a.includes('raise'))  return { label: `RAISE${amt}`,  classes: 'border border-brass/30 bg-brass/12 text-brass' };
  if (a.includes('bet'))    return { label: `BET${amt}`,    classes: 'border border-brass/30 bg-brass/12 text-brass' };
  if (a.includes('all-in')) return { label: `ALL IN${amt}`, classes: 'border border-brass/34 bg-brass/14 text-brass animate-pulse' };
  return null;
}

function getPositionLabel(player: Player): string | null {
  if (player.isDealer) return 'D';
  return null;
}

export default function PlayerSeat({ player, isActive, isCurrentPlayer, showCards, position, actionBadge }: PlayerSeatProps) {
  const statusClass = player.isFolded
    ? 'opacity-40'
    : !player.isConnected
      ? 'opacity-30'
      : '';

  const positionPill = getPositionLabel(player);
  const avatarClasses = isActive
    ? 'border-brass/46 bg-gradient-to-b from-felt-rim to-panel-strong text-bone shadow-[0_18px_30px_-22px_rgba(0,0,0,0.95)]'
    : isCurrentPlayer
      ? 'border-brass/28 bg-gradient-to-b from-panel-soft to-panel-strong text-bone ring-2 ring-brass/12'
      : 'border-bone/10 bg-gradient-to-b from-panel-soft/90 to-panel-strong text-bone';

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center
                   transition-all duration-300 ${statusClass}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      {/* Bet indicator */}
      {player.currentBet > 0 && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
          <div className="surface-pill rounded-full px-2.5 py-1 text-[10px] font-mono tabular-nums text-brass">
            {player.currentBet.toLocaleString()}
          </div>
        </div>
      )}

      {/* Action chip */}
      {actionBadge && (() => {
        const style = getActionChipStyle(actionBadge.action, actionBadge.amount);
        if (!style) return null;
        const isBottomSeat = position.y > 55;
        const placement = isBottomSeat
          ? 'bottom-0 translate-y-[calc(100%+0.5rem)]'
          : '-top-8 -translate-y-full';
        return (
          <div className={`absolute left-1/2 -translate-x-1/2 ${placement}
                           px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[0.08em]
                           whitespace-nowrap shadow-lg shadow-ink/60
                           animate-scale-pop z-10 ${style.classes}`}>
            {style.label}
          </div>
        );
      })()}

      <div className={`relative rounded-full ${isActive ? 'active-glow' : ''}`}>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-extrabold shadow-lg shadow-ink/60 transition-colors ${avatarClasses}`}
        >
          {player.name[0].toUpperCase()}
        </div>
        {positionPill && (
          <div className="absolute -top-1 -right-1">
            <Badge variant="brass" className="px-1.5 py-0 text-[9px] tracking-normal h-4">
              {positionPill}
            </Badge>
          </div>
        )}
        {player.isAllIn && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
            <Badge variant="brass" className="px-1 py-0 text-[8px]">ALL IN</Badge>
          </div>
        )}
      </div>

      <div className="mt-1 max-w-[74px] truncate text-center text-xs font-medium text-bone">
        {player.name}
        {player.isAdmin && <span className="text-brass ml-0.5">★</span>}
      </div>

      <ChipStack amount={player.chips} size="sm" />

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
