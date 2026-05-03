import { Player, GameState } from '@common/types';
import { CHIP_COLORS } from '@common/constants';
import { Badge } from '@/components/ui/badge';
import Card from './Card';

interface OpponentBandProps {
  opponents: Player[];
  gameState: GameState;
  currentPlayerId: string;
}

function getPositionBadge(player: Player, gameState: GameState): string | null {
  if (player.isDealer) return 'D';
  const players = gameState.players.filter(p => p.seatIndex >= 0 && !p.isSittingOut);
  const dealerIdx = players.findIndex(p => p.isDealer);
  if (dealerIdx >= 0) {
    const sbIdx = (dealerIdx + 1) % players.length;
    const bbIdx = (dealerIdx + 2) % players.length;
    if (players[sbIdx]?.id === player.id) return 'SB';
    if (players[bbIdx]?.id === player.id) return 'BB';
  }
  return null;
}

function getStatusBadge(player: Player, gameState: GameState):
  | { text: string; variant: 'brass' | 'ember' | 'ivy' | 'muted' }
  | null {
  if (player.isFolded) return { text: gameState.variant === 'teen-patti' ? 'PACK' : 'FOLD', variant: 'muted' };
  if (player.isAllIn) return { text: 'ALL IN', variant: 'brass' };

  const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;

  // Teen Patti: SEEN/BLIND is the meaningful persistent badge — whose turn it is
  // is already conveyed by the bubble's ring-pulse highlight. Show transient
  // action labels when this player just acted, otherwise fall through to
  // SEEN/BLIND so opponents see SEEN immediately on a SEE_CARDS action.
  if (gameState.variant === 'teen-patti') {
    if (gameState.lastAction?.playerId === player.id) {
      const action = gameState.lastAction.action.toLowerCase();
      if (action.includes('chaal')) return { text: 'CHAAL', variant: 'ivy' };
      if (action.includes('raise')) return { text: 'RAISE', variant: 'brass' };
      if (action.includes('bet')) return { text: 'BET', variant: 'brass' };
      if (action.includes('see')) return { text: 'SEEN', variant: 'brass' };
      if (action.includes('sideshow')) return { text: 'SIDE', variant: 'brass' };
    }
    return { text: player.hasSeenCards ? 'SEEN' : 'BLIND', variant: player.hasSeenCards ? 'brass' : 'muted' };
  }

  if (isActing) return { text: 'TURN', variant: 'brass' };

  if (gameState.lastAction?.playerId === player.id) {
    const action = gameState.lastAction.action.toLowerCase();
    if (action.includes('check')) return { text: 'CHECK', variant: 'ivy' };
    if (action.includes('call')) return { text: 'CALL', variant: 'ivy' };
    if (action.includes('raise')) return { text: 'RAISE', variant: 'brass' };
    if (action.includes('bet')) return { text: 'BET', variant: 'brass' };
  }

  return null;
}

export default function OpponentBand({ opponents, gameState, currentPlayerId: _currentPlayerId }: OpponentBandProps) {
  if (opponents.length === 0) return null;

  return (
    <div className="flex justify-center gap-2 overflow-x-auto px-3 py-2 scrollbar-hide bg-ink/24 backdrop-blur-sm brass-hairline-b">
      {opponents.map(player => {
        const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;
        const status = getStatusBadge(player, gameState);
        const position = getPositionBadge(player, gameState);
        const isFolded = player.isFolded;

        const chipColor = CHIP_COLORS.reduce((best, chip) =>
          player.chips >= chip.value ? chip : best
        , CHIP_COLORS[0]);

        return (
          <div key={player.id} className="flex flex-shrink-0 flex-col items-center gap-1.5">
          <div
            className={`flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5
              transition-all duration-200
              ${isFolded ? 'opacity-35' : ''}
              ${isActing
                ? 'surface-panel ring-1 ring-brass/30 ring-pulse shadow-[0_0_18px_-8px_hsl(var(--brass)/0.55)]'
                : 'surface-panel-soft'}`}
          >
            <div className="relative flex-shrink-0">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold shadow-md shadow-ink/40
                  ${isActing
                    ? 'border-brass/42 bg-gradient-to-b from-felt-rim to-panel-strong text-bone'
                    : 'border-bone/10 bg-gradient-to-b from-panel-soft to-panel-strong text-bone'}`}
              >
                {player.name[0].toUpperCase()}
              </div>
              {position && (
                <div className="absolute -top-1 -right-1.5">
                  <Badge variant="brass" className="px-1 py-0 text-[7px] h-3.5 tracking-tight">
                    {position}
                  </Badge>
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0 leading-tight">
              <span className="max-w-[68px] truncate text-[10px] font-medium text-bone">
                {player.name}
                {player.isAdmin && <span className="text-brass ml-0.5">*</span>}
              </span>
              <div className="flex items-center gap-0.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 border border-bone/20"
                  style={{ backgroundColor: chipColor.color }}
                />
                <span className="text-[10px] font-mono font-semibold tabular-nums text-bone-dim">
                  {player.chips >= 1000
                    ? `${(player.chips / 1000).toFixed(player.chips % 1000 === 0 ? 0 : 1)}k`
                    : player.chips.toLocaleString()}
                </span>
              </div>
            </div>

            {player.currentBet > 0 && !isFolded && (
              <div className="rounded-full border border-brass/22 bg-brass/10 px-2 py-0.5 text-[9px] font-mono font-bold tabular-nums text-brass">
                {player.currentBet.toLocaleString()}
              </div>
            )}

            {status && (
              <Badge variant={status.variant} className="text-[8px] tracking-tight">
                {status.text}
              </Badge>
            )}
          </div>

          {player.holeCards && (
            <div className="flex gap-0.5">
              {player.holeCards.map((card, i) => (
                <Card key={i} card={card} size="sm" />
              ))}
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}
