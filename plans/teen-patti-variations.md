# Teen Patti Variations — Per-Hand, Dealer-Picked

## Context

Teen Patti players love variation rounds — the same 3-card deck supports very different games (lowball, wild cards, closest-to-999, etc.) and rotating between them keeps a session lively. Today the variant is fixed at room creation and immutable; we want the next dealer to pick a variation just for their hand so the table can naturally cycle through different rules without leaving the room.

v1 ships four variations: Classic (default), Muflis (lowball), AK47 (A/K/4/7 wild), 999 (closest to 999). Joker and Best-of-Four are explicitly out of scope (they require new card-count rendering and per-player wild tracking).

UX shape (locked with user):

- Picker is inline above "Deal Next Hand" — only the next dealer sees it; one tap to switch, second tap to deal.
- During the hand, the top chip currently reading "TEEN PATTI" is replaced by the active variation name, with a (?) info icon next to it that opens a rules sheet for everyone at the table.

## Architecture overview

Two pieces of state flow per hand:

| Field | Lifecycle | Set by | Used by |
| --- | --- | --- | --- |
| `state.nextHandVariation` | Set by next dealer between hands; cleared at deal time | `SET_NEXT_VARIATION` action | UI picker |
| `state.currentVariation` | Snapshotted at deal; immutable for the hand | `startTeenPattiHand` | Evaluator dispatch + header chip + info sheet |

Hand evaluation routes through a single dispatcher (`evaluateTeenPattiHandFor(cards, variation)`); each variation reshapes its `rankValue`/`kickers` so the existing `compareTeenPattiHands` comparator stays untouched. This means showdown, sideshow, and forced-show flows need only a 1-line change at each call site.

## Server changes

### 1. Types — `common/types.ts`

```ts
export type TeenPattiVariation = 'classic' | 'muflis' | 'ak47' | '999';
```

- Add `nextHandVariation?: TeenPattiVariation` and `currentVariation?: TeenPattiVariation` to `GameState` (near the existing `teenPatti?: TeenPattiConfig` field around line 84–118).
- Extend `PlayerAction` union with `{ type: 'SET_NEXT_VARIATION'; variation: TeenPattiVariation }`.
- Add optional descriptive fields on `HandResult` (so renderers can introspect without re-evaluating):
  - `wildSubstitutions?: { cardIndex: number; usedAs: number }[]` — AK47
  - `chosenDigits?: number[]` — 999

### 2. Evaluator — `server/teen-patti-evaluator.ts`

Single dispatcher + four implementations. Keep `evaluateTeenPattiHand` as a thin alias for backward compat.

```ts
export function evaluateTeenPattiHandFor(
  cards: [Card, Card, Card],
  variation: TeenPattiVariation = 'classic',
): HandResult
```

- **`evaluateClassic`** — current `evaluateTeenPattiHand` body, renamed.
- **`evaluateMuflis`** — call `evaluateClassic` to identify the structural rank, then reshape the result into inverted bands so the comparator's "higher rankValue wins" rule still selects the Muflis winner. Rationale: a sign-flipped comparator forces every caller to know which evaluator was used and breaks the "best at top of sorted array" invariant. Reshape mapping (best to worst in Muflis):
  - `high-card-tp` → 600
  - `pair-tp` → 500 + (15 - pairValue)
  - `color` → 400
  - `sequence` → 300 + (15 - seqScore)
  - `pure-sequence` → 200 + (15 - seqScore)
  - `trail` → 100 + (15 - trailValue)

  Within-class kickers stored as `15 - k` so the existing comparator picks the lower card. A-2-3 still detected structurally; the sequence band itself sits below high-card. Description appended `" (Muflis)"`.

- **`evaluateAK47`** — wild ranks `{A, K, 4, 7}`. Brute-force enumerate substitutions (≤ 13³ = 2197 combos for at most 3 wilds; trivial). For each combo build a synthetic `[Card, Card, Card]` preserving real suits, call `evaluateClassic`, take the comparator-best. Append `wildCount` (inverted as `3 - wildCount`) as a tail kicker so natural beats wild at the same rank — e.g. natural Trail of 5s (kickers `[5, 3]`) beats wild Trail of 5s built from 5+A+K (kickers `[5, 1]`). All-wild best is Trail of Aces (kickers `[14, 0]`). Populates `wildSubstitutions`. Suits unchanged → color/pure-sequence still work because a wild K♥ stays a heart.

