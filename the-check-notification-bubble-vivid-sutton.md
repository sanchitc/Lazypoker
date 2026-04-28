# Per-Seat Action Notifications (Full Mode)

## Context

In Full-mode, the only "what just happened" indicator is a single low-contrast pill rendered at the bottom of the table area in [GameScreen.tsx:596-603](client/src/screens/GameScreen.tsx#L596-L603):

```tsx
<div className="absolute bottom-[12%] left-1/2 -translate-x-1/2
                bg-black/50 px-3 py-1 rounded-full text-xs text-white/70 ...">
  {playerName}: {action}
</div>
```

Two problems with this approach (both visible in the user's screenshot):

1. **Low visibility.** `bg-black/50 text-white/70` over the green felt (`#1a6b37`) reads as a vague gray smudge — barely legible at a glance.
2. **Obstructs mini hole-cards.** A center-anchored banner sits exactly where the opponent's mini hole-cards render. With 2 players, the bubble lands on the cards every hand.

The deeper issue is that "who did what" is communicated by **one global label** at a fixed felt position. Players have to read the text and parse the name to know who just acted. Real poker UIs (PokerStars, ClubGG) attach a bright, color-coded chip **next to the actor's seat** — you see action and actor in one glance, with no central obstruction.

Chip-only mode already does this — see the colored TURN/CHECK/CALL/RAISE badges in [OpponentBand.tsx:23-39](client/src/components/OpponentBand.tsx#L23-L39). Full mode never inherited that vocabulary.

**Goal:** Replace the central banner with per-seat action chips that pop above the actor's avatar, are color-coded by action type, and auto-fade after a short window.

## Behavior

- When `gameState.lastAction` changes (new playerId / action / amount), the **actor's seat** shows a colored chip floating above their avatar.
- Chip auto-clears after **2,500 ms** — long enough to read, short enough not to clutter.
- A new action before the timer expires immediately replaces the previous chip on the new actor.
- One chip on the table at a time (matches poker's natural turn order).
- The server clears `lastAction = null` on `START_HAND` ([game-engine.ts:472](server/game-engine.ts#L472)), so chips disappear cleanly between hands — no client-side cleanup needed.

## Action → chip mapping

Felt is `#1a6b37`. Each chip uses a saturated, high-contrast hue. Reuse OpponentBand's color vocab where it fits:

| Action string | Label | Bg / text | Notes |
|---|---|---|---|
| `fold` | `FOLD` | `bg-red-500 text-white` | red = "out" |
| `check` | `CHECK` | `bg-white text-slate-900` | bright neutral against felt |
| `call` (+ amount) | `CALL 200` | `bg-emerald-500 text-white` | green = continue/flat |
| `raise` (+ amount) | `RAISE 500` | `bg-gold text-black` | gold = aggression (matches OpponentBand line 34) |
| `bet` (+ amount) | `BET 500` | `bg-gold text-black` | same family as raise |
| `all-in` (+ amount) | `ALL IN 1,200` | `bg-yellow-400 text-black animate-pulse` | yellow + pulse = max attention |
| `wins …` | (skip) | — | hand-complete UI already covers this |

Shared chip classes:
```
px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide whitespace-nowrap
shadow-lg shadow-black/50 border border-black/20 animate-scale-pop
```
Border + shadow lift it off the felt. `animate-scale-pop` is already defined in [index.css:133-140](client/src/index.css#L133-L140) — punchy entry without inventing new keyframes.

## Position on the seat

PlayerSeat stacks elements vertically: bet pill (`-top-1 -translate-y-full`), then avatar, then name, then stack, then cards. The action chip sits **above the bet pill** so the two coexist:

```tsx
<div className="absolute left-1/2 -translate-x-1/2 -top-8 -translate-y-full
                px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide
                whitespace-nowrap shadow-lg shadow-black/50 border border-black/20
                animate-scale-pop ${chipColors}">
  {chipLabel}
</div>
```

This keeps the chip clear of: dealer-button (top-right of avatar), bet pill (directly above avatar), name/stack/cards (below avatar), and the table center (community cards / pot). No more overlap with mini hole-cards.

For bottom seat (y≈78%) and side seats (y≈50%), this offset stays inside the felt because the seat ellipse already has comfortable margin (felt rim at 10%/90%, seats at 22%/78%/50%).

## Changes

### 1. Remove the central last-action banner — [GameScreen.tsx](client/src/screens/GameScreen.tsx)

Delete [lines 596-603](client/src/screens/GameScreen.tsx#L596-L603) inside `FullModeLayout`:

```tsx
// DELETE this entire block
{gameState.lastAction && (
  <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2
                  bg-black/50 px-3 py-1 rounded-full text-xs text-white/70 animate-fade-in">
    {gameState.players.find(p => p.id === gameState.lastAction!.playerId)?.name}:{' '}
    {gameState.lastAction.action}
    {gameState.lastAction.amount !== undefined && ` ${gameState.lastAction.amount.toLocaleString()}`}
  </div>
)}
```

### 2. Track recent actor — [GameScreen.tsx](client/src/screens/GameScreen.tsx) `FullModeLayout`

Add state + effect alongside the existing turn-timer hooks (around [line 480-525](client/src/screens/GameScreen.tsx#L480-L525)):

```tsx
const [recentActorId, setRecentActorId] = useState<string | null>(null);
const lastActionKey = gameState?.lastAction
  ? `${gameState.lastAction.playerId}|${gameState.lastAction.action}|${gameState.lastAction.amount ?? ''}`
  : null;
useEffect(() => {
  if (!gameState?.lastAction) { setRecentActorId(null); return; }
  setRecentActorId(gameState.lastAction.playerId);
  const t = setTimeout(() => setRecentActorId(null), 2500);
  return () => clearTimeout(t);
}, [lastActionKey]);
```

Then pass `actionBadge` to PlayerSeat in the render loop ([lines 577-586](client/src/screens/GameScreen.tsx#L577-L586)):

```tsx
<PlayerSeat
  key={player.id}
  player={player}
  isActive={gameState.players[gameState.activePlayerIndex]?.id === player.id}
  isCurrentPlayer={player.id === playerId}
  showCards={showCards}
  position={positions[i] || { x: 50, y: 50 }}
  actionBadge={
    recentActorId === player.id && gameState.lastAction
      ? gameState.lastAction
      : null
  }
/>
```

### 3. Render the chip — [PlayerSeat.tsx](client/src/components/PlayerSeat.tsx)

Extend `PlayerSeatProps`:

```tsx
interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isCurrentPlayer: boolean;
  showCards: boolean;
  position: { x: number; y: number };
  actionBadge?: { action: string; amount?: number } | null;
}
```

Add a local helper (uses `.includes()` because the server emits lowercase strings — verified at [server/game-engine.ts:504,526,559,599,631](server/game-engine.ts)):

```tsx
function getActionChipStyle(action: string, amount?: number): { label: string; classes: string } | null {
  const a = action.toLowerCase();
  const amt = amount !== undefined ? ` ${amount.toLocaleString()}` : '';
  if (a.includes('fold'))   return { label: 'FOLD',           classes: 'bg-red-500 text-white' };
  if (a.includes('check'))  return { label: 'CHECK',          classes: 'bg-white text-slate-900' };
  if (a.includes('call'))   return { label: `CALL${amt}`,     classes: 'bg-emerald-500 text-white' };
  if (a.includes('raise'))  return { label: `RAISE${amt}`,    classes: 'bg-gold text-black' };
  if (a.includes('bet'))    return { label: `BET${amt}`,      classes: 'bg-gold text-black' };
  if (a.includes('all-in')) return { label: `ALL IN${amt}`,   classes: 'bg-yellow-400 text-black animate-pulse' };
  return null; // 'wins …' and unknown strings: no chip
}
```

Render inside the seat container, above the bet pill (alongside [PlayerSeat.tsx:29-35](client/src/components/PlayerSeat.tsx#L29-L35)):

```tsx
{actionBadge && (() => {
  const style = getActionChipStyle(actionBadge.action, actionBadge.amount);
  if (!style) return null;
  return (
    <div className={`absolute left-1/2 -translate-x-1/2 -top-8 -translate-y-full
                     px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide
                     whitespace-nowrap shadow-lg shadow-black/50 border border-black/20
                     animate-scale-pop z-10 ${style.classes}`}>
      {style.label}
    </div>
  );
})()}
```

`z-10` keeps the chip above neighboring seats' cards if seats are tightly packed.

## Files Modified

- [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) — remove central banner, add `recentActorId` state + effect, pass `actionBadge` prop.
- [client/src/components/PlayerSeat.tsx](client/src/components/PlayerSeat.tsx) — add `actionBadge` prop, `getActionChipStyle` helper, render chip.

No new components. No changes to types, server, or chip-only mode.

## Scope decisions

- **Full-mode only.** Chip-only mode's OpponentBand already has good action badges.
- **Both opponents and self.** Symmetric — your own CHECK/RAISE pops above your avatar too. Confirms submission.
- **No history ticker / log.** One chip at a time mirrors poker's reality. Future addition if wanted.
- **No chip-throw animation for bets/raises.** Future polish; out of scope.

## Verification

1. `npm run dev` from project root; open two browser windows on the same Full-mode room.
2. **Each action type:** trigger fold / check / call / raise / all-in from each window. Confirm:
   - The colored chip appears above the actor's avatar (not as a central banner).
   - Color and label match the table above.
   - Amount appears for call / raise / bet / all-in.
   - Chip fades after ~2.5 s.
   - A new action on the other player immediately replaces the chip on the new actor.
3. **No overlap:** confirm the chip never sits on top of community cards, pot, dealer button, bet pill, or any seat's mini hole-cards. Test with 2, 3, and 4 seated players (3+ exercises the side seats at y≈50%).
4. **Hand boundary:** finish a hand → start next hand → confirm no stale chip carries over.
5. **Self-action:** submit CHECK as current player; confirm the chip pops above your own avatar at the bottom of the table and is fully inside the felt.
6. **Chip-only regression check:** switch a room to chip-only and confirm OpponentBand status badges still work (this path is untouched).
