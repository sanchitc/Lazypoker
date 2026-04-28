# LazyPoker — End-to-End Test Suite

A self-contained E2E test project for LazyPoker that drives the **real**
server (Express + Socket.IO + GameManager + game-engine) in-process and
simulates multiple browser-style clients via `socket.io-client`. The same
code paths used in production are exercised by the tests.

The suite covers both gameplay modes:

- **Full mode** — server deals cards and evaluates hands at showdown.
- **Chip-only mode** — server only tracks chips; admin/banker manually
  declares the winner each hand.

It produces a Markdown report (`tests/reports/REPORT.md`) summarizing
pass/fail counts and surfacing every failure as a triaged issue with
expected/actual values and a suggested fix.

## Quick start

```bash
npm install            # if you haven't already (uses existing deps only)
npm test               # run every scenario; writes tests/reports/REPORT.md
```

Filter by category:

```bash
npm run test:lobby
npm run test:full
npm run test:chip
npm run test:eval
npm run test:reconnect
npm run test:regression
```

Or grep by name:

```bash
npx tsx tests/runner.ts --grep "side pot"
```

The runner exits **non-zero** on any failure or scenario error, so it
plugs into CI directly.

## Layout

```
tests/
├── README.md             # this file — how to run + what's here
├── STRATEGY.md           # storyline & user journeys; the test pyramid
├── ITERATION.md          # how to use this suite across versions
├── ISSUES.md             # known issues, hand-curated triage view
├── reports/REPORT.md     # auto-generated on every run
├── runner.ts             # entrypoint
├── lib/
│   ├── harness.ts        # boots the real server in-process
│   ├── client.ts         # promise-friendly socket client (one per "tab")
│   ├── scenario.ts       # scenario runner + Ctx (issue/expect/note)
│   └── reporter.ts       # markdown writer + console output
└── scenarios/
    ├── lobby.ts          # create / join / configure / seat
    ├── full-mode.ts      # 3-player full-mode storyline
    ├── chip-only.ts      # banker-mode storyline
    ├── hand-evaluator.ts # poker-rule unit tests (incl. full-house bug)
    ├── reconnect.ts      # disconnect/reconnect/leave/end-game
    ├── regression.ts     # bugs called out in features.md
    └── edge-cases.ts     # heads-up, kick, max players, etc.
```

## How it works (in 60 seconds)

1. Each scenario starts a fresh `http.Server + socket.io.Server +
   GameManager` on port `0` (ephemeral). No global state leaks between
   scenarios.
2. Test "players" are real `socket.io-client` instances. They emit the
   same events the React app emits (`create`, `join`, `select-seat`,
   `configure`, `action`, `reconnect-player`).
3. Scenarios drive state forward and use `client.waitFor(predicate)` to
   synchronize against the broadcast loop.
4. The Ctx exposes `expect(...)` (soft assertion — records issue,
   keeps running) and `issue(...)` (record finding without an
   assertion). Multiple findings per scenario are surfaced.
5. The reporter writes a Markdown file with a summary, an issues
   section grouped by severity (critical/high/medium/low/info), and
   per-scenario detail tables.

## Why in-process (not subprocess + browser)

- Fast (typical run is <5s).
- Deterministic — no port conflicts, no flaky launch timing.
- Catches real bugs at the layer where they live (server logic).
- Same failure visible whether run on a laptop or in CI.

The tradeoff: client-only bugs (React rendering, mobile cache, layout)
are **out of scope** for this suite. Those are tracked as manual
checks in `ITERATION.md`.

## Adding a scenario

```ts
import { Scenario } from '../lib/scenario.js';

export const myScenarios: Scenario[] = [
  {
    name: 'descriptive sentence',
    category: 'MyArea',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      const { roomCode } = await host.create('full');
      // ... drive the flow ...
      ctx.expect(condition, 'what should be true', {
        severity: 'high',
        expected: 'X',
        actual: 'Y',
        fix: 'where to look',
      });
    },
  },
];
```

Then add `...myScenarios` to `runner.ts` and you're done.

## What success looks like

- `npm test` exits 0.
- `tests/reports/REPORT.md` shows 0 critical / 0 high issues.
- Each new feature ships with a scenario covering at least its happy
  path and one reasonable failure.
