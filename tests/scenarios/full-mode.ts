/**
 * Full mode storyline:
 * lobby → seat → start hand → blinds posted → betting rounds across
 * pre-flop / flop / turn / river → showdown → winner gets pot.
 *
 * Each scenario uses 3 players unless otherwise noted, because heads-up
 * (2 players) has special blind/seating rules worth covering separately.
 */
import { Scenario } from '../lib/scenario.js';
import { flush } from '../lib/client.js';
import type { GameState } from '../../common/types.js';

async function setup3PlayerFull(ctx: any) {
  const a = await ctx.client('Alice');
  const b = await ctx.client('Bob');
  const c = await ctx.client('Carol');
  const { roomCode } = await a.create('full');
  await b.join(roomCode);
  await c.join(roomCode);
  await c.waitFor((s: GameState) => s.players.length === 3);

  // Standardize blinds for predictable arithmetic
  a.configure({ smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  await a.waitFor((s: GameState) => s.smallBlind === 10 && s.bigBlind === 20);

  a.selectSeat(0);
  b.selectSeat(1);
  c.selectSeat(2);
  await a.waitFor(
    (s: GameState) => s.players.every((p) => p.seatIndex >= 0),
    1000,
    'all seated'
  );
  return { a, b, c };
}

/** Find the player whose turn it is. */
function activePlayer(s: GameState) {
  return s.players[s.activePlayerIndex];
}

/** Convenience: have whichever client is current player perform `act`. */
async function actCurrent(clients: any[], act: (c: any) => void, label = 'action') {
  // Pick client by activePlayerIndex on the most recent state any client has
  const ref = clients.find((c) => c.state) || clients[0];
  const s = ref.state!;
  const ap = activePlayer(s);
  if (!ap) throw new Error(`no active player at ${label}`);
  const target = clients.find((c) => c.playerId === ap.id);
  if (!target) throw new Error(`no client matches active player ${ap.name}`);
  act(target);
}

export const fullModeScenarios: Scenario[] = [
  {
    name: 'happy path — pre-flop everyone folds to BB, BB wins blinds',
    category: 'FullMode',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerFull(ctx);
      a.action({ type: 'START_HAND' });
      const s = await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500, 'pre-flop dealt');

      ctx.expect(s.communityCards.length === 0, 'no community cards pre-flop');
      ctx.expect(
        s.players.filter((p) => p.holeCards !== null || p.id !== a.playerId).length >= 1,
        'hole cards dealt'
      );
      ctx.expect(a.me()!.holeCards !== null, 'admin sees own hole cards');

      // Find SB and BB amounts in pot
      const potBefore = s.pots[0].amount;
      ctx.expect(potBefore === 30, 'pot equals SB+BB', {
        expected: '30',
        actual: String(potBefore),
      });

      // Two players fold; BB should auto-win.
      // Action order pre-flop with 3 players: dealer is sorted to first, SB next, BB next.
      // First-to-act pre-flop is player after BB == dealer.
      // Two folds in a row = BB wins.
      const clients = [a, b, c];
      await actCurrent(clients, (cl) => cl.action({ type: 'FOLD' }), 'fold-1');
      await flush(50);
      await actCurrent(clients, (cl) => cl.action({ type: 'FOLD' }), 'fold-2');
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 1500, 'hand complete');

      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 3000, 'total chips conserved across hand', {
        expected: '3000',
        actual: String(total),
        fix: 'check pot accounting in determineWinners / fold path',
      });

      // The winner should have starting + 10 (small blind they didn't post — depends on position)
      const winners = a.state!.players.filter((p) => p.chips > 1000);
      ctx.expect(winners.length === 1, 'exactly one winner on fold-out', {
        actual: `${winners.length} players above starting chips`,
      });
    },
  },

  {
    name: 'play through full hand to showdown — pot is awarded',
    category: 'FullMode',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerFull(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);

      const clients = [a, b, c];

      // Each player calls to BB. Pre-flop: dealer calls 20, SB calls to 20 (adds 10), BB checks.
      const playStreet = async (label: string) => {
        let safety = 10;
        while (safety-- > 0) {
          await flush(20);
          const s = a.state!;
          if (s.phase !== label && !(label === 'PRE_FLOP' && s.phase === 'FLOP')) break;
          if (s.phase !== label) break;
          if (s.activePlayerIndex < 0) break;
          const ap = activePlayer(s);
          const target = clients.find((cl) => cl.playerId === ap.id)!;
          const me = target.me()!;
          if (me.currentBet < s.currentBet) target.action({ type: 'CALL' });
          else target.action({ type: 'CHECK' });
        }
      };

      await playStreet('PRE_FLOP');
      await a.waitFor((s) => s.phase === 'FLOP', 1500, 'flop dealt');
      ctx.expect(a.state!.communityCards.length === 3, 'flop has 3 cards');

      await playStreet('FLOP');
      await a.waitFor((s) => s.phase === 'TURN', 1500, 'turn dealt');
      ctx.expect(a.state!.communityCards.length === 4, 'turn has 4 cards');

      await playStreet('TURN');
      await a.waitFor((s) => s.phase === 'RIVER', 1500, 'river dealt');
      ctx.expect(a.state!.communityCards.length === 5, 'river has 5 cards');

      await playStreet('RIVER');
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 1500, 'hand resolved');

      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 3000, 'chips conserved through showdown', {
        severity: 'critical',
        expected: '3000',
        actual: String(total),
      });
      ctx.expect(a.state!.pots[0].amount === 0, 'pot drained after showdown', {
        expected: '0',
        actual: String(a.state!.pots[0].amount),
      });

      // Cards of non-folded players should be visible at HAND_COMPLETE
      const visible = a.state!.players.filter((p) => !p.isFolded && p.holeCards !== null);
      ctx.expect(visible.length >= 2, 'showdown reveals hole cards of contenders', {
        actual: `${visible.length} players with visible cards`,
      });
    },
  },

  {
    name: 'raise / re-raise / call sequence',
    category: 'FullMode',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerFull(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);

      const clients = [a, b, c];

      // First to act raises to 60 (3x BB)
      await actCurrent(clients, (cl) => cl.action({ type: 'RAISE', amount: 60 }), 'raise-1');
      await flush(50);
      // Next player re-raises to 150
      await actCurrent(clients, (cl) => cl.action({ type: 'RAISE', amount: 150 }), 'raise-2');
      await flush(50);
      // Third folds
      await actCurrent(clients, (cl) => cl.action({ type: 'FOLD' }), 'fold');
      await flush(50);
      // Original raiser calls
      await actCurrent(clients, (cl) => cl.action({ type: 'CALL' }), 'call');
      await a.waitFor((s) => s.phase === 'FLOP' || s.phase === 'HAND_COMPLETE', 1500, 'flop/complete');

      const pot = a.state!.pots[0].amount;
      // Two players each contributed 150 + the folded player's blind (SB or BB)
      ctx.expect(pot >= 300 && pot <= 320, 'pot reflects raises + folded blind', {
        expected: '300-320',
        actual: String(pot),
      });
    },
  },

  {
    name: 'all-in creates side pot when shorter stack covered',
    category: 'FullMode',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const c = await ctx.client('Carol');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await c.join(roomCode);
      await c.waitFor((s) => s.players.length === 3);

      a.configure({ smallBlind: 10, bigBlind: 20, startingChips: 1000 });
      await a.waitFor((s) => s.startingChips === 1000);

      // Make Carol short-stacked
      a.selectSeat(0);
      b.selectSeat(1);
      c.selectSeat(2);
      await a.waitFor((s) => s.players.every((p) => p.seatIndex >= 0));

      // Can't directly mutate chips here pre-hand; the engine doesn't expose
      // configure for individual stacks. Instead use admin REMOVE_CHIPS path.
      a.action({ type: 'REMOVE_CHIPS', playerId: c.playerId!, amount: 800 });
      await a.waitFor((s) => s.players.find((p) => p.id === c.playerId)!.chips === 200);

      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);

      // Everyone goes all-in to force side pot mechanics
      const clients = [a, b, c];
      let safety = 6;
      while (safety-- > 0) {
        await flush(40);
        const s = a.state!;
        if (s.phase === 'HAND_COMPLETE' || s.activePlayerIndex < 0) break;
        const ap = s.players[s.activePlayerIndex];
        const target = clients.find((cl) => cl.playerId === ap.id)!;
        target.action({ type: 'ALL_IN' });
      }
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 2000, 'hand complete after all-ins');

      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 2200, 'chips conserved in side-pot scenario', {
        severity: 'critical',
        expected: '2200',
        actual: String(total),
        fix: 'review calculateSidePots in game-engine.ts',
      });
    },
  },

  {
    name: 'check is rejected when there is a bet to call',
    category: 'FullMode',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerFull(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP');

      const clients = [a, b, c];
      // Active player tries to CHECK pre-flop with BB outstanding — should be rejected
      const s = a.state!;
      const ap = s.players[s.activePlayerIndex];
      const target = clients.find((cl) => cl.playerId === ap.id)!;
      const beforeIdx = s.activePlayerIndex;
      target.action({ type: 'CHECK' });
      await flush(50);
      ctx.expect(a.state!.activePlayerIndex === beforeIdx,
        'invalid CHECK leaves turn unchanged',
        { actual: `idx ${a.state!.activePlayerIndex}` }
      );
    },
  },
];
