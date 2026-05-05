# Two Teen Patti polish fixes: blind-bubble label + folded player sees own cards

## Context

Two small UX fixes:

1. **Blind chaal bubble.** In Teen Patti, a player who hasn't seen their cards
   plays "blind" (1× stake); once seen, they play "chaal" (2× stake). The
   action-bar button already reflects this — it reads "Blind" or "Chaal"
   depending on `hasSeenCards` (commit a3b20e1, [TeenPattiActionBar.tsx:223](client/src/components/TeenPattiActionBar.tsx#L223)).
   The bubble badge above the opponent's profile in `OpponentBand`, however,
   always reads **"CHAAL"** regardless of state. Make the bubble follow the
   same blind/seen distinction as the button so opponents can tell at a glance
   whether the cost was 1× or 2×.

2. **Folded player can't see their own cards.** When the local player packs
   (in either poker or Teen Patti), the client replaces their hole-card row
   with face-down placeholders (or hides it entirely). The server actually
   sends the real cards back to the player whenever they're entitled to see
   them (always in poker; in Teen Patti only after `SEE_CARDS`) — so the
   client is needlessly hiding information the player already had. The
   folded player should still see their own cards face-up, just grayed out
   to convey the folded state. If the cards were never seen (Teen Patti
   blind-pack), `holeCards` is `null` from the server, so face-down
   placeholders remain the correct fallback.

---

## Fix 1 — Blind chaal bubble

### Approach

The label is rendered from `gameState.lastAction.action` in
[OpponentBand.tsx:38-46](client/src/components/OpponentBand.tsx#L38-L46). The server
currently emits a single `'chaal'` action string for both blind and seen chaals
([game-engine.ts:1084](server/game-engine.ts#L1084)).

Encode the blind/seen distinction at the source by emitting a different action
string from the server — `'blind'` when `isBlind`, `'chaal'` when seen. This is
more accurate than reading `player.hasSeenCards` on the client, because the
`forceSeen` blind-limit mechanic flips `hasSeenCards` to `true` on the very
last blind chaal ([game-engine.ts:1077](server/game-engine.ts#L1077)) — relying on
the post-state would mislabel that boundary case.

Then add a `'blind'` branch to the `OpponentBand` Teen Patti label resolver
before the existing `'chaal'` branch.

Scope: limit this to the chaal action only, mirroring the action-bar button
precedent. The Raise button is labeled "Raise" regardless of blind/seen state,
so blind raises continue to render as "RAISE" in the bubble. Out of scope.

### Changes

**[server/game-engine.ts:1084](server/game-engine.ts#L1084)** — emit `'blind'`
when on blind, `'chaal'` when seen. The local `isBlind` already exists at
[line 1062](server/game-engine.ts#L1062).

```ts
// before
lastAction: { playerId: player.id, action: 'chaal', amount: cost },

// after
lastAction: { playerId: player.id, action: isBlind ? 'blind' : 'chaal', amount: cost },
```

**[client/src/components/OpponentBand.tsx:38-46](client/src/components/OpponentBand.tsx#L38-L46)** — add a `'blind'` branch before
the `'chaal'` branch in the Teen Patti label resolver. Use the `'muted'`
variant to match the persistent `BLIND` status badge ([line 46](client/src/components/OpponentBand.tsx#L46)).

```ts
if (gameState.lastAction?.playerId === player.id) {
  const action = gameState.lastAction.action.toLowerCase();
  if (action.includes('blind')) return { text: 'BLIND', variant: 'muted' };
  if (action.includes('chaal')) return { text: 'CHAAL', variant: 'ivy' };
  // … rest unchanged
}
```

Substring-collision check: the only other Teen Patti `lastAction` strings
(`'pack'`, `'see'`, `'raise'`, `'sideshow request'`, `'sideshow declined'`,
`'sideshow lost — packs'`, `'show'`, and the showdown `'wins X'`) don't
contain `'blind'`. The standard-poker branch ([lines 51-57](client/src/components/OpponentBand.tsx#L51-L57))
runs only when `variant !== 'teen-patti'`, so there's no collision with poker's
small/big blind concept.

---

## Fix 2 — Folded player sees own cards (grayed)

### Approach

Pure client change. The server already handles visibility correctly: in poker,
own `holeCards` are always sent; in Teen Patti, own `holeCards` are sent iff
`hasSeenCards` is true ([game-engine.ts:894-906](server/game-engine.ts#L894-L906)).
The client just needs to stop conditioning the face-up render on
`!currentPlayer.isFolded` and instead always render face-up when `holeCards`
is present, applying an opacity wrapper when folded. Face-down placeholders
remain the fallback for when `holeCards` is null (Teen Patti blind-pack).

There are five locations in [GameScreen.tsx](client/src/screens/GameScreen.tsx)
where the local player's cards are rendered. All five take the same shape:

```tsx
// generalized pattern
{currentPlayer.holeCards ? (
  <div className={`flex … ${currentPlayer.isFolded ? 'opacity-40' : ''}`}>
    {currentPlayer.holeCards.map((c, i) => <Card key={i} card={c} size="…" />)}
  </div>
) : !currentPlayer.isFolded ? (
  /* existing face-down placeholder branch (Teen Patti pre-See, etc.) */
) : (
  /* folded with no holeCards — face-down grayed fallback */
)}
```

Use `opacity-40` to match the existing folded-seat treatment in
[PlayerSeat.tsx:35-39](client/src/components/PlayerSeat.tsx#L35-L39) (`statusClass = 'opacity-40'`)
for visual consistency.

### Changes

**[client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx)** — five spots:

1. **Poker wide self-row** ([line 576-581](client/src/screens/GameScreen.tsx#L576-L581)): drop the
   `&& !currentPlayer.isFolded` gate. Wrap the cards `div` in
   `opacity-40` when folded.
2. **Poker `SelfBar` (mobile)** ([line 726-739](client/src/screens/GameScreen.tsx#L726-L739)):
   currently shows face-down placeholders when folded. Change so that when
   folded AND `holeCards` is present, render the real cards with `opacity-40`;
   when folded AND `holeCards` is null, keep face-down placeholders.
3. **Teen Patti wide self-row** ([line 947-964](client/src/screens/GameScreen.tsx#L947-L964)):
   currently renders nothing when folded. Add a folded branch that renders
   `holeCards` face-up with `opacity-40` when present, otherwise three
   face-down placeholders with `opacity-40`.
4. **Teen Patti mobile center self area** ([line 991-1009](client/src/screens/GameScreen.tsx#L991-L1009)):
   same change as #3.
5. The Teen Patti `MobileSelfBar` reuses the `SelfBar` component from #2,
   passing `cardCount={3}` — fixed automatically by #2.

A small helper local to the file would tighten this:

```tsx
function SelfHoleCards({
  player, cardCount, size,
}: { player: Player; cardCount: number; size: 'sm' | 'md' | 'lg' }) {
  const dim = player.isFolded ? 'opacity-40' : '';
  if (player.holeCards) {
    return (
      <div className={`flex gap-1 ${dim}`}>
        {player.holeCards.map((c, i) => <Card key={i} card={c} size={size} />)}
      </div>
    );
  }
  if (player.isFolded) {
    return (
      <div className={`flex gap-1 ${dim}`}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <Card key={i} card={null} faceDown size={size} />
        ))}
      </div>
    );
  }
  return null; // pre-See blind state — caller renders the See button row
}
```

Caveat: the Teen Patti self-rows (#3, #4) wrap the pre-See face-down placeholders
together with a "See" button. Keep that branch outside the helper — only swap
the *folded* and *cards-visible* branches, leaving the pre-See branch
intact. So the call sites become:

```tsx
{currentPlayer.holeCards ? (
  <SelfHoleCards player={currentPlayer} cardCount={3} size="md" />
) : !currentPlayer.isFolded ? (
  /* existing pre-See face-down + See button */
) : (
  <SelfHoleCards player={currentPlayer} cardCount={3} size="md" />
)}
```

If the helper feels heavy for a single file, inline the conditional at each
site — there are only 5 spots, the logic is short, and inlining keeps the
diff small. Recommended: **inline**.

---

## Files to modify

- [server/game-engine.ts](server/game-engine.ts) — Fix 1, line 1084.
- [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) — Fix 1, lines 38-46.
- [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) — Fix 2,
  five spots: 576-581, 726-739, 947-964, 991-1009, plus reuse via `MobileSelfBar`.

No type, server-protocol, DB, or migration changes for Fix 2. Fix 1 changes
the action-string vocabulary only — no shape change to `lastAction`.

---

## Verification

### Fix 1 — Blind bubble

1. Start a Teen Patti hand with 2+ players.
2. As the active player, **don't** tap See — play a chaal while still blind.
   Expected on opponents' screens: bubble in the OpponentBand reads "BLIND"
   (muted variant), not "CHAAL".
3. Tap See, then chaal again. Expected: bubble reads "CHAAL" (ivy variant).
4. Edge — set `blindLimit = 4` in lobby. On the 4th blind chaal, the player
   is force-flipped to seen. Expected: that 4th action's bubble still reads
   "BLIND" (the action emitted *was* a blind chaal); the persistent SEEN/BLIND
   status badge becomes SEEN starting from their next turn.
5. Confirm the action-bar button label ("Blind" / "Chaal") is unchanged.

### Fix 2 — Folded player sees own cards

1. **Poker** — start a hand, fold. On both wide and mobile layouts, the local
   player's two hole cards stay visible face-up but grayed out (~40% opacity).
   Other players continue to see face-down backs (no leak — server filters
   them out for opponents).
2. **Teen Patti seen → fold** — see cards, then pack. Three real cards
   visible face-up grayed in both wide and mobile self-areas.
3. **Teen Patti blind → fold** — pack without seeing. `holeCards` is `null`,
   so the fallback renders three face-down cards with `opacity-40` —
   communicates the folded state without leaking unseen cards.
4. Hand ends — confirm the existing Show Cards / Hide Cards control still
   toggles opponents' visibility independently of the local view.
5. Next hand starts — the grayed cards clear, fresh hand renders normally.

---

## Post-approval housekeeping

Per repo convention ([CLAUDE.md](CLAUDE.md)), copy this finalized plan from
`~/.claude/plans/` into [plans/](plans/) at the repo root so it's versioned
with the codebase.
