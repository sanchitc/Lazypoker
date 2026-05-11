# Bug 1 — Show player's own wallet balance during Teen Patti gameplay (mobile)

## Context

On the mobile Teen Patti UI (both portrait and landscape), the current player has no visible indicator of their own chip balance during a hand. Opponents show their balance ("Nuj · 1.7k") in their seat bubbles, and the desktop layout shows the player's own `ChipStack` pill below their hole cards ([GameScreen.tsx:1333-1335](../client/src/screens/GameScreen.tsx#L1333-L1335)) — but the mobile felt pane simply omits this. The Hold'em mobile layout already solves this with `MobileSelfBar` ([GameScreen.tsx:676-745](../client/src/screens/GameScreen.tsx#L676-L745)); Teen Patti mobile is the only mode missing it.

This change adds a persistent balance pill anchored to the player's side of the felt (bottom, where the hole cards already sit) so the user always knows their stack — mid-hand, between hands, and at showdown.

## Approach

Add a compact `ChipStack` pill inside the mobile Teen Patti `TablePane`, positioned in the felt's bottom content column right after the hole cards. This:

- Mirrors the desktop pattern exactly (same `ChipStack` primitive, same pill chrome) so visual language stays consistent.
- Lives inside `TablePane`, which is rendered in both phone-portrait and phone-landscape (and persists across active play AND `HAND_COMPLETE`), giving a single insertion point that fixes both viewports.
- Sits next to the player's hole cards, which is the natural "player's side" anchor on mobile.
- Reuses an already-imported component — no new files, no new primitives.

## Files to modify

- **[client/src/screens/GameScreen.tsx](../client/src/screens/GameScreen.tsx)** — only file touched.

## Change detail

Inside `TablePane` ([GameScreen.tsx:1079-1191](../client/src/screens/GameScreen.tsx#L1079)), in the inner felt-content column ([GameScreen.tsx:1113-1189](../client/src/screens/GameScreen.tsx#L1113-L1189)), insert a small chip pill **after** the hole-cards block (currently ending at [line 1176](../client/src/screens/GameScreen.tsx#L1176)) and **before** the action-log block ([line 1178](../client/src/screens/GameScreen.tsx#L1178)).

Markup (matching the desktop pill at [GameScreen.tsx:1333-1335](../client/src/screens/GameScreen.tsx#L1333) but a touch denser for phone):

```tsx
<div className="rounded-full border border-bone/10 bg-panel-strong/55 px-3 py-1">
  <ChipStack amount={currentPlayer.chips} size="sm" />
</div>
```

Notes:
- Use `size="sm"` instead of desktop's `"md"` so the pill stays compact on phones.
- Render unconditionally — the user always has chips, even at `HAND_COMPLETE`. The whole point of the bug is to make this persistent.
- No `formatChips` truncation needed — `ChipStack` already renders a tabular numeric label and chip icons.

## What is intentionally NOT changed

- Desktop layout — already correct ([GameScreen.tsx:1333-1335](../client/src/screens/GameScreen.tsx#L1333)).
- Hold'em / non-Teen-Patti modes — already correct via `MobileSelfBar`.
- `OpponentBand`, `FeltSeat`, `TeenPattiActionBar`, `StatusStrip` — out of scope; the chosen insertion point is the smallest local edit that resolves the bug.
- Bug 2 (POT 0 after round), Bug 3 (Deal Next Hand freeze), and the variation-change notification feature — separate issues, not in this plan.

## Verification

1. Start the app: `bun run dev` (or whatever the repo's dev script is — check `package.json`).
2. Open the client in a mobile-sized viewport (Chrome DevTools device toolbar, e.g. iPhone 14 Pro 393×852, then also test landscape 852×393).
3. Create/join a Teen Patti room with at least 2 players.
4. **Portrait, mid-hand**: confirm a chip pill showing your balance is visible just below your hole cards, above the action log/action bar.
5. **Portrait, hand-complete**: after a winner is announced, confirm the pill is still visible (and that your balance has updated to reflect any winnings/losses).
6. **Landscape**: rotate (or resize) and confirm the same pill appears in the center felt column, below your hole cards.
7. **Desktop regression**: resize wide (≥ desktop breakpoint per `useLayoutMode`) and confirm the existing desktop pill is unchanged (not duplicated).
8. **Chip movement**: place a Chaal/raise; confirm the displayed balance decreases live (since `currentPlayer.chips` is reactive via `useGame()`).