- **`evaluate999`** — map A=1, 2..9=face, 10/J/Q/K=0. Sort digits descending (always optimal — proof: 999 is the max, and digits-descending maximises the resulting number, which monotonically reduces distance from 999 across `[000..999]`). Reshape:
  - `rankValue = 1000 - distance` (1..1000; closer wins)
  - `kickers = digitsDescending` (natural same-distance tiebreak)
  - `chosenDigits` populated. Description e.g. `"9-9-7 → 997 (off by 2)"`, perfect 999 special-cased.

### 3. Action handler & deal-time snapshot — `server/game-engine.ts`

- **`SET_NEXT_VARIATION` handler** — alongside the existing action switch at `game-engine.ts:534`. Validate: `state.variant === 'teen-patti'`, phase is `HAND_COMPLETE` or `WAITING`, and `playerId === getNextTeenPattiDealerId(state)` (the same predicate already used to gate the Deal button). Set `state.nextHandVariation = action.variation`.
- **Snapshot at deal** — in `startTeenPattiHand()` `game-engine.ts:960`:
  ```ts
  s.currentVariation = s.nextHandVariation ?? 'classic';
  s.nextHandVariation = undefined;
  ```
- **Three call-site swaps** — replace `evaluateTeenPattiHand(cards)` with `evaluateTeenPattiHandFor(cards, state.currentVariation ?? 'classic')` at:
  - Sideshow comparator (`game-engine.ts` ~lines 1218–1220, both player evaluations)
  - Showdown ranker (`game-engine.ts` ~line 1326, the `eligible.map(...)`)
  - Forced pot-limit show flows through `resolveTeenPattiShowdown`, so it inherits the showdown change.

### 4. Socket plumbing — `common/types.ts:170`

`SET_NEXT_VARIATION` rides the existing `'action'` socket event (see `ClientToServerEvents`); no new socket event needed. Server reducer threads it through `gameManager.processAction()` like every other action.

## Client changes

### 5. Inline picker — `client/src/screens/GameScreen.tsx`

Two render sites for the Teen Patti "Deal Next Hand" button (the rest of the existing dealer-only gating logic at `GameScreen.tsx:752–760` and `game-engine.ts:548` already restricts who sees this):

- Mobile/Teen Patti layout: `GameScreen.tsx:1047–1055`
- Desktop/Teen Patti layout: search for the parallel block (the `isWide ? ... : ...` switch in the same file)

Insert a new `<VariationPicker />` component immediately above the Deal button. Visible only when `isNextDealer && phase === 'HAND_COMPLETE'`. Uses the existing shadcn Select pattern — see `client/src/components/ui/select.tsx` and the lobby's existing dropdown styling at `client/src/screens/LobbyScreen.tsx:147–231` (`bg-felt-rim/60 brass-hairline`, etc.) — so no new visual language. On change, emit:

```ts
socket.emit('action', { roomCode, playerId, action: { type: 'SET_NEXT_VARIATION', variation } });
```

Reads selected value from `state.nextHandVariation ?? 'classic'`. Default of "Classic" feels intentional, not unset.

### 6. Header chip + info icon — `client/src/screens/GameScreen.tsx`

The "TEEN PATTI" label in the top header (search for the literal string at line ~1 of the layout block):

- When `state.currentVariation` is set and is not `'classic'`, render the variation name (e.g. `"MUFLIS"`) instead. Optional Classic suffix only if it adds clarity — for v1, keep it minimal: just the variation name.
- Append a small (?) icon button next to the chip. Tapping opens a `VariationInfoSheet` (right-side `Sheet`, mirroring `client/src/components/AdminPanel.tsx:65–69`) that displays the rules for `state.currentVariation`. Visible to every player, not just the dealer.

### 7. New components

- **`client/src/components/VariationPicker.tsx`** — Select-based dropdown listing the four variations with one-line descriptions. Disabled if not the next dealer or `phase != HAND_COMPLETE`.
- **`client/src/components/VariationInfoSheet.tsx`** — pulls rule text from a shared metadata module (next item) and renders it inside a Sheet. Reused by both the in-hand (?) and (optionally) inside the picker dropdown items.

### 8. Shared metadata — `common/teen-patti-variations.ts` (new)

```ts
export const TEEN_PATTI_VARIATIONS: Record<TeenPattiVariation, {
  id: TeenPattiVariation;
  label: string;            // "Muflis (Lowball)"
  shortLabel: string;       // "MUFLIS" — used in header chip
  tagline: string;          // "Lowest hand wins" — one-liner for the picker
  rules: string[];          // bullet list shown in the info sheet
}>
```

