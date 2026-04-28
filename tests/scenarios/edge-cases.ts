/**
 * Edge cases that don't fit the main story arc but are important to
 * keep covered as the codebase evolves.
 */
import { Scenario } from '../lib/scenario.js';
import { flush } from '../lib/client.js';

export const edgeCaseScenarios: Scenario[] = [
  {
    name: 'heads-up: 2-player game starts with correct blind positions',
    category: 'EdgeCases',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);
      a.configure({ smallBlind: 10, bigBlind: 20, startingChips: 1000 });
      a.selectSeat(0);
      b.selectSeat(1);
      await a.waitFor((s) => s.players.every((p) => p.seatIndex >= 0));
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);

      const pot = a.state!.pots[0].amount;
      ctx.expect(pot === 30, 'heads-up still posts SB+BB', {
        expected: '30',
        actual: String(pot),
      });

      // Heads-up convention: dealer/SB acts first pre-flop
      const ap = a.state!.players[a.state!.activePlayerIndex];
      ctx.expect(!!ap, 'has an active player to act first');
    },
  },

  {
    name: 'kicked player is removed from state',
    category: 'EdgeCases',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);

      const bobId = b.playerId!;
      a.action({ type: 'KICK_PLAYER', playerId: bobId });
      await a.waitFor((s) => !s.players.some((p) => p.id === bobId), 1000,
        'kicked player removed');
    },
  },

  {
    name: 'ADD_CHIPS by admin updates buy-in tracking',
    category: 'EdgeCases',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await a.waitFor((s) => s.players.length === 2);

      const before = a.state!.players.find((p) => p.id === b.playerId)!.chips;
      a.action({ type: 'ADD_CHIPS', playerId: b.playerId!, amount: 500 });
      await a.waitFor(
        (s) => s.players.find((p) => p.id === b.playerId)!.chips === before + 500,
        1000,
        'chips added'
      );
    },
  },

  {
    name: 'room rejects 11th player (default maxPlayers=10)',
    category: 'EdgeCases',
    async fn(ctx) {
      const host = await ctx.client('Host');
      const { roomCode } = await host.create('chip-only');
      for (let i = 0; i < 9; i++) {
        const c = await ctx.client(`P${i}`);
        const r = await c.join(roomCode);
        ctx.expect(r.success, `player ${i} joined`);
      }
      const overflow = await ctx.client('Eleventh');
      const res = await overflow.join(roomCode);
      ctx.expect(res.success === false, 'eleventh player rejected', {
        actual: String(res.success),
      });
    },
  },

  {
    name: 'fold reduces pot by 0 (no chips returned mid-hand)',
    category: 'EdgeCases',
    async fn(ctx) {
      const a = await ctx.client('Alice');
      const b = await ctx.client('Bob');
      const c = await ctx.client('Carol');
      const { roomCode } = await a.create('full');
      await b.join(roomCode);
      await c.join(roomCode);
      await c.waitFor((s) => s.players.length === 3);
      a.configure({ smallBlind: 10, bigBlind: 20, startingChips: 1000 });
      a.selectSeat(0);
      b.selectSeat(1);
      c.selectSeat(2);
      await a.waitFor((s) => s.players.every((p) => p.seatIndex >= 0));
      a.action({ type: 'START_HAND' });
      await a.waitFor((s) => s.phase === 'PRE_FLOP', 1500);

      const potBefore = a.state!.pots[0].amount;
      const clients = [a, b, c];
      const ap = a.state!.players[a.state!.activePlayerIndex];
      const t = clients.find((cl) => cl.playerId === ap.id)!;
      t.action({ type: 'FOLD' });
      await flush(50);
      ctx.expect(a.state!.pots[0].amount === potBefore,
        'fold does not change pot mid-round');
    },
  },
];
