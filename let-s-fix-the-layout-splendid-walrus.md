# Fix Game Layout & Reimagine Player Avatars

## Context

The Full-mode game screen has two visible problems (see user screenshot):

1. **Opponent floats above the table.** The 2-player opponent avatar sits roughly at the top edge of the viewport — well above the green oval rim. This is because [getSeatPositions](client/src/screens/GameScreen.tsx#L20-L33) uses `cy=42, ry=34`, which places the top seat at `y ≈ 8%`, while the table oval container only starts at `top: 5%`. The avatar (48px) plus its bet pill ends up *outside* the felt.
2. **Game elements feel spread apart.** The vertical span between top opponent (~8%) and bottom seat (~76%) is huge, and the center pot/community cards are anchored at `top-[38%]` rather than true center, leaving uneven whitespace.

Player avatars across both modes are also weak: [PlayerSeat.tsx:42](client/src/components/PlayerSeat.tsx#L42) uses `bg-white/20` (80% transparent) on green felt, and [OpponentBand.tsx:69-71](client/src/components/OpponentBand.tsx#L69-L71) uses `bg-white/15` (chip-only mode). Initials are barely legible against the felt.

**Goal:** tighten the Full-mode table so all elements sit inside a compact oval, and give every avatar (both modes) a solid, bold treatment with strong contrast.

## Changes

### 1. Tighten the Full-mode table — [GameScreen.tsx](client/src/screens/GameScreen.tsx)

**[getSeatPositions](client/src/screens/GameScreen.tsx#L20-L33)** — shrink the seat ellipse and re-center:
```ts
const cx = 50, cy = 50;   // true center (was cy=42)
const rx = 38, ry = 28;   // tighter (was rx=42, ry=34)
```
Result for 2 players: opponent y ≈ 22%, current y ≈ 78%. Both clearly inside the oval rim.

**Table oval container ([line 572-574](client/src/screens/GameScreen.tsx#L572-L574))** — shrink to match the new seat ellipse:
```tsx
style={{ top: '10%', bottom: '10%', left: '4%', right: '4%' }}
```
(Was `top: 5%, bottom: 15%`.) Now the rim sits ~10% from top, opponent at 22% has clear margin, and bottom seat at 78% has comfortable room before the rim ends at 90%.

**Center pot/cards block ([line 589](client/src/screens/GameScreen.tsx#L589))** — anchor at true center:
```tsx
<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ...">
```
(Was `top-[38%]`.) Pot now sits between the two seats instead of biased up.

**Last-action banner ([line 597](client/src/screens/GameScreen.tsx#L597))** — bump up slightly so it doesn't crowd the bottom rim: change `bottom-[18%]` → `bottom-[12%]`.

### 2. New avatar style — single bold treatment

A small reusable shape, applied at every avatar site:
- **Base:** `bg-slate-800` (solid dark navy — #1e293b), `text-white`, font-extrabold.
- **Border:** `border-2 border-white/30` for a clear outline against the felt.
- **Shadow:** `shadow-lg shadow-black/40` to lift it off the table.
- **Current player:** keep `bg-gold text-black border-gold` (gold fill = "you").
- **Active turn:** existing `active-glow` / `ring-pulse` animations preserved.
- **Folded:** keep `opacity-40` (drop the `bg-white/10` override since the new base already reads as faded under low opacity).

**Files to update — same className swap in all four spots:**

| File | Line(s) | What |
|---|---|---|
| [PlayerSeat.tsx](client/src/components/PlayerSeat.tsx#L38-L47) | 38–47 | Full-mode table avatars |
| [OpponentBand.tsx](client/src/components/OpponentBand.tsx#L69-L71) | 69–71 | Chip-only opponent strip |
| [GameScreen.tsx](client/src/screens/GameScreen.tsx#L283-L286) | 283–286 | Chip-only "My info bar" avatar |
| [GameScreen.tsx](client/src/screens/GameScreen.tsx#L405-L408) | 405–408 | Hand-complete winner-selection list |

Concretely, the non-current/non-folded avatar in PlayerSeat becomes:
```tsx
<div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold
  border-2 shadow-lg shadow-black/40
  ${isCurrentPlayer
    ? 'bg-gold text-black border-gold'
    : 'bg-slate-800 text-white border-white/30'
  }
  ${player.isFolded ? 'opacity-40' : ''}`}
>
```
Smaller avatars (chip-only, w-7 h-7) use `text-xs font-bold border` (1px) with the same color rule for proportional treatment.

## Files Modified

- [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) — ellipse math, oval inset, pot center anchor, two avatar swaps (chip-only my-info-bar + hand-complete list), last-action banner offset.
- [client/src/components/PlayerSeat.tsx](client/src/components/PlayerSeat.tsx) — Full-mode avatar.
- [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) — Chip-only opponent strip avatar.

No new components, no constants/config changes.

## Verification

1. `npm run dev` (or whatever the workspace uses — check root `package.json`) and open two browser windows on the same room code in Full mode.
2. **Layout check:** confirm the opponent avatar sits clearly inside the oval rim (not overlapping the top edge), pot+community cards sit between the two seats, and the bottom seat has breathing room above the rim.
3. **3+ player check:** Add a third seat (open a third tab) and confirm the side seats (left/right at y≈50%) still sit inside the oval — `rx=38` keeps them at x=12%/88% which is well inside the new `left: 4%, right: 4%` container.
4. **Avatar check (Full mode):** every seat's initial circle is solid dark navy with a visible white border and shadow; current player is gold; folded player visibly dimmed; active player still glows.
5. **Avatar check (Chip-only mode):** switch room to chip-only and confirm the opponent strip avatars and the "my info bar" avatar use the same bold treatment, scaled down.
6. **Hand-complete check:** finish a hand and confirm winner-selection list rows show the new avatar style.