Living in `common/` so both client (UI labels, info sheet) and server (description prefixes if needed) consume the same source of truth.

### 9. Showdown description rendering

`HandResult.description` already flows into `HandSummary.winners[].handDescription` and is rendered by the existing winner banner. AK47 and 999 produce richer description strings inside the evaluator (e.g. `"K♥ used as 5 — Trail of 5s"`, `"9-9-7 → 997 (off by 2)"`) so no client rendering change is required for v1 to display variation-flavored showdown text.

Optional polish (low priority — defer unless quick): structurally render `wildSubstitutions` as a card-border highlight on the wild cards in the showdown reveal. Skip for v1.

## Edge cases (verified during evaluator design)

- **Sideshow under any variation** — comparator unchanged, so sideshow correctly uses the active variation's rules.
- **AK47 all-wild** — Trail of Aces with `kickers = [14, 0]`; loses tiebreak to a natural Trail of Aces.
- **AK47 + color/pure-sequence** — wilds keep their real suit (the suit doesn't substitute), so flushes still evaluate correctly.
- **Muflis pair-tp tiebreak** — `kickers = [15 - pairValue, 15 - kicker]` makes lower pair win, then lower kicker.
- **Muflis A-2-3** — still detected as a sequence structurally; the sequence band lands below high-card per Muflis rules.
- **999 ordering** — always digits-descending after substitution; provably optimal.
- **999 sideshow** — works; distance-based `rankValue` is comparable, ties break on chosen digits.
- **Picker race condition** — if the dealer changes the picker between dealing and the action arriving, the snapshot at `startTeenPattiHand` resolves the ambiguity (last value at deal-time wins).

## Critical files

**Modify:**

- `common/types.ts` — variation enum, `GameState` fields, action variant, optional `HandResult` fields
- `server/teen-patti-evaluator.ts` — dispatcher + four evaluators
- `server/game-engine.ts` — `SET_NEXT_VARIATION` handler, snapshot in `startTeenPattiHand`, three call-site swaps
- `client/src/screens/GameScreen.tsx` — picker insertion (two render sites), header chip swap, info icon

**Create:**

- `common/teen-patti-variations.ts` — shared metadata
- `client/src/components/VariationPicker.tsx`
- `client/src/components/VariationInfoSheet.tsx`

**Reuse (no changes needed):**

- `client/src/components/ui/select.tsx` — picker styling
- `client/src/components/ui/sheet.tsx` — info sheet
- `compareTeenPattiHands` in `server/teen-patti-evaluator.ts` — untouched thanks to reshape strategy

## Verification

**Unit/script-level (server):**

Add a focused test (or quick node harness) for `evaluateTeenPattiHandFor` covering, per variation:

- **Classic regression** — confirm reshape didn't change Classic results.
- **Muflis**: 2-2-2 (worst) vs 5-3-2 mixed (strong); pair-of-2s vs pair-of-Ks (low pair wins); A-2-3 vs A-K-Q sequences in Muflis ordering.
- **AK47**: natural Trail of 5s beats wild Trail of 5s; all-wild produces Trail of Aces; flush detection with wild K♥.
- **999**: 9-9-9 perfect; K-Q-J = 000 distance 999; tied distance broken by chosen digits.

**Manual end-to-end (mobile + desktop):**

- `npm run dev` (or whatever the repo uses — check `package.json`), open two browsers (mobile viewport + desktop), join the same Teen Patti room.
- Confirm the variation picker appears only above the next dealer's Deal button on both layouts.
- Pick Muflis, deal, confirm the header chip reads "MUFLIS" for both players, and tapping (?) opens the rules sheet on each.
- Play one hand each of all four variations; verify the winner is correct and the showdown description matches the variation (e.g. `"9-9-7 → 997 (off by 2)"` for 999).
- Trigger a sideshow under Muflis; confirm the lower hand wins.
- Trigger a forced pot-limit show; confirm it uses the active variation.
- Refresh mid-hand on one client; confirm `currentVariation` survives (it's part of `GameState` so the existing reconnect path covers it for free).

## Sequencing for implementation

1. Types + variation metadata module (`common/`).
2. Evaluator dispatcher + four implementations + script-level checks for each.
3. Server: `SET_NEXT_VARIATION` handler + `startTeenPattiHand` snapshot + three call-site swaps.
4. Client: `VariationPicker` + `VariationInfoSheet`.
5. Wire the picker above both Deal Next Hand render sites; swap the header chip + info icon.
6. End-to-end manual verification across mobile and desktop layouts.
