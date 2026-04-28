/**
 * Lobby flow: create room, join, configure, seat selection.
 * Covers: JoinScreen → LobbyScreen transitions.
 */
import { Scenario } from '../lib/scenario.js';
import { flush } from '../lib/client.js';

export const lobbyScenarios: Scenario[] = [
  {
    name: 'host creates a room and is admin',
    category: 'Lobby',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      const { roomCode, playerId } = await host.create('full');
      ctx.expect(roomCode.length === 4, 'room code is 4 chars', { actual: String(roomCode.length) });
      ctx.expect(!!playerId, 'player id returned', { severity: 'critical' });
      await host.waitFor((s) => s.players.length === 1, 1000, 'host in state');
      const me = host.me();
      ctx.expect(me?.isAdmin === true, 'host is admin', { severity: 'high' });
      ctx.expect(host.state?.phase === 'WAITING', 'phase WAITING after create', {
        actual: host.state?.phase,
      });
    },
  },

  {
    name: 'second player joins and is not admin',
    category: 'Lobby',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      const { roomCode } = await host.create('chip-only');
      const guest = await ctx.client('Bob');
      const res = await guest.join(roomCode);
      ctx.expect(res.success, 'join succeeds');
      await guest.waitFor((s) => s.players.length === 2, 1000, '2 players');
      ctx.expect(guest.me()?.isAdmin === false, 'second player is not admin');
    },
  },

  {
    name: 'invalid room code is rejected',
    category: 'Lobby',
    async fn(ctx) {
      const c = await ctx.client('Bob');
      const res = await c.join('XXXX');
      ctx.expect(res.success === false, 'join with bad code rejected');
      ctx.expect(!!res.error, 'error message returned');
    },
  },

  {
    name: 'admin can configure blinds and starting chips',
    category: 'Lobby',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      await host.create('full');
      host.configure({ smallBlind: 10, bigBlind: 25, startingChips: 2000 });
      const s = await host.waitFor(
        (s) => s.smallBlind === 10 && s.bigBlind === 25 && s.startingChips === 2000,
        1000,
        'config applied'
      );
      ctx.expect(host.me()?.chips === 2000, 'host chips updated to new starting chips', {
        expected: '2000',
        actual: String(host.me()?.chips),
        fix: 'configure() should propagate startingChips to existing players in WAITING phase (already implemented; verify path)',
      });
    },
  },

  {
    name: 'non-admin cannot configure',
    category: 'Lobby',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      const { roomCode } = await host.create('full');
      const guest = await ctx.client('Bob');
      await guest.join(roomCode);
      await guest.waitFor((s) => s.players.length === 2, 1000);

      const before = guest.state!.smallBlind;
      guest.configure({ smallBlind: before + 100 });
      await flush(50);
      ctx.expect(guest.state!.smallBlind === before, 'guest config call had no effect');
    },
  },

  {
    name: 'players can select seats; collisions are rejected',
    category: 'Lobby',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      const { roomCode } = await host.create('full');
      const guest = await ctx.client('Bob');
      await guest.join(roomCode);
      await guest.waitFor((s) => s.players.length === 2);
      host.selectSeat(0);
      guest.selectSeat(1);
      await guest.waitFor(
        (s) => !!s.players.find((p) => p.id === host.playerId && p.seatIndex === 0)
              && !!s.players.find((p) => p.id === guest.playerId && p.seatIndex === 1),
        1000,
        'seats applied'
      );

      // Collision: guest tries seat 0
      guest.selectSeat(0);
      await flush(50);
      const guestPlayer = guest.state!.players.find((p) => p.id === guest.playerId)!;
      ctx.expect(guestPlayer.seatIndex === 1, 'collided seat selection ignored', {
        expected: 'seatIndex stays 1',
        actual: `seatIndex=${guestPlayer.seatIndex}`,
      });
    },
  },

  {
    name: 'cannot start hand with fewer than 2 seated players',
    category: 'Lobby',
    async fn(ctx) {
      const host = await ctx.client('Alice');
      await host.create('full');
      host.selectSeat(0);
      await host.waitFor((s) => s.players[0].seatIndex === 0);
      host.action({ type: 'START_HAND' });
      await flush(50);
      ctx.expect(host.state!.phase === 'WAITING', 'phase remains WAITING', {
        actual: host.state!.phase,
        fix: 'engine already enforces min 2 active players — verified',
      });
    },
  },
];
