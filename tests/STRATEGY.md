# Test Strategy & Storyline

This document maps the LazyPoker user journey to a test plan, then lays
out the pyramid we use to keep each layer honest.

## 1. The two storylines

LazyPoker has two modes that share a lobby and split at the start of a
hand. Each mode is its own user journey.

### 1A. Full mode — "the app is the dealer"

> Three friends sit around a table with no physical cards. The app
> deals to each player, runs the betting rounds, evaluates hands, and
> awards the pot.

```
   Home → Create/Join → Lobby (pick seat, configure)
        ↓
   START_HAND → blinds posted → cards dealt
        ↓
   PRE_FLOP betting (each player FOLD/CHECK/CALL/RAISE/ALL_IN)
        ↓
   FLOP (3 community cards) → betting
        ↓
   TURN (4th card) → betting
        ↓
   RIVER (5th card) → betting
        ↓
   SHOWDOWN → engine evaluates hands → awards pot → HAND_COMPLETE
        ↓
   Admin clicks "Next hand" → loop
        ↓
   Admin clicks "End game" → summary screen → home
```

Critical invariants:

- Chips are conserved: total chips at end == total chips at start.
- Each player only sees their own hole cards until showdown.
- After showdown, non-folded players' cards are revealed.
- Side pots are correctly split when stack sizes differ.
- Hand-evaluator picks the best 5-card hand among 7 available.

### 1B. Chip-only mode — "the app is just the banker"

> Three friends sit around a table with real cards. The app tracks
> chips, runs the betting rounds, and lets the banker manually declare
> the winner since no one trusts the engine to read physical cards.

```
   Home → Create/Join → Lobby (chip-only)
        ↓
   START_HAND → blinds posted (no cards dealt)
        ↓
   PRE_FLOP betting → server pauses
        ↓
   Admin clicks NEXT_ROUND → FLOP betting → server pauses
        ↓
   ... TURN, RIVER ...
        ↓
   HAND_COMPLETE with pot intact → admin DECLARE_WINNER
        ↓
   Pot awarded → Admin starts next hand
```

Critical invariants:

- No hole cards are ever dealt or stored.
- The server **pauses** between streets so the banker can deal
  physical cards before the next round starts.
- Pot is **never auto-awarded** — admin (or any player if
  `allowPlayersAwardPot` is on) must call DECLARE_WINNER.
- Cannot start a new hand while the previous pot is unawarded.

## 2. User stories → test categories

| User story | Category | Key scenarios |
|---|---|---|
| "I can host a game and invite friends." | Lobby | host creates room and is admin; second player joins; bad room code rejected |
| "Only the host can change settings." | Lobby | admin configures blinds; non-admin cannot configure |
| "Players pick their seat at the table." | Lobby | seat selection + collision rejection |
| "We need at least two people to start." | Lobby | start blocked with one player |
| "We play a hand of poker." | FullMode | happy path through showdown; pot awarded |
| "Folding to a raise is fast." | FullMode | fold-out hand; raise/re-raise/call |
| "Short stacks shouldn't break the pot." | FullMode | side-pot when one player is short |
| "Don't let me check when there's a bet." | FullMode | invalid CHECK rejected |
| "We have real cards — just track chips." | ChipOnly | no hole cards dealt |
| "Pause between streets so I can deal." | ChipOnly | NEXT_ROUND advance |
| "I'll tell the app who won." | ChipOnly | DECLARE_WINNER awards pot |
| "Don't deal another hand until pot is paid out." | ChipOnly | START_HAND blocked while pot >0 |
| "Anyone can declare the winner if banker is busy." | ChipOnly | allowPlayersAwardPot flag |
| "I refreshed by accident — let me back in." | Reconnect | reconnect with stored playerId |
| "I want to leave and join a different game." | LeaveGame | LEAVE_GAME removes player + emits summary |
| "When the host ends the game, take us home." | EndGame | END_GAME deletes room + emits summary to all |
| "A full house should beat a flush." | HandEvaluator | full-house > flush + every other ranking |
| "Aces play low in the wheel." | HandEvaluator | A-2-3-4-5 is a 5-high straight |

## 3. The test pyramid

```
                        ┌──────────────────┐
                        │  Manual UI checks│  (ITERATION.md)
                        ├──────────────────┤
                        │  E2E socket flow │  ← bulk of this suite
                        ├──────────────────┤
                        │  Engine actions  │  ← engine import-direct
                        ├──────────────────┤
                        │  Hand evaluator  │  ← pure functions
                        └──────────────────┘
```

- **Hand evaluator** — pure functions, no I/O. Unit tests in
  `scenarios/hand-evaluator.ts` validate every hand ranking and every
  ordering relationship. The bug "Full house should have won" lives
  here; this is the regression target.
- **Engine actions** — the `processAction` reducer is exercised
  indirectly through socket-driven scenarios. We don't test it
  directly because we want to catch wiring issues between the engine
  and the socket layer at the same time.
- **E2E socket flow** — most scenarios drive a real Socket.IO server
  end-to-end with multiple clients. This is where we catch issues
  like the non-admin END_GAME exploit (engine refused but socket
  handler still broadcast).
- **Manual UI checks** — anything visual or device-specific. Tracked
  in `ITERATION.md` with a manual checklist for each release.

## 4. Risk model — what's most likely to break

Sorted by historical likelihood (informed by `features.md` bug list and
recent commit messages):

1. **Hand evaluation rules** — the full-house regression test exists
   precisely because of a real report. Any change to
   `hand-evaluator.ts` should run `npm run test:eval` first.
2. **Pot accounting under all-ins** — side-pot math is the trickiest
   part of the engine. Always run `npm run test:full`.
3. **Phase transitions in chip-only** — the betting-round-not-waiting
   bug already shipped once. The chip-only checkdown scenario covers
   the regression.
4. **Reconnect / stale session** — refresh on mobile + room cleanup
   after END_GAME. Covered by `Reconnect` and `EndGame` categories.
5. **Permission checks** — admin-only actions. The non-admin END_GAME
   finding is open at time of writing.

## 5. Coverage target

| Layer | Goal | Where |
|---|---|---|
| Hand evaluator rankings | 100% | `hand-evaluator.ts` scenarios |
| Player actions (FOLD/CHECK/CALL/RAISE/ALL_IN) | 100% happy path + 1 invalid each | `full-mode.ts` |
| Admin actions (START_HAND, NEXT_ROUND, DECLARE_WINNER, END_GAME, ADD/REMOVE_CHIPS, KICK, SET_DEALER) | 100% happy path + admin gate | spread across categories |
| Phase transitions | each transition exercised at least once per mode | `full-mode.ts` + `chip-only.ts` |
| Reconnect paths | mid-lobby + mid-hand + after-end-game | `reconnect.ts` |
| Edge cases (heads-up, max players, kick) | one each | `edge-cases.ts` |

## 6. Out of scope (intentionally)

- **Visual rendering** — pixel-level UI checks. Use `npm run dev` and
  the manual checklist in `ITERATION.md`.
- **Mobile-specific behavior** — viewport, touch, browser cache. The
  "stuck on waiting for next hand on mobile" bug from features.md is
  partially server-tested (handNumber increments cleanly, see
  `regression.ts` BUG[1]) but the visual stuck-state needs a phone.
- **Performance / load** — many concurrent rooms, throughput. Add a
  separate suite if/when needed.
- **Auth & rate limiting** — none currently in the app; add when added.
