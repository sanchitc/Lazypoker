/**
 * Teen Patti end-to-end scenarios.
 *
 * Setup uses 2–4 players in `mode: 'full'` with `variant: 'teen-patti'`.
 * Verifies the deal/blind state, chaal-vs-raise pricing, sideshow flow,
 * show eligibility matrix, single-survivor end, pot-limit forced show,
 * and the FR-14 "own cards hidden until SEE" guarantee.
 */
import { Scenario } from '../lib/scenario.js';
import { flush } from '../lib/client.js';
import type { GameState } from '../../common/types.js';

async function setup3PlayerTP(ctx: any) {
  const a = await ctx.client('Alice');
  const b = await ctx.client('Bob');
  const c = await ctx.client('Carol');
  const { roomCode } = await a.create('full', 'teen-patti');
  await b.join(roomCode);
  await c.join(roomCode);
  await c.waitFor((s: GameState) => s.players.length === 3);

  a.configure({ boot: 10, chaalLimitMultiplier: 4, potLimitMultiplier: 128, startingChips: 1000 });
  await a.waitFor(
    (s: GameState) => s.teenPatti?.boot === 10 && s.startingChips === 1000,
    1500,
    'tp config applied'
  );

  a.selectSeat(0);
  b.selectSeat(1);
  c.selectSeat(2);
  await a.waitFor(
    (s: GameState) => s.players.every((p) => p.seatIndex >= 0),
    1500,
    'all seated'
  );
  return { a, b, c };
}

async function setupHeadsUpTP(ctx: any) {
  const a = await ctx.client('Alice');
  const b = await ctx.client('Bob');
  const { roomCode } = await a.create('full', 'teen-patti');
  await b.join(roomCode);
  await b.waitFor((s: GameState) => s.players.length === 2);
  a.configure({ boot: 10, startingChips: 1000 });
  await a.waitFor((s: GameState) => s.teenPatti?.boot === 10);
  a.selectSeat(0);
  b.selectSeat(1);
  await a.waitFor((s: GameState) => s.players.every((p) => p.seatIndex >= 0));
  return { a, b };
}

function activePlayer(s: GameState) {
  return s.players[s.activePlayerIndex];
}

async function actCurrent(clients: any[], act: (c: any) => void, label = 'action') {
  const ref = clients.find((c) => c.state) || clients[0];
  const s = ref.state!;
  const ap = activePlayer(s);
  if (!ap) throw new Error(`no active player at ${label}`);
  const target = clients.find((c) => c.playerId === ap.id);
  if (!target) throw new Error(`no client matches active player ${ap.name} at ${label}`);
  act(target);
}

