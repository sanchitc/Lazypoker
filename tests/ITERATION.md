# Iteration Playbook

How to use this test suite *across versions of LazyPoker*. The goal is
catch regressions automatically and keep the manual surface small.

## The loop

```
   ┌──────────────────────────────────────────────────────────┐
   │ 1. Make a change (feature / bug-fix / refactor)          │
   │                                                          │
   │ 2. `npm test` — green is the gate                        │
   │                                                          │
   │ 3. If a test fails: read REPORT.md → fix root cause      │
   │                                                          │
   │ 4. If your change adds new behavior:                     │
   │    - Add a happy-path scenario                           │
   │    - Add at least one negative scenario (invalid input)  │
   │    - If you fixed a bug, add a regression scenario       │
   │                                                          │
   │ 5. Run the manual UI checklist (Section 4) before ship   │
   │                                                          │
   │ 6. Commit                                                │
   └──────────────────────────────────────────────────────────┘
```

## 1. When you change `server/hand-evaluator.ts`

> Highest blast radius — this owns who wins money.

Required:

```bash
npm run test:eval
npm run test:full       # exercises evaluator at showdown
```

Add a unit test for any new ranking edge case. The "full house beats
flush" scenario is a regression for an old bug — keep it green.

## 2. When you change `server/game-engine.ts`

Required:

```bash
npm test
```

Common pitfalls to look for:

- **Resetting state in START_HAND** — `isFolded`, `holeCards`,
  `currentBet`, `totalBetThisHand`, `pots`, `actedThisRound` all reset.
- **`isBettingRoundComplete`** — pre-flop BB option, all-in skipping,
  raise resetting `actedThisRound` to just the raiser.
- **Side pot math** — `calculateSidePots` is the easy place to break
  conservation. The all-in scenario asserts total chips conserved.

## 3. When you change `server/socket-handlers.ts`

> The non-admin END_GAME bug is in this file. Be careful.

Required:

```bash
npm run test:reconnect
npm run test:regression
```

Rule of thumb: never make broadcast/lifecycle decisions purely from
`data.action.type`. Inspect the engine's response first. Compare
`prevState.phase` vs `newState.phase` — if the phase didn't change to
`HAND_COMPLETE`, the END_GAME wasn't accepted.

## 4. Manual UI checklist (per release)

The automated suite covers server logic. These items need a real
browser and (where noted) a real phone:

| # | Check | Mode | Device |
|---|---|---|---|
| 1 | Create room → QR code shows correct LAN URL | Both | Desktop |
| 2 | Hole cards visible only to me, not opponents | Full | Desktop + Phone |
| 3 | Showdown reveals all non-folded cards | Full | Desktop |
| 4 | "Show cards" button appears at HAND_COMPLETE for losers | Full | Desktop |
| 5 | "Show cards" reveals when toggled | Full | Phone |
| 6 | Refresh tab → land back in same seat (reconnect) | Both | Desktop + Phone |
| 7 | "Leave game" returns to home screen | Both | Phone |
| 8 | Admin "End game" → all players land on summary screen | Both | Desktop + Phone |
| 9 | After "End game" + back-to-home, can join a new game | Both | Phone |
| 10 | Mobile: HAND_COMPLETE → Next hand renders without stuck state | Both | Phone |
| 11 | Turn timer counts down on the active player | Both | Desktop |
| 12 | Chip-only: "Award pot" appears at HAND_COMPLETE | Chip | Desktop |
| 13 | Chip-only: betting round waits for all checks before advancing | Chip | Desktop |

Items #4, #6, #8, #9, #10 directly track bugs called out in
`features.md`. If any of them regress, file an issue and add an
automated scenario for whatever portion is server-side reproducible.

## 5. Continuous integration

Add to your CI workflow:

```yaml
- run: npm ci
- run: npm run typecheck
- run: npm test
- if: failure()
  run: cat tests/reports/REPORT.md
```

The runner exits non-zero on failure and writes
`tests/reports/REPORT.md`. Surface that artifact on PRs and you'll
have a self-explaining failure mode.

## 6. Versioning the suite

The test suite ships in the same repo as the app. There is no separate
release. Conventions:

- **Don't delete a passing scenario** without a comment explaining
  why. The cost of a flaky test is high; the cost of a deleted-then-
  forgotten test is much higher.
- When the schema in `common/types.ts` changes, type errors will
  surface in the test suite immediately because everything imports
  from there. Treat type errors as a signal: maybe the change should
  be additive.
- If a scenario starts failing because of an *intentional* spec change,
  update the assertion in the same commit as the spec change. Don't
  comment-out tests "to deal with later."

## 7. When a new feature ships

Suggested template — add to the relevant scenario file:

```ts
{
  name: '[FEATURE] short description',
  category: 'FullMode' | 'ChipOnly' | 'Lobby' | ...,
  async fn(ctx) {
    // 1. Set up the minimum state for the feature to apply
    // 2. Drive the action that triggers the feature
    // 3. Assert observable effect (state field, broadcast, summary)
    // 4. Drive a negative case (wrong actor, wrong phase, wrong input)
    // 5. Assert the negative case is refused without side effects
  },
},
```

## 8. When a bug is reported

1. Write a failing scenario that reproduces it. **Commit it failing.**
2. Tag the scenario name with `BUG[N]:` so future readers can grep
   for it (see `regression.ts` for examples).
3. Fix the bug.
4. The same `npm test` run that proves your fix also proves you
   didn't regress anything else.

This pattern is how the "full house beats flush" regression test got
into the suite, and it's how every bug from `features.md` should be
absorbed.

## 9. Triage cadence

- After every release: read `tests/reports/REPORT.md` and check
  `tests/ISSUES.md` for anything still open.
- Once a quarter: clean up scenarios. Anything skipped via
  `skip: true` either gets fixed or deleted with rationale.
