import { Player, GameState } from '@common/types';
import { CHIP_COLORS } from '@common/constants';
import { Badge } from '@/components/ui/badge';
import Card from './Card';

interface OpponentBandProps {
  opponents: Player[];
  gameState: GameState;
  currentPlayerId: string;
  layout?: 'row' | 'col';
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

// Status pip color encodes: active turn / seen / blind / packed / all-in.
// Pip is the primary signal in the compact band; textual badges are dropped.
function getStatusPip(player: Player, gameState: GameState): { color: string; ring: string } {
  const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;
  if (player.isFolded) return { color: 'hsl(var(--ember))', ring: 'ring-ember/40' };
  if (player.isAllIn) return { color: 'hsl(var(--brass))', ring: 'ring-brass/40' };
  if (isActing) return { color: 'hsl(var(--brass))', ring: 'ring-brass/60' };
  if (gameState.variant === 'teen-patti') {
    return player.hasSeenCards
      ? { color: 'hsl(var(--brass))', ring: 'ring-brass/30' }
      : { color: 'hsl(var(--bone-dim))', ring: 'ring-bone/20' };
  }
  return { color: 'hsl(var(--ivy))', ring: 'ring-ivy/30' };
}

// Hold'em-style action label only (Teen Patti drops per-seat action chips).
function getHoldemActionBadge(player: Player, gameState: GameState):
  | { text: string; variant: 'brass' | 'ember' | 'ivy' | 'muted' }
  | null {
  if (player.isFolded) return { text: 'FOLD', variant: 'muted' };
  if (player.isAllIn) return { text: 'ALL IN', variant: 'brass' };
  const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;
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

function formatChips(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

interface OpponentBubbleProps {
  player: Player;
  gameState: GameState;
  isTeenPatti: boolean;
  layout: 'row' | 'col';
}

function OpponentBubble({ player, gameState, isTeenPatti, layout }: OpponentBubbleProps) {
  const isActing = gameState.players[gameState.activePlayerIndex]?.id === player.id;
  const pip = getStatusPip(player, gameState);
  const position = getPositionBadge(player, gameState);
  const isFolded = player.isFolded;
  const chipColor = CHIP_COLORS.reduce(
    (best, chip) => (player.chips >= chip.value ? chip : best),
    CHIP_COLORS[0]
  );
  const holdemBadge = !isTeenPatti ? getHoldemActionBadge(player, gameState) : null;

  const avatar = (
    <div className="relative flex-shrink-0">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-bold shadow-md shadow-ink/40
          ${isActing
            ? 'border-brass/45 bg-gradient-to-b from-felt-rim to-panel-strong text-bone'
            : 'border-bone/10 bg-gradient-to-b from-panel-soft to-panel-strong text-bone'}`}
      >
        {player.name[0].toUpperCase()}
      </div>
      <div
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-ink/60`}
        style={{ backgroundColor: pip.color }}
        aria-hidden
      />
      {position && (
        <div className="absolute -top-1.5 -left-1.5">
          <Badge variant="brass" className="px-1 py-0 text-[9px] h-4 tracking-tight">
            {position}
          </Badge>
        </div>
      )}
    </div>
  );

  const cards = player.holeCards ? (
    <div className="flex gap-0.5">
      {player.holeCards.map((card, i) => (
        <Card key={i} card={card} size="sm" />
      ))}
    </div>
  ) : isFolded && isTeenPatti ? (
    <div className="flex gap-0.5 opacity-40">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} card={null} faceDown size="sm" />
      ))}
    </div>
  ) : null;

  const bet =
    player.currentBet > 0 && !isFolded ? (
      <div className="rounded-full border border-brass/22 bg-brass/10 px-1.5 py-0.5 text-[11px] font-mono font-bold tabular-nums text-brass">
        {formatChips(player.currentBet)}
      </div>
    ) : null;

  if (layout === 'col') {
    // Vertical-stack row: avatar on left, name/chips/bet to its right, cards below.
    return (
      <div
        className={`flex w-full items-start gap-2 rounded-2xl px-2 py-1.5 transition-all duration-200
          ${isFolded ? 'opacity-40' : ''}
          ${isActing ? 'surface-panel ring-1 ring-brass/30 ring-pulse' : 'surface-panel-soft'}`}
      >
        {avatar}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-bone">
              {player.name}
              {player.isAdmin && <span className="text-brass ml-0.5">*</span>}
            </span>
            {bet}
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-bone/20"
              style={{ backgroundColor: chipColor.color }}
            />
            <span className="text-[11.5px] font-mono font-semibold tabular-nums text-bone-dim">
              {formatChips(player.chips)}
            </span>
            {holdemBadge && (
              <Badge variant={holdemBadge.variant} className="ml-auto text-[9px] tracking-tight">
                {holdemBadge.text}
              </Badge>
            )}
          </div>
          {cards && <div className="mt-0.5">{cards}</div>}
        </div>
      </div>
    );
  }

  // Horizontal compact strip bubble: avatar + name+chips column + cards below.
  return (
    <div className={`flex flex-shrink-0 flex-col items-center gap-1.5 ${isFolded ? 'opacity-40' : ''}`}>
      <div
        className={`flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5
          transition-all duration-200
          ${isActing
            ? 'surface-panel ring-1 ring-brass/30 ring-pulse shadow-[0_0_18px_-8px_hsl(var(--brass)/0.55)]'
            : 'surface-panel-soft'}`}
      >
        {avatar}
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="max-w-[88px] truncate text-[12px] font-medium text-bone">
            {player.name}
            {player.isAdmin && <span className="text-brass ml-0.5">*</span>}
          </span>
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 border border-bone/20"
              style={{ backgroundColor: chipColor.color }}
            />
            <span className="text-[11.5px] font-mono font-semibold tabular-nums text-bone-dim">
              {formatChips(player.chips)}
            </span>
          </div>
        </div>
        {bet}
        {holdemBadge && (
          <Badge variant={holdemBadge.variant} className="text-[9px] tracking-tight">
            {holdemBadge.text}
          </Badge>
        )}
      </div>
      {cards}
    </div>
  );
}

export default function OpponentBand({
  opponents,
  gameState,
  currentPlayerId: _currentPlayerId,
  layout = 'row',
}: OpponentBandProps) {
  if (opponents.length === 0) return null;
  const isTeenPatti = gameState.variant === 'teen-patti';

  if (layout === 'col') {
    return (
      <div className="flex h-full flex-col gap-1.5 overflow-y-auto px-2 py-2 scrollbar-hide">
        {opponents.map(player => (
          <OpponentBubble
            key={player.id}
            player={player}
            gameState={gameState}
            isTeenPatti={isTeenPatti}
            layout="col"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-2 overflow-x-auto px-3 py-2 scrollbar-hide bg-ink/24 backdrop-blur-sm brass-hairline-b">
      {opponents.map(player => (
        <OpponentBubble
          key={player.id}
          player={player}
          gameState={gameState}
          isTeenPatti={isTeenPatti}
          layout="row"
        />
      ))}
    </div>
  );
}
