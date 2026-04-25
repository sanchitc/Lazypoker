import { Player, GameState } from '@common/types';
import { CHIP_COLORS } from '@common/constants';

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

function getStatusInfo(player: Player, gameState: GameState): { text: string; bg: string } | null {
  if (player.isFolded) return { text: 'FOLD', bg: 'bg-white/10 text-white/30' };
  if (player.isAllIn) return { text: 'ALL IN', bg: 'bg-yellow-500/90 text-black' };

  const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;
  if (isActing) return { text: 'TURN', bg: 'bg-blue-500 text-white' };

  if (gameState.lastAction?.playerId === player.id) {
    const action = gameState.lastAction.action.toLowerCase();
    if (action.includes('check')) return { text: 'CHECK', bg: 'bg-green-500/30 text-green-300' };
    if (action.includes('call')) return { text: 'CALL', bg: 'bg-green-500/30 text-green-300' };
    if (action.includes('raise')) return { text: 'RAISE', bg: 'bg-gold/40 text-gold' };
    if (action.includes('bet')) return { text: 'BET', bg: 'bg-gold/40 text-gold' };
  }

  return null;
}

export default function OpponentBand({ opponents, gameState, currentPlayerId }: OpponentBandProps) {
  if (opponents.length === 0) return null;

  return (
    <div className="flex gap-1.5 px-2 py-1.5 overflow-x-auto scrollbar-hide justify-center">
      {opponents.map(player => {
        const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;
        const status = getStatusInfo(player, gameState);
        const position = getPositionBadge(player, gameState);
        const isFolded = player.isFolded;

        // Chip color indicator based on stack size
        const chipColor = CHIP_COLORS.reduce((best, chip) =>
          player.chips >= chip.value ? chip : best
        , CHIP_COLORS[0]);

        return (
          <div
            key={player.id}
            className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full
              transition-all duration-200 min-w-0
              ${isFolded ? 'opacity-35' : ''}
              ${isActing
                ? 'bg-blue-500/20 ring-2 ring-blue-400/70 ring-pulse'
                : 'bg-white/8 border border-white/10'}`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold
                ${isFolded ? 'bg-white/10 text-white/30' : 'bg-white/15 text-white'}
                ${isActing ? 'ring-2 ring-blue-400' : ''}`}
              >
                {player.name[0].toUpperCase()}
              </div>
              {position && (
                <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-white text-black rounded-full
                                text-[7px] font-bold flex items-center justify-center shadow-sm">
                  {position}
                </div>
              )}
            </div>

            {/* Name + Stack */}
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[10px] font-medium truncate max-w-[50px]">
                {player.name}
                {player.isAdmin && <span className="text-gold ml-0.5">*</span>}
              </span>
              <div className="flex items-center gap-0.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: chipColor.color }}
                />
                <span className="text-[10px] font-bold tabular-nums text-white/60">
                  {player.chips >= 1000
                    ? `${(player.chips / 1000).toFixed(player.chips % 1000 === 0 ? 0 : 1)}k`
                    : player.chips.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Current bet badge */}
            {player.currentBet > 0 && !isFolded && (
              <div className="text-[9px] font-bold tabular-nums text-gold bg-gold/15 px-1.5 py-0.5 rounded-full">
                {player.currentBet.toLocaleString()}
              </div>
            )}

            {/* Status badge */}
            {status && (
              <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${status.bg}`}>
                {status.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
