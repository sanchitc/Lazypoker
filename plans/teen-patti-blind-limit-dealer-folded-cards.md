# Teen Patti — Blind limit, dealer-clicks-deal, folded card visuals

## Context

Three changes to the Teen Patti variant only — Texas Hold'em flow stays untouched.

1. **Blind limit**: Players currently can stay blind indefinitely while paying 1× stake on chaal/raise. Add a lobby-configurable cap (1, 2, 3, 4, or No Limit). When a player completes their Nth blind action, the server forces `hasSeenCards = true` so the rest of the hand proceeds in seen mode (2× stake) for them.
2. **Dealer clicks "Deal Next Hand"**: Today only the admin sees the Deal Next Hand button at hand end. In Teen Patti, the user wants the *next dealer* (clockwise rotation, current behavior preserved) to click. Admin retains a force-deal fallback in the existing Banker Panel — already wired (`AdminPanel.tsx:76-85`), no new admin code needed.
3. **Folded player visual**: When a player packs in Teen Patti, their card slot disappears entirely from opponents' screens (server already nulls `holeCards` mid-hand). The user wants three grayed-out face-down placeholder cards instead so the player is visibly "in seat but folded". Real cards stay hidden until they tap **Show Cards** at HAND_COMPLETE — `wantsToShowCards` plumbing already works ([game-engine.ts:894-906](server/game-engine.ts#L894-L906)).

Also: the user asked plans live in the project's `/plans/` folder (not `~/.claude/plans/`) and that this preference go into a `CLAUDE.md`.

---

## Repo conventions to set first (one-shot, before feature work)

- **Move this plan**: copy the final plan file to [plans/](plans/) inside the repo, naming it something like `teen-patti-blind-limit-dealer-folded-cards.md`. Keep the global file too — the user is moving the convention forward, not retroactively deleting.
- **Create [CLAUDE.md](CLAUDE.md)** at the repo root with one short note: *"When writing plan files (e.g. via plan mode), save them under `plans/` in this repo, not under `~/.claude/plans/`."*

---

## Feature 1 — Blind limit

### Types & defaults

[common/types.ts](common/types.ts):

- Add to `Player` (after `hasSeenCards?` at line 29):
  ```ts
  // Teen Patti: count of blind chaal/raise actions taken this hand. Used
  // to enforce blindLimit; reset per hand. Boot does NOT count.
  blindActionCount?: number;
  ```
- Add to `TeenPattiConfig` (line 62-70):
  ```ts
  // Maximum number of blind chaal/raise actions a player may take before
  // being forced into seen mode. 0 = no limit.
  blindLimit: number;
  ```
- Add to `GameConfig` (line 173-185): `blindLimit?: number;`

[common/constants.ts](common/constants.ts) `DEFAULT_TEEN_PATTI_CONFIG` (line 32-36): add `blindLimit: 0` (default = no limit, preserves existing behavior).

### Server

[server/game-engine.ts](server/game-engine.ts):

- `startTeenPattiHand` (line 950-1011): in the per-player reset loop at line 962-971, add `p.blindActionCount = 0;`.
- `tpChaal` (line 1048-1080): right after the cost check at line 1055, branch on `!player.hasSeenCards` to compute the post-action blind count and decide whether to flip seen:
  ```ts
  const isBlind = !player.hasSeenCards;
  const limit = state.teenPatti?.blindLimit ?? 0;
  const newBlindCount = isBlind ? (player.blindActionCount ?? 0) + 1 : (player.blindActionCount ?? 0);
  const forceSeenAfter = isBlind && limit > 0 && newBlindCount >= limit;
  ```
  Apply `blindActionCount: newBlindCount` and `hasSeenCards: forceSeenAfter ? true : p.hasSeenCards` inside the player-map at line 1059-1067.
- `tpRaise` (line 1082-1122): mirror the same logic right after the cost calc at line 1093-1095. Same shape.
- **Do not touch `tpSeeCards` and do not touch sideshow/show paths** — sideshow already requires `hasSeenCards`, and `CALL_SHOW`'s blind/seen cost is independent of the count.

