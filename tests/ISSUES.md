# Known Issues — Curated Triage View

This file is **hand-curated**. The auto-generated `reports/REPORT.md`
is the source of truth for what failed in the latest run; this file
explains each finding, ranks it, and records the fix once shipped.

> When you fix something, move the entry from "Open" to "Resolved"
> with the commit SHA. Don't delete it.

## Open

### CRITICAL-1 — Non-admin can end the game and destroy the room

- **Surfaced by:** `tests/scenarios/reconnect.ts` →
  `non-admin cannot END_GAME (security)`
- **Where:** [server/socket-handlers.ts:86-94](../server/socket-handlers.ts#L86-L94)
- **Symptom:** Any connected non-admin client can emit
  `{ type: 'END_GAME' }` and the server will broadcast `game:ended` to
  the whole room and call `gameManager.deleteRoom(...)`. The engine
  itself refuses the action (`return state` unchanged in
  `processAction`'s END_GAME branch when `!player.isAdmin`), but the
  socket handler does not check that the engine actually transitioned.
- **Impact:** A trolling player can permanently kick everyone out of
  any room they're in and prevent reconnect (the room is deleted).
- **Reproduction:** `npm run test:reconnect`
- **Suggested fix:** In `socket-handlers.ts`, gate the END_GAME branch
  on the engine actually changing phase to `HAND_COMPLETE` *and* the
  caller being admin. One implementation:

  ```ts
  socket.on('action', (data) => {
    const prev = gameManager.getRoomState(data.roomCode);
    const player = prev?.players.find(p => p.id === data.playerId);
    // ... existing LEAVE_GAME branch ...

    const state = gameManager.processAction(data.roomCode, data.playerId, data.action);
    if (!state) {
      socket.emit('error', { message: 'Invalid action' });
      return;
    }
    broadcastState(data.roomCode);

    if (data.action.type === 'END_GAME' && player?.isAdmin) {
      const summary = gameManager.getGameSummary(data.roomCode);
      if (summary) {
        io.to(data.roomCode).emit('game:ended', { summary });
        gameManager.deleteRoom(data.roomCode);
      }
    }
  });
  ```

  Equivalent alternative: compare `prev.phase` vs `state.phase` — if
  the engine refused, phase will be unchanged for non-admins.

## Carried over from `features.md`

These were called out in `features.md` before this test suite existed.
Status reflects what the automated suite can currently observe.

### features.md BUG-1 — "Game gets stuck on waiting for next hand on mobile browser"

- **Server-side coverage:** ✅ green. `regression.ts → BUG[1]` confirms
  the engine cleanly resets between hands (`handNumber` increments,
  `isFolded` clears, fresh blinds posted).
- **Client-side reality:** UNVERIFIED. Likely a stale
  `localStorage` session or a missed re-render on `state:update`.
  Manual check #10 in `ITERATION.md` covers this for now.

### features.md BUG-2 — "Full house should have won the game"

- **Coverage:** ✅ green. `hand-evaluator.ts → full house beats flush`
  exercises the exact ranking. If this regresses, the suite catches
  it in <1ms.

### features.md BUG-3 — "When game ends, users cannot logout. Game is getting cached."

- **Server-side coverage:** ✅ green. `regression.ts → BUG[3]`
  confirms the room is deleted after admin END_GAME and stale
  reconnect attempts are rejected.
- **Client-side reality:** the React app already clears
  `localStorage.lazypoker_session` on `game:ended`
  ([client/src/context/GameContext.tsx:80](../client/src/context/GameContext.tsx#L80)).
  Should be fine; verify on a phone.

## Resolved

*(empty — populate as fixes ship)*

## How to add an entry here

1. Did `npm test` find a new issue?
2. Open a new section like `### CRITICAL-N — short title`.
3. Cite the scenario name and the file:line of the suspect code.
4. Describe symptom, impact, reproduction, suggested fix.
5. When fixed, move it to "Resolved" with commit SHA. Don't delete.