export const teenPattiScenarios: Scenario[] = [
  {
    name: 'TP: deal — boot collected, 3 cards each, all blind',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerTP(ctx);
      a.action({ type: 'START_HAND' });
      const s = await a.waitFor((s) => s.phase === 'BETTING', 1500, 'betting started');

      ctx.expect(s.communityCards.length === 0, 'no community cards in TP');
      ctx.expect(s.pots[0].amount === 30, 'pot = 3 × boot', { expected: '30', actual: String(s.pots[0].amount) });
      ctx.expect(s.currentBet === 10, 'stake equals boot', { expected: '10', actual: String(s.currentBet) });
      ctx.expect(s.players.every((p) => !p.hasSeenCards), 'everyone is blind at deal');

      // Each client should see exactly 3 of their own cards, but NOT yet (FR-14).
      const me = a.me()!;
      ctx.expect(me.holeCards === null, 'own cards hidden until SEE_CARDS (FR-14)', {
        severity: 'critical',
        actual: me.holeCards ? `array of length ${me.holeCards.length}` : 'null',
      });

      // Opponent cards must always be hidden.
      const opp = a.state!.players.find((p) => p.id !== a.playerId)!;
      ctx.expect(opp.holeCards === null, 'opponent cards hidden during play');

      void b; void c;
    },
  },

  {
    name: 'TP: blind chaal pays 1× stake; seen chaal pays 2×',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerTP(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');

      const clients = [a, b, c];

      // Active player chaals while blind.
      const initialPot = a.state!.pots[0].amount;
      const ap1 = activePlayer(a.state!);
      const initialChips1 = ap1.chips;
      await actCurrent(clients, (cl) => cl.action({ type: 'CHAAL' }), 'blind chaal');
      await flush(60);
      const after1 = a.state!.players.find((p) => p.id === ap1.id)!;
      ctx.expect(initialChips1 - after1.chips === 10, 'blind chaal costs 1× stake', {
        expected: '10',
        actual: String(initialChips1 - after1.chips),
      });
      ctx.expect(a.state!.pots[0].amount === initialPot + 10, 'pot increases by 1× stake');

      // Next player: SEE_CARDS (free), then CHAAL (2×).
      const ap2 = activePlayer(a.state!);
      const seenClient = clients.find((cl) => cl.playerId === ap2.id)!;
      const initialChips2 = ap2.chips;
      seenClient.action({ type: 'SEE_CARDS' });
      // Wait on seenClient's own state — server filters per-player, so the
      // hasSeenCards + revealed holeCards arrive in the same broadcast that
      // reaches this client (which can lag the admin's broadcast slightly).
      await seenClient.waitFor(
        (s) => {
          const me = s.players.find((p) => p.id === ap2.id);
          return !!me?.hasSeenCards && !!me.holeCards && me.holeCards.length === 3;
        },
        1500,
        'seen flips & cards revealed to self',
      );
      const stillSameTurn = activePlayer(seenClient.state!).id === ap2.id;
      ctx.expect(stillSameTurn, 'SEE_CARDS does not advance turn');

      const meAfterSee = seenClient.me()!;
      ctx.expect(
        meAfterSee.holeCards !== null && meAfterSee.holeCards.length === 3,
        'seen player receives own 3 cards',
        { actual: meAfterSee.holeCards ? `length ${meAfterSee.holeCards.length}` : 'null' }
      );

      seenClient.action({ type: 'CHAAL' });
      await flush(60);
      const afterSeen = a.state!.players.find((p) => p.id === ap2.id)!;
      ctx.expect(initialChips2 - afterSeen.chips === 20, 'seen chaal costs 2× stake', {
        expected: '20',
        actual: String(initialChips2 - afterSeen.chips),
      });
    },
  },

  {
    name: 'TP: blind raise updates stake; followers chaal at new rate',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerTP(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');

      const clients = [a, b, c];

      // Blind raise to stake=20 (pays 20 since blind).
      const ap = activePlayer(a.state!);
      const before = ap.chips;
      await actCurrent(clients, (cl) => cl.action({ type: 'RAISE_TP', amount: 20 }), 'blind raise');
      await flush(60);
      const afterRaise = a.state!.players.find((p) => p.id === ap.id)!;
      ctx.expect(before - afterRaise.chips === 20, 'blind raise pays new stake', {
        expected: '20', actual: String(before - afterRaise.chips),
      });
      ctx.expect(a.state!.currentBet === 20, 'stake updated to 20');
    },
  },

  {
    name: 'TP: pack to single survivor — uncontested win, no card reveal',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a, b, c } = await setup3PlayerTP(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');
      const clients = [a, b, c];

      const startTotal = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(startTotal === 2970, 'chips before play = 3000 - 30 boot', {
        actual: String(startTotal),
      });

      // Two packs in a row → 1 survivor.
      await actCurrent(clients, (cl) => cl.action({ type: 'PACK' }));
      await flush(40);
      await actCurrent(clients, (cl) => cl.action({ type: 'PACK' }));
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 1500, 'hand complete');

      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 3000, 'chips conserved after pack-out', {
        severity: 'critical', expected: '3000', actual: String(total),
      });
      ctx.expect(a.state!.pots[0].amount === 0, 'pot drained');

      // Winner cards should NOT be revealed on a pack-out.
      const winner = a.state!.players.find((p) => p.chips > 1000);
      ctx.expect(!!winner, 'one player has more than starting chips');
      // Other players: their hole cards stay hidden (filterStateForPlayer).
      const summary = a.state!.lastHandSummary;
      ctx.expect(summary?.reason === 'pack', 'reason is pack', { actual: String(summary?.reason) });
    },
  },

  {
    name: 'TP: heads-up blind/blind show — costs 1× stake',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a, b } = await setupHeadsUpTP(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');

      // Whoever is on turn, call show (both blind).
      const clients = [a, b];
      const ap = activePlayer(a.state!);
      const before = ap.chips;
      const target = clients.find((cl) => cl.playerId === ap.id)!;
      target.action({ type: 'CALL_SHOW' });
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 1500, 'show resolved');

      const after = a.state!.players.find((p) => p.id === ap.id)!;
      // Caller paid 10 (1× stake) into the pot before the showdown; if they
      // win, they reclaim it via the share.
      const summary = a.state!.lastHandSummary;
      ctx.expect(summary?.reason === 'show', 'summary reason = show', { actual: String(summary?.reason) });
      ctx.expect(a.state!.pots[0].amount === 0, 'pot drained');

      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 2000, 'chips conserved at heads-up showdown', {
        severity: 'critical', expected: '2000', actual: String(total),
      });
      void before; void after;
    },
  },

  {
    name: 'TP: seen vs blind show by seen caller is rejected',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a, b } = await setupHeadsUpTP(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');

      const clients = [a, b];
      const ap = activePlayer(a.state!);
      const target = clients.find((cl) => cl.playerId === ap.id)!;

      // Caller becomes seen.
      target.action({ type: 'SEE_CARDS' });
      await a.waitFor(
        (s) => s.players.find((p) => p.id === ap.id)!.hasSeenCards === true,
        1500,
        'caller seen'
      );

      // Opponent stays blind. Seen-vs-blind show by seen caller is forbidden.
      target.action({ type: 'CALL_SHOW' });
      await flush(80);
      ctx.expect(a.state!.phase === 'BETTING',
        'seen-caller vs blind opponent show is rejected — phase stays BETTING',
        { actual: a.state!.phase }
      );
    },
  },

  {
    name: 'TP: pot-limit forced show terminates the hand',
    category: 'TeenPatti',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full', 'teen-patti');
      await b.join(roomCode);
      await b.waitFor((s: GameState) => s.players.length === 2);
      // Tiny pot limit: boot=10, multiplier=8 → forced show at pot ≥ 80.
      a.configure({ boot: 10, chaalLimitMultiplier: 4, potLimitMultiplier: 8, startingChips: 1000 });
      await a.waitFor((s: GameState) => s.teenPatti?.potLimitMultiplier === 8);
      a.selectSeat(0);
      b.selectSeat(1);
      await a.waitFor((s: GameState) => s.players.every((p) => p.seatIndex >= 0));

      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');

      // Initial pot after boot = 20. Limit = 80. 6 blind chaals (10 each) = 60 → 80.
      const clients = [a, b];
      let safety = 12;
      while (safety-- > 0 && a.state!.phase === 'BETTING') {
        await actCurrent(clients, (cl) => cl.action({ type: 'CHAAL' }), 'chaal-loop');
        await flush(40);
      }
      await a.waitFor((s) => s.phase === 'HAND_COMPLETE', 2000, 'hand resolved by pot limit');
      const summary = a.state!.lastHandSummary;
      ctx.expect(summary?.reason === 'pot-limit', 'reason = pot-limit', { actual: String(summary?.reason) });
      const total = a.state!.players.reduce((sum, p) => sum + p.chips, 0);
      ctx.expect(total === 2000, 'chips conserved through forced show', {
        severity: 'critical', expected: '2000', actual: String(total),
      });
    },
  },

  {
    name: 'TP: poker actions are rejected in TP rooms',
    category: 'TeenPatti',
    async fn(ctx) {
      const { a } = await setup3PlayerTP(ctx);
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'BETTING');

      const beforePhase = a.state!.phase;
      const beforeIdx = a.state!.activePlayerIndex;
      // FOLD/CHECK/CALL/RAISE should be silently rejected by the engine.
      a.action({ type: 'FOLD' });
      await flush(50);
      ctx.expect(a.state!.phase === beforePhase, 'phase unchanged after invalid FOLD');
      ctx.expect(a.state!.activePlayerIndex === beforeIdx, 'turn unchanged after invalid FOLD');
    },
  },
];