The auto-flip happens *after* the action that hits the limit. The player's next turn finds `hasSeenCards = true`, costs are 2×, and `filterStateForPlayer` (line 894 `ownCanSee = !isTeenPatti || !!p.hasSeenCards`) starts revealing their hole cards on the next broadcast. That matches the user's "After the Nth blind play" choice.

### Server config plumbing

[server/game-manager.ts](server/game-manager.ts) `configure` (line 110-148): add to the Teen Patti block at line 139-145:
```ts
if (config.blindLimit !== undefined) tp.blindLimit = config.blindLimit;
```

### Lobby UI

[client/src/screens/LobbyScreen.tsx](client/src/screens/LobbyScreen.tsx) — insert a new dropdown in the Teen Patti settings block (between Chaal Limit at line 170-187 and Pot Limit at line 191-208). Pattern matches the existing Selects:

```tsx
<Separator />
<div className="flex items-center justify-between gap-3">
  <span className="text-xs uppercase tracking-[0.18em] text-bone-dim">Blind Limit</span>
  <Select
    value={String(gameState.teenPatti.blindLimit ?? 0)}
    onValueChange={(v) => handleConfigure('blindLimit', parseInt(v))}
  >
    <SelectTrigger className="w-32 h-9 text-sm font-mono"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="0" className="font-mono">No limit</SelectItem>
      {[1, 2, 3, 4].map(v => (
        <SelectItem key={v} value={String(v)} className="font-mono">{v}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### Optional: in-game blind-count badge

In [client/src/components/TeenPattiActionBar.tsx](client/src/components/TeenPattiActionBar.tsx), if `blindLimit > 0` and the local player is blind, show a subtle "Blind 1/2" indicator near the See Cards button so the player knows they're approaching the cap. Nice-to-have; skip if it complicates layout.

---

## Feature 2 — Dealer clicks "Deal Next Hand" (Teen Patti only)

**Dealer rotation logic stays unchanged**: `rotateDealerButton` ([game-engine.ts:135-159](server/game-engine.ts#L135-L159)) already picks the next active seat clockwise and is called inside `startTeenPattiHand` at line 973. `getActivePlayers` filters out left/sitting-out players, so drop-offs are graceful by construction.

### Client — predict next dealer at HAND_COMPLETE

[client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) around the Teen Patti hand-complete UI (line 990-1023):

Add a small helper near the top of the Teen Patti layout component (or import from a new `client/src/lib/teen-patti.ts`) that mirrors the server's clockwise pick:

```ts
function getNextTeenPattiDealerId(gameState: GameState): string | null {
  if (gameState.variant !== 'teen-patti') return null;
  const active = gameState.players
    .filter(p => p.seatIndex >= 0 && !p.isSittingOut)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  if (active.length === 0) return null;
  const next = active.find(p => p.seatIndex > gameState.dealerSeatIndex);
  return (next ?? active[0]).id;
}
```

Note: this filter matches `getActivePlayers` ([game-engine.ts:916-920](server/game-engine.ts#L916-L920)) restricted to what's relevant *between* hands (`isFolded` is reset at the next deal, so it's not a useful filter here — and including it would wrongly skip whoever just packed). The server filter happens to also include `!isFolded`, but at HAND_COMPLETE the folded flags from the prior hand would skew the prediction; folded flags get cleared inside `startTeenPattiHand` at line 965 *before* `rotateDealerButton` runs at line 973. So we mirror the post-reset state here (omit `isFolded`).

Replace the gating at line 998 from `isAdmin ?` to:
```tsx
const nextDealerId = getNextTeenPattiDealerId(gameState);
const nextDealer = gameState.players.find(p => p.id === nextDealerId);
const isMyDealNextHand = nextDealerId === playerId;
```
- If `isMyDealNextHand`: render the existing `<Button variant="raise"…>Deal Next Hand</Button>`.
- Else: render `<div>Waiting for {nextDealer?.name ?? 'dealer'}…</div>`.

**Poker** layout (line 990 is inside the Teen Patti branch already — Poker has its own hand-complete UI elsewhere in the file): leave untouched. Per the user, Poker behavior stays as-is.

### Admin force-deal fallback

Already exists: [AdminPanel.tsx:76-85](client/src/components/AdminPanel.tsx#L76-L85) renders `Deal New Hand` for admin during HAND_COMPLETE/SETUP/WAITING. No new code. Just verify this surfaces in Teen Patti too — quick check: `isHandComplete` is set on line 48 of AdminPanel using the same `HAND_COMPLETE` phase that Teen Patti uses, so it works automatically.

---

## Feature 3 — Folded player visuals (translucent face-down)

Server already does the right thing: folded players' `holeCards` are nulled in opponents' filtered state at all phases except when `wantsToShowCards` flips at HAND_COMPLETE ([game-engine.ts:894-906](server/game-engine.ts#L894-L906)). Pure client work.

### OpponentBand

[client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) line 136-142 currently renders cards only when `player.holeCards` is present, so folded opponents' card row vanishes. Replace with:

```tsx
{player.isFolded && gameState.variant === 'teen-patti' ? (
  <div className="flex gap-0.5 opacity-30">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i} card={null} faceDown size="sm" />
    ))}
  </div>
) : player.holeCards ? (
  <div className="flex gap-0.5">
    {player.holeCards.map((card, i) => (
      <Card key={i} card={card} size="sm" />
    ))}
  </div>
) : null}
```

The wrapper at line 79-86 already applies `opacity-35` to the whole bubble for folded players — the extra `opacity-30` on the card row stacks with that to push the cards visibly further back. Adjust the constant if it reads too dark in practice.

Cards become visible again automatically when the folded player taps Show Cards (server flips visibility, `player.holeCards` becomes non-null, the second branch fires).

### PlayerSeat (desktop layout)

[client/src/components/PlayerSeat.tsx](client/src/components/PlayerSeat.tsx) line 108-121: similar restructure — when `player.isFolded` and Teen Patti, render `cardCount` face-down cards with extra opacity. The existing `statusClass = 'opacity-40'` (line 35-39) already greys the whole seat; the inner card layer just needs to render rather than disappear.

```tsx
{showCards && player.holeCards && (
  <div className="flex gap-0.5 mt-1">
    {player.holeCards.map((card, i) => <Card key={i} card={card} size="sm" />)}
  </div>
)}
{showCards && !player.holeCards && !isCurrentPlayer && (
  <div className={`flex gap-0.5 mt-1 ${player.isFolded ? 'opacity-50' : ''}`}>
    {Array.from({ length: cardCount }).map((_, i) => (
      <Card key={i} card={null} faceDown size="sm" />
    ))}
  </div>
)}
```

The change vs current: drop `&& !player.isFolded` from the face-down branch (line 115) so folded players get a face-down placeholder, and add the dimming class. Keep the variant-agnostic shape — `cardCount` is already passed in as 3 for Teen Patti, 2 for Poker, so this works for both. (For Poker, the wrapper opacity of 0.4 already conveys folded; the extra row matches Teen Patti's behavior — minor visual change but consistent.)

If we want to scope strictly to Teen Patti, gate the new branch on a `variant === 'teen-patti'` prop. Recommended: keep it variant-agnostic for symmetry — folded Poker players showing two grayed card backs is a reasonable cosmetic improvement, not a regression.

### Self bottom bar (folded local player)

[client/src/screens/GameScreen.tsx:716-722](client/src/screens/GameScreen.tsx#L716-L722) currently hides the local player's cards entirely when folded. For consistency, render face-down placeholders here too:

```tsx
{currentPlayer.holeCards && !currentPlayer.isFolded && (
  <div className="flex shrink-0 gap-1">
    {currentPlayer.holeCards.map((card, i) => <Card key={i} card={card} size="md" />)}
  </div>
)}
{currentPlayer.isFolded && (
  <div className="flex shrink-0 gap-1 opacity-50">
    {Array.from({ length: gameState.variant === 'teen-patti' ? 3 : 2 }).map((_, i) => (
      <Card key={i} card={null} faceDown size="md" />
    ))}
  </div>
)}
```

---

## Files to modify

- [common/types.ts](common/types.ts) — `Player.blindActionCount`, `TeenPattiConfig.blindLimit`, `GameConfig.blindLimit`.
- [common/constants.ts](common/constants.ts) — `DEFAULT_TEEN_PATTI_CONFIG.blindLimit = 0`.
- [server/game-engine.ts](server/game-engine.ts) — reset `blindActionCount` in `startTeenPattiHand`; increment + auto-flip in `tpChaal` and `tpRaise`.
- [server/game-manager.ts](server/game-manager.ts) — pass `blindLimit` through `configure`.
- [client/src/screens/LobbyScreen.tsx](client/src/screens/LobbyScreen.tsx) — Blind Limit dropdown in Teen Patti config.
- [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) — `getNextTeenPattiDealerId` helper; gate Deal Next Hand by next dealer; folded self-bar placeholder.
- [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) — translucent face-down for folded Teen Patti opponents.
- [client/src/components/PlayerSeat.tsx](client/src/components/PlayerSeat.tsx) — translucent face-down for folded players (desktop layout).
- New: [CLAUDE.md](CLAUDE.md) at repo root — plans-folder convention.
- This plan, copied to [plans/](plans/).

No DB or migration changes needed.

---

## Verification

### Build & types
- `npm run build` — types must pass with the new `Player.blindActionCount` and `TeenPattiConfig.blindLimit` fields.
- `npm test` (if a test command exists for `tests/scenarios/teen-patti.ts`) — existing tests should still pass; consider adding one scenario where blindLimit=2 and the third chaal pays 2× automatically.

### End-to-end (three browser tabs A, B, C)

**Feature 1 — Blind limit:**
1. In lobby, admin sets Blind Limit = 2. Start a Teen Patti hand.
2. A is blind. A taps Bet (Blind) once — pays 1× stake. blindActionCount = 1.
3. After the table loops back, A taps Bet again — pays 1× stake. blindActionCount = 2 = limit, so the server flips A's `hasSeenCards = true`.
4. On A's next turn: A's hole cards are now visible to A, the action button label switches to "Chaal" with 2× cost, and the SEEN badge replaces BLIND on B & C's screens.
5. Repeat with limit = "No limit" — confirm A can stay blind indefinitely.
6. Boot does not count: open a fresh hand and confirm `blindActionCount` is 0 even though boot was charged.

**Feature 2 — Dealer clicks Deal Next Hand:**
1. Three-player hand. After it ends, identify the player to the left of the current dealer (clockwise next seat).
2. Confirm only that player sees the **Deal Next Hand** button. Other two see "Waiting for [name]…".
3. The dealer clicks; a new hand starts and the dealer button moves to them.
4. Edge: have the prospective next dealer leave the game while in HAND_COMPLETE. Confirm the button reassigns gracefully to the next clockwise active player.
5. Admin opens the Banker Panel and uses **Deal New Hand** as the force-deal backup — confirm it still works regardless of who's the predicted dealer.
6. **Poker regression**: in a Poker hand, confirm the Deal Next Hand UX is unchanged (admin still clicks).

**Feature 3 — Folded card visuals:**
1. Three-player hand. B packs.
2. On A's and C's screens: B's card area now shows three face-down cards at reduced opacity, instead of vanishing.
3. On B's own screen (self bar): three face-down translucent cards.
4. Hand reaches showdown / single-survivor. Confirm B's cards are still hidden by default.
5. B taps **Show Cards** — A and C now see B's real three cards, face-up. B taps **Hide Cards** — back to translucent face-down. Toggle is instant.
6. Next hand begins — the placeholder is gone (B is back to blind/seen normally).
7. **Poker regression**: in Poker, fold a player. Confirm two face-down translucent cards render in their slot — visual consistency, no functional regression.

### Repo convention
- Confirm [CLAUDE.md](CLAUDE.md) exists with the plans-folder note.
- Confirm a copy of this plan lives under [plans/](plans/) alongside the existing `fix-teen-patti-bugs.md`.
